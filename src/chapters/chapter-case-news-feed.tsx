import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, FlowDiagram, H2, InterviewQuestion,
  KeyTakeaways, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode } from '../components/ui'
import { FeedFanoutSimulatorDemo } from './demos/feed-fanout-simulator-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Client', sub: 'app / web', kind: 'client', x: 7, y: 50 },
  { id: 'gw', label: 'API gateway', sub: 'auth · rate limit', kind: 'lb', x: 22, y: 50 },
  { id: 'post', label: 'Post service', kind: 'service', x: 40, y: 20,
    detail: 'Validates and stores the post, uploads media references, then publishes a PostCreated event. It never fans out inline, so publish latency is independent of follower count.' },
  { id: 'feed', label: 'Feed service', sub: 'read path', kind: 'service', x: 40, y: 80,
    detail: 'Reads the precomputed ID list from the feed cache, merges in posts from followed celebrities (pull), filters deleted and blocked items, then hydrates IDs into full posts.' },
  { id: 'kafka', label: 'Event bus', sub: 'Kafka', kind: 'queue', x: 58, y: 20,
    detail: 'Decouples publishing from fan-out. Partition by author ID so a single author\'s posts stay ordered.' },
  { id: 'fanout', label: 'Fan-out workers', kind: 'worker', x: 76, y: 20,
    detail: 'Looks up followers in pages of about 5K, skips inactive users and authors above the celebrity threshold, and batches ZADDs into each follower\'s feed key.' },
  { id: 'graph', label: 'Social graph', sub: 'followers / following', kind: 'db', x: 93, y: 38,
    detail: 'Adjacency lists stored in both directions, e.g. a wide-column store keyed by user ID, with a cache in front for hot accounts.' },
  { id: 'fcache', label: 'Feed cache', sub: 'Redis sorted sets', kind: 'cache', x: 76, y: 62,
    detail: 'One capped sorted set per user holding (postId, score). Only IDs are stored, never full posts, so the cache stays small and edits and deletes need no fan-out.' },
  { id: 'pcache', label: 'Post cache', sub: 'hydration', kind: 'cache', x: 58, y: 88,
    detail: 'postId → post body, author and counters. Hot posts are read millions of times, so this cache absorbs most of the hydration load.' },
  { id: 'store', label: 'Post store', sub: 'Cassandra / MySQL shards', kind: 'db', x: 93, y: 80,
    detail: 'Source of truth for posts, sharded by postId (e.g. Snowflake IDs, which are time-sortable).' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'gw' }, { from: 'gw', to: 'post' }, { from: 'gw', to: 'feed' },
  { from: 'post', to: 'store' }, { from: 'post', to: 'kafka', async: true }, { from: 'kafka', to: 'fanout', async: true },
  { from: 'fanout', to: 'graph' }, { from: 'fanout', to: 'fcache' },
  { from: 'feed', to: 'fcache' }, { from: 'feed', to: 'pcache' }, { from: 'pcache', to: 'store' },
]

