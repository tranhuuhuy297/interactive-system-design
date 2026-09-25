import {
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, MentalModel, References, SideBySide, StatRow, Term, TLDR, VisualTimeline,
} from '../components/ui'
import { Building2, Code, Database, Globe, Globe2, Hash, Server, Sparkles, Video } from 'lucide-react'
import type { ArchEdge, ArchNode } from '../components/ui'
import { IG_REFS } from './demos/episode-instagram-sources'
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

const TIMELINE = [
  { year: '2010', what: 'Launch: Django + one PostgreSQL database' },
  { year: '2011', what: 'Load balancer, S3 + CloudFront, Redis feeds, async workers, sharded Postgres' },
  { year: '2012', what: 'Acquired by Facebook; Cassandra for write-heavy data' },
  { year: '2013–14', what: 'Live migration from AWS into Facebook data centers' },
  { year: '2015–16', what: 'Three data centers; ranked feed; Stories' },
  { year: '2017', what: 'Python runtime tuning and full move to Python 3' },
  { year: '2018', what: 'Data centers in Europe with regional partitions' },
  { year: '2020–21', what: 'Reels and watch-time-driven encoding' },
]

const TIMELINE_ICONS = [Database, Globe, Building2, Server, Sparkles, Code, Globe2, Video]

export default function InstagramEpisode() {
  return (
    <>
      <TLDR items={[
        'Instagram scaled far on boring tools: Django, PostgreSQL, Redis, and memcached.',
        'Photo bytes go to object storage and a CDN; slow work goes to background workers.',
        'Postgres is split into thousands of logical shards; each shard mints its own sortable IDs.',
        'Feeds are precomputed lists, later ranked by a model.',
        'Growth forced a live move into Facebook’s data centers, then multiple regions.',
      ]} />
      <MentalModel id="ep-instagram" />
      <p>
        Instagram’s core loop is simple: post a photo, see friends’ photos. The engineering story is three growth
        walls in quick succession: <strong>media bytes</strong>, a <strong>database</strong> that outgrew one
        machine, and a <strong>feed</strong> that must feel instant.
      </p>
      <p>
        It is also a classic example of a small team going far with well-understood tools. Watch for{' '}
        <Term def="Split data into many fixed buckets (logical shards) and map buckets to fewer servers, so growth moves buckets instead of re-keying rows.">logical sharding</Term>{' '}
        and <Term def="Pushing a new post ID into each follower’s feed list at write time, so reading the feed is cheap.">fan-out on write</Term>.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Notice how many stages <em>move work out of the request</em>: to a CDN, a queue, or a precomputed list.
        Spotting that move is half of most system design interviews. Open “Go deeper” on any stage for details.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Instagram or Meta; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <VisualTimeline items={TIMELINE.map((t, i) => ({ when: t.year, title: t.what, icon: TIMELINE_ICONS[i] }))} />

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={INSTAGRAM_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <StatRow caption="Illustrative estimates from the assumptions below" stats={[{ value: '≈ 1.2K / s', label: 'post writes', note: 'estimate' }, { value: '≈ 50 : 1', label: 'feed reads per post write', note: 'estimate' }, { value: '≈ 200 TB / day', label: 'new media stored', note: 'estimate' }]} />
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
        Metadata writes are small. <strong>Media volume</strong> and <strong>feed reads</strong> dominate. So the
        answers are object storage, a CDN, and precomputed feeds, not a faster database.
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
        Once posts live on many databases, auto-increment IDs collide. A central ticket server would add a dependency
        to every write.
      </p>
      <p>
        Instagram’s published answer builds the ID <em>inside the shard</em>: milliseconds since a custom epoch, then
        the logical shard ID, then a per-shard sequence. IDs sort by time, and the shard is readable from the ID.
      </p>
      <EpisodeInstagramIdDemo />
      <Callout kind="tip">
        Logical shards are the trick that makes resharding cheap. You pick a large fixed number of them up front
        (e.g. 8,192) and only change which physical host holds each one. The user → shard mapping never changes, so
        no row ever gets a new key.
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <p>The three decisions that let a small team scale:</p>
      <SideBySide panels={[
        { title: 'Many logical shards on few hosts', icon: Server, tone: 'good', points: ['+ Adding hosts moves whole shards', '+ Keys never change', '- Instead of: hashing by number of servers'], verdict: 'Database scaling' },
        { title: 'Time | shard | sequence IDs, made in the DB', icon: Hash, tone: 'good', points: ['+ No extra service on the write path', '+ Time-sortable, fits 64 bits', '- Instead of: a ticket server or UUIDv4'], verdict: 'IDs' },
        { title: 'Object storage + CDN + async workers', icon: Globe, tone: 'good', points: ['+ Bytes dominate traffic', '+ Resizing never blocks uploads', '- Instead of: serving media from app servers'], verdict: 'Media' },
      ]} />
      <p>Other decisions, in brief:</p>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
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
      <References items={IG_REFS} />

      <KeyTakeaways items={[
        'Move bytes to object storage + CDN and heavy work to async queues early; it keeps the request path small.',
        'Shard by user into many logical shards mapped onto fewer hosts; reshard by moving shards, never re-keying rows.',
        'Generate IDs inside the shard: time | shard | sequence gives uniqueness, time order, and routing in one integer.',
        'Feeds are precomputed for the common case and pulled for huge accounts, then ranked.',
        'Ephemeral content belongs in memory with TTLs; let expiry delete for you.',
        'Going multi-region means classifying data as global or local and giving users a home region for writes.',
      ]} />
    </>
  )
}
