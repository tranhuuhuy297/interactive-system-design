import type { ArchEdge, ArchNode, EpisodeStage } from '../../components/ui'

// Stage graphs are cumulative: each stage re-lists the nodes it keeps so positions stay stable.
const N = {
  client: { id: 'client', label: 'Mobile app', kind: 'client', x: 10, y: 50 },
  web: { id: 'web', label: 'App servers', sub: 'Python / Django', kind: 'service', x: 32, y: 50 },
  pg: { id: 'pg', label: 'PostgreSQL', sub: 'one primary', kind: 'db', x: 80, y: 40 },
  cdn: { id: 'cdn', label: 'CDN', sub: 'photo delivery', kind: 'cdn', x: 30, y: 15 },
  media: { id: 'media', label: 'Object storage', sub: 'all renditions', kind: 'storage', x: 90, y: 82 },
  q: { id: 'q', label: 'Task queue', kind: 'queue', x: 50, y: 82 },
  workers: { id: 'workers', label: 'Media workers', sub: 'resize · filters', kind: 'worker', x: 70, y: 82 },
  cache: { id: 'cache', label: 'Redis / memcached', sub: 'feeds + counters', kind: 'cache', x: 55, y: 15 },
  feed: { id: 'feed', label: 'Feed service', sub: 'fan-out + rank', kind: 'service', x: 55, y: 50 },
  stories: { id: 'stories', label: 'Stories', sub: 'expire in 24h', kind: 'service', x: 80, y: 62 },
  transcode: { id: 'transcode', label: 'Video pipeline', sub: 'transcode · ABR', kind: 'worker', x: 30, y: 82 },
  region: { id: 'region', label: 'Other regions', sub: 'replicas', kind: 'external', x: 90, y: 15 },
} satisfies Record<string, ArchNode>

const shards: ArchNode = { ...N.pg, label: 'Postgres shards', sub: 'logical → physical' }

const e = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })
const core = [e('client', 'web'), e('client', 'cdn'), e('cdn', 'media'), e('web', 'pg'), e('web', 'q', { async: true }), e('q', 'workers'), e('workers', 'media')]

