import {
  References,
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeInstagramIdDemo } from './demos/episode-instagram-id-demo'
import { INSTAGRAM_STAGES } from './demos/episode-instagram-stages'

const POST_NODES: ArchNode[] = [
  { id: 'app', label: 'Mobile app', kind: 'client', x: 10, y: 50 },
  { id: 'web', label: 'App servers', kind: 'service', x: 32, y: 50,
    detail: 'Authenticates, hands the client an upload URL, and writes the post row once the media is stored.' },
  { id: 'shard', label: 'Author’s shard', sub: 'Postgres', kind: 'db', x: 58, y: 18,
    detail: 'The post row lives on the author’s logical shard. Its ID is generated there and encodes time and shard.' },
  { id: 'media', label: 'Object storage', kind: 'storage', x: 58, y: 50, detail: 'Originals and every rendition. The CDN pulls from here; app servers never proxy image bytes.' },
  { id: 'q', label: 'Task queue', kind: 'queue', x: 58, y: 82 },
  { id: 'workers', label: 'Workers', sub: 'resize · fan-out', kind: 'worker', x: 84, y: 82,
    detail: 'Generate renditions, run safety checks, and push the new post ID into followers’ feed lists (except for very large accounts).' },
  { id: 'feeds', label: 'Feed lists', sub: 'in memory', kind: 'cache', x: 84, y: 34 },
]
const POST_EDGES: ArchEdge[] = [
  { from: 'app', to: 'web' }, { from: 'web', to: 'media' }, { from: 'web', to: 'shard' },
  { from: 'web', to: 'q', async: true }, { from: 'q', to: 'workers' }, { from: 'workers', to: 'feeds' }, { from: 'workers', to: 'media' },
]

// Primary public sources behind the “In the real world” notes.
const REFS: Reference[] = [
  { title: "What Powers Instagram: Hundreds of Instances, Dozens of Technologies", source: "Instagram Engineering", year: 2011, url: "https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad", kind: "blog" },
  { title: "Sharding & IDs at Instagram", source: "Instagram Engineering", year: 2011, url: "https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c", kind: "blog" },
  { title: "See Posts You Care About First in Your Feed", source: "Instagram", year: 2016, url: "https://about.instagram.com/blog/announcements/see-posts-you-care-about-first-in-your-feed", kind: "blog" },
  { title: "Introducing Instagram Stories", source: "Instagram", year: 2016, url: "https://about.instagram.com/blog/announcements/introducing-instagram-stories", kind: "blog" },
  { title: "Introducing Instagram Reels", source: "Instagram", year: 2020, url: "https://about.instagram.com/blog/announcements/introducing-instagram-reels-announcement", kind: "blog" },
  { title: "How Facebook encodes your videos", source: "Engineering at Meta", year: 2021, url: "https://engineering.fb.com/2021/04/05/video-engineering/how-facebook-encodes-your-videos/", kind: "blog" },
  { title: "Instagram Migrates from Amazon’s Cloud into Facebook Data Centers", source: "Data Center Knowledge", year: 2014, url: "https://www.datacenterknowledge.com/cloud/instagram-migrates-from-amazon-s-cloud-into-facebook-data-centers", kind: "blog", note: "secondary source" },
  { title: "How Instagram is scaling its infrastructure across the ocean", source: "Opensource.com (Instagram engineer)", year: 2018, url: "https://opensource.com/article/18/10/instagram-scaled-infrastructure", kind: "blog" },
]