export default function NewsFeedChapter() {
  return (
    <>
      <p>
        A news feed looks like a simple list query until you do the arithmetic: a few hundred million readers, each
        following hundreds of accounts, some of which have tens of millions of followers. The whole problem reduces to
        one question: <strong>do you do the work when a post is written, or when a feed is read?</strong> Every good
        answer is some mix of both.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Publish a post (text + media)', 'View a home feed of posts from followed accounts', 'Follow / unfollow', 'Paginate backwards through the feed']}
        nonFunctional={['300M DAU, ~10 feed loads per user per day', 'Feed load p99 < 200 ms', 'New posts visible to followers within seconds (eventual)', 'Highly available reads; feed is never empty on error']}
        outOfScope={['Ads insertion', 'Comments & reactions details', 'Search']}
      />
      <Callout kind="tip">
        Ask early: <strong>chronological or ranked?</strong> Ranking adds a candidate-generation stage and a scoring
        stage, and it changes what you cache. Also ask about the follower distribution. A single account with 100M
        followers changes the design.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['300M DAU; 0.5 posts per user per day; 10 feed loads per user per day', 'Average 200 followers per author (heavily skewed)', 'Feed cache keeps ~500 entries × 16 B per user']}
        rows={[
          { label: 'Post writes', math: '300M × 0.5 / 86,400', result: '≈ 1.7K/s' },
          { label: 'Feed reads', math: '300M × 10 / 86,400', result: '≈ 35K/s' },
          { label: 'Peak feed reads', math: '35K × 3', result: '≈ 100K/s' },
          { label: 'Fan-out inserts', math: '150M posts × 200 / 86,400', result: '≈ 350K/s' },
          { label: 'Feed cache size', math: '300M × 500 × 16 B', result: '≈ 2.4 TB' },
        ]}
      />
      <p>
        The key number is fan-out inserts: about <strong>200× the post rate</strong>. That write amplification is the
        price of O(1) reads. A 2.4 TB feed cache fits comfortably in a sharded Redis cluster, but only because it
        holds post IDs rather than post bodies.
      </p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/posts', desc: 'Publish a post. Media is uploaded separately via pre-signed URLs.', body: '{ text, mediaIds[], idempotencyKey }', returns: '201 { postId }' },
        { method: 'GET', path: '/v1/feed', desc: 'Home feed, newest first. Cursor = last seen (score, postId).', body: '?cursor&limit=20', returns: '{ items[], nextCursor }' },
        { method: 'PUT', path: '/v1/users/{id}/follow', desc: 'Follow an account. Also triggers an async backfill of its recent posts into your feed.', returns: '204' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="The write path and read path meet only in the feed cache"
        flows={[
          { name: 'Publish', path: ['client', 'gw', 'post', 'kafka', 'fanout', 'fcache'],
            steps: ['Client POSTs the post', 'Gateway authenticates and routes', 'Post service persists, then emits PostCreated', 'Fan-out worker consumes the event', 'Worker pages through followers and ZADDs postId into each active follower\'s feed'] },
          { name: 'Load feed', path: ['client', 'gw', 'feed', 'fcache'],
            steps: ['Client GETs /feed?cursor', 'Gateway → feed service', 'ZREVRANGEBYSCORE on the user\'s feed key returns 20 post IDs, merged with pulled celebrity posts'] },
          { name: 'Hydrate', path: ['feed', 'pcache', 'store'],
            steps: ['Feed service batch-gets post bodies from the post cache', 'Misses fall through to the post store and refill the cache'] },
        ]} />

      <H2 id="fanout">5 · Deep dive: fan-out on write vs on read</H2>
      <FeedFanoutSimulatorDemo />
      <CompareTable
        columns={['Push (fan-out on write)', 'Pull (fan-out on read)', 'Hybrid']}
        rows={[
          { label: 'Write cost', cells: ['O(followers) per post', 'O(1)', 'O(followers) for normal authors, O(1) for celebrities'] },
          { label: 'Read cost', cells: ['O(1) cache read', 'O(followees) fetch + merge', 'O(1) + O(celebrities followed)'] },
          { label: 'Freshness', cells: ['Delayed by fan-out lag', 'Always fresh', 'Mostly fresh'] },
          { label: 'Wasted work', cells: ['Inactive followers still get writes', 'None', 'Low (skip inactive users)'] },
          { label: 'Breaks on', cells: ['Celebrities: millions of writes per post', 'Heavy readers following thousands of accounts', 'Needs threshold tuning and two code paths'] },
        ]}
      />
      <Callout kind="pitfall">
        Picking pure push and moving on. The moment the interviewer says “now a celebrity with 100M followers
        posts,” pure push means 100M inserts and minutes of lag for a single post. Bring up the hybrid before they ask.
      </Callout>

      <H2 id="read-path">6 · Deep dive: storage, pagination, and hydration</H2>
      <p>
        Store <strong>only IDs</strong> in the per-user feed. Edits, deletes, and like counts then never need a
        second fan-out, because hydration always reads the current post. Paginate with a <strong>cursor</strong>{' '}
        (score + postId), not an offset. Offsets shift as new posts land at the top, which causes duplicates and gaps.
      </p>
      <CodeBlock lang="ts" title="feed read (sketch)" code={`
async function loadFeed(userId: string, cursor?: Cursor, limit = 20) {
  const max = cursor ? \`(\${cursor.score}\` : '+inf'           // exclusive upper bound
  const pushed = await redis.zrevrangebyscore(\`feed:\${userId}\`, max, '-inf',
                                              'WITHSCORES', 'LIMIT', 0, limit)
  const celebs = await graph.followedCelebrities(userId)      // usually small
  const pulled = await posts.recentByAuthors(celebs, { before: cursor, limit })
  const ids = mergeByScore(pushed, pulled).slice(0, limit)
  const items = (await postCache.mget(ids)).filter(isVisibleTo(userId)) // deletes, blocks
  return { items, nextCursor: cursorOf(ids.at(-1)) }
}`} />
      <FlowDiagram steps={[
        { label: 'Candidates', sub: 'pushed IDs + pulled celebs' },
        { label: 'Filter', sub: 'deleted, blocked, muted' },
        { label: 'Rank', sub: 'ML score (optional)' },
        { label: 'Hydrate', sub: 'post cache mget' },
        { label: 'Respond', sub: 'items + cursor' },
      ]} caption="Read path stages. Ranking slots in without touching the write path." />

      <H2 id="data-model">7 · Data model</H2>
      <CodeBlock lang="ts" title="storage layout" code={`
// Post store (sharded by postId; Snowflake IDs sort by time)
type Post = { postId: bigint; authorId: string; text: string; mediaIds: string[]; createdAt: number; deleted: boolean }

// Social graph, both directions (wide-column; partition = userId)
// followers:{authorId}  -> clustering by followerId   (fan-out reads this)
// following:{userId}    -> clustering by authorId     (pull path, follow lists)

// Feed cache (Redis): feed:{userId} = ZSET { member: postId, score: createdAt }
//   capped with ZREMRANGEBYRANK feed:{u} 0 -501  → keep newest 500`} />

      <H2 id="staff">8 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Skip inactive users.</strong> Most followers of a big account haven't opened the app in days. Only fan out to users active within N days, and rebuild a cold user's feed on their next login (pull once, then cache). This is usually the largest single cost saving.</li>
          <li><strong>Follow / unfollow consistency.</strong> A follow triggers a backfill of recent posts. An unfollow filters at read time and cleans up lazily, rather than scanning the feed.</li>
          <li><strong>Deletes and privacy.</strong> Never rely on fan-out to retract. Enforce visibility at hydration so a deleted or blocked post can't leak from a stale cache.</li>
          <li><strong>Backpressure.</strong> Kafka lag on fan-out is the key SLO signal. When it grows, raise the celebrity threshold dynamically to shed write load.</li>
          <li><strong>Multi-region.</strong> Keep feed caches regional and replicate post events across regions. The fan-out cost is then paid in each region, which is a real trade-off to call out.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="A user with 80M followers posts. Walk me through what happens in your system."
        senior={<p>They're above the celebrity threshold, so we don't fan out. The post is stored once, and when followers load their feed we merge in recent posts from the celebrities they follow.</p>}
        staff={<>
          <p>Write path: one insert into the post store and one event on the bus. Fan-out sees the author is flagged as pull-mode and does nothing more. Read path: the feed service keeps a small per-user list of followed pull-mode authors and fetches their recent posts. These reads are extremely hot, so they're served from the post cache with request coalescing, and 80M readers become a handful of cache hits per node.</p>
          <p>The threshold shouldn't be a single hardcoded number. It should depend on active followers and fan-out lag. There's also a transition problem: when an account crosses the threshold, its existing pushed entries remain and the read-side merge must dedupe by postId.</p>
        </>}
        followUps={['How do you pick the threshold?', 'What if a reader follows 500 celebrities?', 'How does ranking change the cache?']}
      />
      <InterviewQuestion
        q="How do you paginate a feed while new posts keep arriving at the top?"
        senior={<p>Use cursor-based pagination with the last post's timestamp instead of an offset, so new posts don't shift the pages.</p>}
        staff={<>
          <p>A cursor encodes (score, postId). The ID breaks ties between posts with the same timestamp, and the upper bound is exclusive. New posts appear through a separate “N new posts” poll or push, never by shifting the current page.</p>
          <p>With ranked feeds, scores aren't monotonic, so I'd snapshot the ranked candidate list server-side for a session (a short TTL key) and page through the snapshot. Otherwise re-ranking between requests produces duplicates.</p>
        </>}
      />

      <KeyTakeaways items={[
        'The core trade-off is doing the work at write time (push) or at read time (pull). At scale the answer is a hybrid.',
        'Store IDs, not posts, in feeds. Hydrate at read time so edits, deletes, and privacy are always current.',
        'Fan-out inserts are about 200× the post rate. Skipping inactive users is the biggest lever.',
        'Cursor pagination with (score, id) tiebreaks. Snapshot ranked feeds per session.',
        'Fan-out lag is an operational SLO. Shed load by moving authors to pull mode dynamically.',
      ]} />
    </>
  )
}