export const INSTAGRAM_STAGES: EpisodeStage[] = [
  {
    title: 'v0 · Django + Postgres',
    scale: 'launch · tiny team',
    nodes: [N.client, N.web, N.pg],
    edges: [e('client', 'web'), e('web', 'pg')],
    flows: [{ name: 'Upload', path: ['client', 'web', 'pg'], steps: ['App uploads a filtered photo', 'Server saves the file and writes the post row'] }],
    problem: <p>Launch a photo app on iPhone with a handful of engineers. Growth is unknown, and speed of iteration beats everything.</p>,
    decision: <p>A standard web framework on a few rented cloud servers with one relational database. Photos are resized in the request and stored alongside the app.</p>,
    tradeoff: <p>Uploads block app threads, and one database is the ceiling. That’s fine, as long as you know which wall you will hit first.</p>,
    realWorld: <p>Instagram launched in 2010 and publicly described an early stack of <strong>Django</strong> and <strong>PostgreSQL</strong> on AWS. It grew very quickly after launch, so scaling work started almost immediately.</p>,
  },
  {
    title: 'v1 · Media off the hot path',
    scale: 'millions of users',
    added: ['cdn', 'media', 'q', 'workers'],
    nodes: [N.client, N.web, N.pg, N.cdn, N.media, N.q, N.workers],
    edges: core,
    flows: [
      { name: 'Upload', path: ['client', 'web', 'q', 'workers', 'media'], steps: ['App uploads the original', 'Server writes the post and enqueues work', 'Workers pick up the job', 'Renditions land in object storage'] },
      { name: 'View', path: ['client', 'cdn', 'media'], steps: ['App requests a photo URL from the CDN', 'Misses pull from object storage once'] },
    ],
    problem: <p>Photo bytes dwarf metadata, and resizing inside requests makes uploads slow and servers expensive. Every view of a popular photo hits your servers.</p>,
    decision: <p>Store images in <strong>object storage</strong>, serve them through a <strong>CDN</strong>, and move resizing, thumbnails, and notifications to <strong>async workers</strong> behind a task queue.</p>,
    tradeoff: <p>A post exists before its thumbnails do, so clients must handle “processing” states. Now there are queues to monitor.</p>,
    realWorld: <p>Instagram’s 2011 “What Powers Instagram” post listed S3 for photo storage, CloudFront as the CDN, a task queue (Gearman) for async work, and Redis and memcached alongside Postgres.</p>,
  },
  {
    title: 'v2 · Shard Postgres',
    scale: 'tens of millions of users',
    added: ['pg'],
    nodes: [N.client, N.web, shards, N.cdn, N.media, N.q, N.workers],
    edges: core,
    flows: [{ name: 'Write', path: ['client', 'web', 'pg'], steps: ['App creates a post', 'Server routes to the author’s logical shard; the DB generates a sortable ID'] }],
    problem: <p>Writes and data size outgrow one primary. Posts need IDs that are unique across many databases and still sort by time without a central ID service.</p>,
    decision: <p>Split data into thousands of <strong>logical shards</strong> (keyed by user), mapped onto a few <strong>physical</strong> servers. Generate IDs <em>inside</em> each shard: time bits, then the shard ID, then a per-shard sequence. Growing means moving whole logical shards, never re-keying rows.</p>,
    tradeoff: <p>Cross-user queries are scatter-gather, and resharding is still operational work. The ID layout caps throughput per shard per millisecond.</p>,
    realWorld: <p>Instagram’s 2012 “Sharding &amp; IDs” post described exactly this: several thousand logical shards as Postgres schemas on fewer physical hosts, and 64-bit IDs of 41 bits of time, 13 bits of shard ID, and 10 bits of sequence, generated in PL/pgSQL.</p>,
  },
  {
    title: 'v3 · The feed',
    scale: '100M+ users',
    added: ['feed', 'cache'],
    nodes: [N.client, N.web, shards, N.cdn, N.media, N.q, N.workers, N.feed, N.cache],
    edges: [...core, e('web', 'feed'), e('feed', 'cache'), e('feed', 'pg'), e('workers', 'cache', { label: 'fan-out', async: true })],
    flows: [
      { name: 'Open app', path: ['client', 'web', 'feed', 'cache'], steps: ['App opens the home feed', 'Server asks the feed service', 'Precomputed candidate IDs come from an in-memory store, then get ranked and hydrated'] },
      { name: 'Fan-out', path: ['web', 'q', 'workers', 'cache'], steps: ['A new post is published', 'A fan-out job is queued', 'Workers append the post ID to followers’ feed lists'] },
    ],
    problem: <p>Computing a feed by querying every account you follow at open time is far too slow when you follow hundreds of accounts across many shards.</p>,
    decision: <p><strong>Fan out on write</strong> for normal accounts by pushing post IDs into followers’ lists in memory. <strong>Pull at read time</strong> for accounts with huge followings, then merge and <strong>rank</strong> by predicted interest rather than pure recency.</p>,
    tradeoff: <p>Write amplification for popular authors, stale entries after deletes, and a ranking stack that becomes a product in itself.</p>,
    realWorld: <p>Instagram moved from a reverse-chronological feed to an algorithmically ranked feed in 2016.</p>,
  },
  {
    title: 'v4 · Stories',
    scale: 'hundreds of millions of daily viewers',
    added: ['stories'],
    nodes: [N.client, N.web, shards, N.cdn, N.media, N.q, N.workers, N.feed, N.cache, N.stories],
    edges: [...core, e('web', 'feed'), e('feed', 'cache'), e('feed', 'pg'), e('workers', 'cache', { async: true }), e('web', 'stories'), e('stories', 'cache')],
    flows: [{ name: 'Story tray', path: ['client', 'web', 'stories', 'cache'], steps: ['App loads the story tray', 'Server asks the stories service', 'Active stories and seen state come from memory, with 24-hour TTLs'] }],
    problem: <p>Ephemeral content is extremely read-heavy right after posting, then worthless after 24 hours. Per-viewer “seen” state explodes in volume.</p>,
    decision: <p>A dedicated <strong>stories service</strong> keeps active stories and seen markers in memory with <strong>TTLs</strong>. It serves the tray from precomputed per-user lists and lets expiry do the deletion work.</p>,
    tradeoff: <p>Memory-heavy by design. Expiry at scale needs care so billions of keys don’t expire in a thundering herd.</p>,
    realWorld: <p>Instagram Stories launched in 2016, with content that disappears after 24 hours.</p>,
  },
  {
    title: 'v5 · Video and Reels',
    scale: 'video becomes the main format',
    added: ['transcode'],
    nodes: [N.client, N.web, shards, N.cdn, N.media, N.q, N.workers, N.feed, N.cache, N.stories, N.transcode],
    edges: [...core, e('web', 'feed'), e('feed', 'cache'), e('feed', 'pg'), e('web', 'stories'), e('stories', 'cache'), e('q', 'transcode'), e('transcode', 'media')],
    flows: [{ name: 'Publish video', path: ['client', 'web', 'q', 'transcode', 'media'], steps: ['App uploads the video', 'Server enqueues processing', 'Pipeline transcodes to several bitrates', 'Segments land in storage for CDN delivery'] }],
    problem: <p>Video is 10–100× the bytes of a photo, and phones switch between Wi-Fi and cellular mid-scroll. A single file per video stalls on bad networks.</p>,
    decision: <p>A <strong>transcoding pipeline</strong> produces a bitrate ladder and segmented streams for adaptive playback. Prefetch the next items in the feed and start with a low bitrate for a fast first frame.</p>,
    tradeoff: <p>Encoding compute and storage costs rise sharply, and you must decide which videos get expensive encodes and which get a cheap ladder.</p>,
    realWorld: <p>Reels launched in 2020. Meta has written about spending more encoding effort on videos predicted to be watched most.</p>,
  },
  {
    title: 'v6 · Multiple regions',
    scale: 'global, billions of accounts',
    added: ['region'],
    nodes: [N.client, N.web, shards, N.cdn, N.media, N.q, N.workers, N.feed, N.cache, N.stories, N.transcode, N.region],
    edges: [...core, e('web', 'feed'), e('feed', 'cache'), e('feed', 'pg'), e('web', 'stories'), e('stories', 'cache'), e('q', 'transcode'), e('transcode', 'media'), e('pg', 'region', { label: 'replication', async: true })],
    flows: [{ name: 'Read nearby', path: ['client', 'web', 'feed', 'cache'], steps: ['App hits the nearest region', 'Reads served from local replicas and caches', 'Writes route to the shard’s primary region'] }],
    problem: <p>A single region means high latency for most of the world and a single disaster domain.</p>,
    decision: <p>Serve reads from <strong>every region</strong> with local caches and replicas. Route writes to each shard’s primary region, and keep enough capacity to absorb a lost region.</p>,
    tradeoff: <p>Replication lag appears in the product: a like may show up a moment later elsewhere, so read-your-own-writes needs routing tricks.</p>,
    realWorld: <p>After Facebook acquired Instagram in 2012, Instagram moved from AWS into Facebook’s data centers, and its engineers later wrote about running the service across multiple regions.</p>,
  },
]