export default function InstagramEpisode() {
  return (
    <>
      <p>
        Instagram’s core loop is simple: post a photo, see your friends’ photos. The engineering story is about
        three growth walls hit in quick succession: <strong>media bytes</strong>, a <strong>database</strong> that
        can’t stay on one machine, and a <strong>feed</strong> that must feel instant for hundreds of millions of
        people. It is also a classic example of a small team getting very far with boring, well-understood tools.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Notice how many stages are solved by <em>moving work out of the request</em>: to a CDN, a queue, or a
        precomputed list. Spotting that move is half of most system design interviews.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Instagram; all trademarks belong to their owners.</em></p>

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={INSTAGRAM_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <EstimationTable
        assumptions={['Illustrative: 500M daily active users', '100M new posts/day, ~2 MB stored per post across renditions', 'Each user opens the feed 10×/day']}
        rows={[
          { label: 'Post writes', math: '100M / 86,400 s', result: '≈ 1.2K/s' },
          { label: 'Feed reads', math: '500M × 10 / 86,400 s', result: '≈ 58K/s avg' },
          { label: 'Read : write', math: '58K : 1.2K', result: '≈ 50 : 1' },
          { label: 'New media / day', math: '100M × 2 MB', result: '≈ 200 TB' },
          { label: 'Post IDs per ms per shard', math: '2¹⁰ sequence', result: '1,024 max' },
        ]}
      />
      <p>
        Metadata writes are small. <strong>Media volume</strong> and <strong>feed reads</strong> dominate, which is why
        the answers are object storage + CDN and precomputed feeds, not a faster database.
      </p>

      <H2 id="post-a-photo">What happens when you tap Share</H2>
      <ArchitectureDiagram nodes={POST_NODES} edges={POST_EDGES} height={380}
        caption="The request path stays short; everything expensive is queued"
        flows={[
          { name: 'Upload', path: ['app', 'web', 'media'], steps: ['App asks for an upload slot', 'Bytes go to object storage (often directly from the phone)'] },
          { name: 'Publish', path: ['app', 'web', 'shard'], steps: ['App confirms the post', 'Row written on the author’s shard with a time-sortable ID'] },
          { name: 'Fan-out', path: ['web', 'q', 'workers', 'feeds'], steps: ['Server enqueues follow-up work', 'Workers pick it up', 'Post ID pushed into followers’ feed lists'] },
        ]} />

      <H2 id="ids">Deep dive: IDs that encode time and location</H2>
      <p>
        Once posts live on many databases, auto-increment IDs collide and a central ticket server becomes a
        dependency on every write. Instagram’s published answer generates the ID <em>in the shard itself</em>:
        milliseconds since a custom epoch, then the logical shard ID, then a per-shard sequence. IDs sort by time,
        and the shard is readable from the ID with no lookup.
      </p>
      <EpisodeInstagramIdDemo />
      <Callout kind="tip">
        Logical shards are the trick that makes resharding cheap. You pick a large fixed number of them up front
        (e.g. 8,192) and only change which physical host holds each one. The user → shard mapping never changes, so
        no row ever gets a new key.
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Database scaling', cells: ['Many logical shards on few hosts', 'Hash by number of servers', 'Adding hosts moves whole shards; keys never change'] },
          { label: 'IDs', cells: ['Time | shard | sequence, made in the DB', 'Central ticket server / UUIDv4', 'No extra service on the write path; time-sortable; 64-bit fits indexes'] },
          { label: 'Media', cells: ['Object storage + CDN + async workers', 'Serve from app servers', 'Bytes dominate traffic; resizing must not block uploads'] },
          { label: 'Feed', cells: ['Hybrid fan-out + ranking', 'Pure pull at read time', 'Reads outnumber writes about 50:1; pull only for very large accounts'] },
          { label: 'Stories', cells: ['In-memory with TTLs', 'Rows + nightly cleanup jobs', 'Hot for hours then dead; let expiry do deletion'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Choose boring technology on purpose.</strong> A well-understood relational database, sharded carefully, carried Instagram very far. Say why you’d pick known tools over novel ones for a small team.</li>
          <li><strong>Plan the reshard before you need it.</strong> Over-provisioning logical shards is cheap on day one and saves a painful migration later.</li>
          <li><strong>IDs are an API.</strong> Once clients store and sort by them, the bit layout is effectively permanent. Reserve headroom (time range, shard count, sequence).</li>
          <li><strong>Move work out of the request path</strong> (CDN, queues, precomputed lists), then build the observability to know when those async paths fall behind.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="Design primary keys for a posts table sharded across many Postgres servers."
        senior={<p>Use a Snowflake-style ID service that combines a timestamp, a machine ID, and a sequence, so IDs are unique and roughly sorted by time. Alternatively use UUIDs.</p>}
        staff={<>
          <p>I’d avoid a separate ID service on the write path. Generate the ID <strong>inside each shard</strong> from time bits, the logical shard ID, and a local sequence (e.g. 41/13/10). IDs are unique without coordination, sortable by time for feed pagination, and route to their shard directly, which also makes lookup-by-ID a single hop.</p>
          <p>Then the constraints: 1,024 IDs per millisecond per shard (wait for the next ms when exhausted), clock skew between hosts (monotonic within a shard is what matters), and a time field sized for decades. I’d explicitly reject UUIDv4 here: random keys fragment B-tree indexes and can’t be paginated by time.</p>
        </>}
        followUps={['What happens if a host clock goes backwards?', 'How would you move logical shard 1,341 to a new host with no downtime?', 'How do you fetch one user’s posts efficiently?']}
      />
      <InterviewQuestion
        q="How would you serve Stories to hundreds of millions of daily viewers?"
        senior={<p>Store stories in a database with a 24-hour expiry and cache the active ones in Redis. Use a CDN for the media.</p>}
        staff={<>
          <p>Model the access pattern first: huge read spike right after posting, zero value after 24 hours, and per-viewer “seen” state that dwarfs the stories themselves. So the active set lives <strong>in memory with TTLs</strong>, the tray is a precomputed per-user list of followees with active stories, and media is prefetched through the CDN.</p>
          <p>Seen state can be approximate and compact (per viewer, per author, a watermark timestamp rather than per-story rows). I’d also stagger expiry work so billions of keys don’t expire in the same second, and keep an archive path if the product needs “highlights”.</p>
        </>}
        followUps={['How do you order the tray?', 'What if the cache cluster restarts?', 'How would you support story replies and reactions?']}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Move bytes to object storage + CDN and heavy work to async queues early; it keeps the request path small.',
        'Shard by user into many logical shards mapped onto fewer hosts; reshard by moving shards, never re-keying rows.',
        'Generate IDs inside the shard: time | shard | sequence gives uniqueness, time order, and routing in one integer.',
        'Feeds are precomputed for the common case and pulled for huge accounts, then ranked.',
        'Ephemeral content belongs in memory with TTLs; let expiry delete for you.',
      ]} />
    </>
  )
}
