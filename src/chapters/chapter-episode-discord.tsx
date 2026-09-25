import {
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, MentalModel, References, SideBySide, StatRow, Term, TLDR, VisualTimeline,
} from '../components/ui'
import { Database, HardDrive, Layers, Mic, Radio, Search, Server, Users, Zap } from 'lucide-react'
import type { ArchEdge, ArchNode } from '../components/ui'
import { DISCORD_REFS } from './demos/episode-discord-sources'
import { EpisodeDiscordCoalescingDemo } from './demos/episode-discord-coalescing-demo'
import { DISCORD_STAGES } from './demos/episode-discord-stages'

const SEND_NODES: ArchNode[] = [
  { id: 'sender', label: 'Sender', kind: 'client', x: 10, y: 22 },
  { id: 'api', label: 'HTTP API', sub: 'auth · rate limit', kind: 'service', x: 32, y: 22,
    detail: 'Checks permissions and per-user and per-channel rate limits, assigns a time-sortable message ID, and persists before acknowledging.' },
  { id: 'ds', label: 'Data service', sub: 'owns channel', kind: 'service', x: 56, y: 22,
    detail: 'Requests are routed by channel ID with consistent hashing, so all traffic for one channel meets in one place and duplicate reads can be merged.' },
  { id: 'db', label: 'Messages store', sub: '(channel, bucket)', kind: 'db', x: 82, y: 22 },
  { id: 'guild', label: 'Guild process', sub: 'single owner', kind: 'service', x: 56, y: 62,
    detail: 'The authoritative in-memory state for one server: members, roles, channels, and which sessions are watching what.' },
  { id: 'gw', label: 'Gateway', sub: 'sockets', kind: 'lb', x: 32, y: 82, detail: 'Holds long-lived WebSockets, handles heartbeats and resume after short disconnects, and compresses payloads.' },
  { id: 'recv', label: 'Receivers', sub: 'online + viewing', kind: 'client', x: 10, y: 62 },
]
const SEND_EDGES: ArchEdge[] = [
  { from: 'sender', to: 'api' }, { from: 'api', to: 'ds' }, { from: 'ds', to: 'db' },
  { from: 'api', to: 'guild', async: true }, { from: 'guild', to: 'gw' }, { from: 'gw', to: 'recv' },
]

const TIMELINE = [
  { year: '2015', what: 'Launch; one MongoDB replica set' },
  { year: '2015–17', what: 'Elixir gateway + guild processes; messages move to Cassandra' },
  { year: '2017', what: 'Search on many small Elasticsearch clusters; cheaper fan-out' },
  { year: '2018', what: 'Voice on a homegrown C++ SFU fleet' },
  { year: '2019', what: 'Lazy member lists with a Rust NIF' },
  { year: '2020', what: 'Read States rewritten from Go to Rust' },
  { year: '2022', what: 'Rust data services + ScyllaDB; “super-disks”' },
  { year: '2023', what: 'Relays and passive sessions for million-online servers' },
]

const TIMELINE_ICONS = [Database, Server, Search, Mic, Users, Zap, HardDrive, Radio]

export default function DiscordEpisode() {
  return (
    <>
      <TLDR items={[
        'Discord is two systems: a real-time fan-out engine and a message archive.',
        'Gateways hold sockets; one process per server (“guild”) owns its state.',
        'Messages live in a wide-column store keyed by channel and time bucket.',
        'Hot channels are tamed by routing each channel to one place and merging duplicate reads.',
        'Huge servers work because only people actually looking get live updates.',
      ]} />
      <MentalModel id="ep-discord" />
      <p>
        Discord looks like a chat app. Underneath are two hard systems. One is a <strong>fan-out engine</strong> that
        holds millions of open sockets. The other is a <strong>message archive</strong> that must return the latest
        page of any channel instantly, even when that channel is on fire.
      </p>
      <p>
        This episode grows both from a single server, in the order Discord actually hit each wall. Along the way you
        will meet <Term def="A server-side unit that forwards each speaker’s media stream to listeners without mixing it.">SFUs</Term>,{' '}
        <Term def="Merging identical in-flight requests so the database answers once and everyone waiting gets the result.">request coalescing</Term>,
        and <Term def="A partition key that receives far more traffic than others, overloading the replicas that hold it.">hot partitions</Term>.
      </p>
      <Callout kind="info" title="How to watch this episode">
        At each stage, ask two questions. <em>Who owns this piece of state?</em> And <em>how many copies of each event
        get made?</em> Open “Go deeper” for the step-by-step flow, numbers, and sources.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Discord; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <VisualTimeline items={TIMELINE.map((t, i) => ({ when: t.year, title: t.what, icon: TIMELINE_ICONS[i] }))} />

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={DISCORD_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <StatRow caption="Illustrative estimates from the assumptions below" stats={[{ value: '≈ 46K / s', label: 'messages written on average', note: 'estimate' }, { value: '≈ 12 TB / day', label: 'message storage with replicas', note: 'estimate' }, { value: '100K → 5K', label: 'pushes for one big-server message', note: 'lazy fan-out, estimate' }]} />
      <EstimationTable
        assumptions={['Illustrative: 10M concurrent connections at peak', '4B messages/day, ~1 KB each with metadata', 'Replication factor 3', 'Big-server message: 100K members, ~5% online and viewing']}
        rows={[
          { label: 'Average write rate', math: '4B / 86,400 s', result: '≈ 46K msg/s' },
          { label: 'Peak write rate', math: '46K × 3', result: '≈ 140K msg/s' },
          { label: 'Storage / day', math: '4B × 1 KB × 3 replicas', result: '≈ 12 TB' },
          { label: 'Naive fan-out, big server', math: '100K members × 1 msg', result: '100K pushes' },
          { label: 'Lazy fan-out', math: '100K × 5% viewing', result: '≈ 5K pushes' },
        ]}
      />
      <p>
        Writes are modest. <strong>Fan-out and hot reads</strong> are the real multipliers. That is why the biggest
        redesigns in this story (lazy delivery, relays, data services) attack those, not raw write throughput.
      </p>

      <H2 id="send-a-message">What happens when you hit Enter</H2>
      <ArchitectureDiagram nodes={SEND_NODES} edges={SEND_EDGES} height={380}
        caption="Persist first, then fan out. A message is acknowledged only once it is durable."
        flows={[
          { name: 'Persist', path: ['sender', 'api', 'ds', 'db'], steps: ['Client POSTs the message', 'API validates and routes by channel', 'Data service writes it to the channel’s partition'] },
          { name: 'Fan out', path: ['api', 'guild', 'gw', 'recv'], steps: ['API publishes the event to the guild process', 'Guild picks the sessions that should see it', 'Gateways push it down open sockets'] },
        ]} />

      <H2 id="coalescing">Deep dive: surviving a hot channel</H2>
      <p>
        A huge server posts an announcement. Within a second, thousands of clients request the <em>same</em> channel
        history. Without protection, each request is a database query on the same partition.
      </p>
      <p>
        A data-service tier that routes by channel can keep <strong>one query in flight per channel</strong>. Everyone
        waiting gets that one result. This only works if every request for the channel reaches the same instance.
      </p>
      <EpisodeDiscordCoalescingDemo />
      <Callout kind="pitfall">
        Coalescing without affinity is a common interview slip. If a load balancer spreads a hot key randomly across
        N instances, you still send N queries per window. Pair coalescing with consistent-hash routing by key.
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <p>The three decisions that tame fan-out and hot reads:</p>
      <SideBySide panels={[
        { title: 'One process owns each guild', icon: Users, tone: 'good', points: ['+ A single consistent view for permissions and fan-out', '+ Memory beats round-trips', '- Instead of: a shared DB with stateless workers'], verdict: 'Server state' },
        { title: 'Data services + request coalescing', icon: Layers, tone: 'good', points: ['+ Merges duplicate in-flight reads', '+ Protects the DB from stampedes', '- Instead of: a bigger cache in front'], verdict: 'Hot reads' },
        { title: 'SFU media servers', icon: Mic, tone: 'good', points: ['+ Scales past a few peers without transcoding', '- Instead of: a peer-to-peer mesh or MCU'], verdict: 'Voice' },
      ]} />
      <p>Other decisions, in brief:</p>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Sending path', cells: ['HTTP API, then fan out', 'Send over the socket', 'Stateless writes are easy to rate-limit, retry, and scale separately from sockets'] },
          { label: 'Message storage', cells: ['Wide-column, (channel, bucket)', 'Sharded SQL', 'The main query is “latest N in one channel”: one sequential partition read'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Design for the skew, not the average.</strong> Most servers are tiny. The architecture is shaped by the rare million-member server and the one channel everyone opens at once.</li>
          <li><strong>Single owner per entity</strong> (guild process, channel-owning data service) turns distributed coordination into local logic. Name the price: hotspots and failover of that owner.</li>
          <li><strong>Migrations are the real project.</strong> Swapping the message store for trillions of rows needs dual writes or backfill, verification, and a rollback plan. Talk about that, not just the target system.</li>
          <li><strong>Different planes, different fleets.</strong> Chat, storage, and voice scale on different curves and fail differently; keep them separable.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="How would you deliver messages in real time to a server with a million members?"
        senior={<p>Keep WebSocket connections on a gateway tier and use pub/sub so each gateway subscribes to the channels its users are in. Publish each message once, and gateways push it to their clients.</p>}
        staff={<>
          <p>First, cut the audience: only sessions that are <strong>online and viewing</strong> that server or channel get pushes. Everyone else reconciles on focus or reconnect. That alone can shrink fan-out by an order of magnitude or more.</p>
          <p>Then make ownership explicit. One owner holds the server’s authoritative state; fan-out is sharded across relays, each responsible for a slice of sessions, so no single process is CPU-bound. I’d rate-limit events per server, batch or debounce presence and typing updates, and measure p99 delivery lag per server-size bucket. The mean hides exactly the servers that hurt.</p>
        </>}
        followUps={['What happens to state when the owning process crashes?', 'How do clients resume after a 30-second disconnect without missing messages?', 'How would you shard presence?']}
      />
      <InterviewQuestion
        q="Your message database shows p99 spikes whenever a large community posts an announcement. Walk me through it."
        senior={<p>It’s a hot partition. Add caching for recent messages in hot channels and maybe split the partition by smaller time buckets.</p>}
        staff={<>
          <p>I’d confirm it with per-partition metrics: reads concentrated on one <code>(channel, bucket)</code> key at announcement time. Caches help, but the stampede often arrives before the cache is warm. So I’d add a routing layer that sends all requests for a channel to one owner and <strong>coalesces</strong> identical in-flight reads, which bounds DB load per hot key to about one query per latency window.</p>
          <p>Separately, I’d look at store-level causes, such as compaction debt and GC pauses that amplify the tail, and evaluate whether the storage engine fits the workload. Any engine change is a staged migration with shadow reads and verification.</p>
        </>}
        followUps={['What consistency does a coalesced read give you?', 'How do you pick the time bucket size?', 'How would you migrate trillions of rows with zero downtime?']}
      />

      <H2 id="references">Sources</H2>
      <References items={DISCORD_REFS} />

      <KeyTakeaways items={[
        'Separate socket holding (gateways) from state ownership (one process per guild).',
        'Send writes over stateless HTTP; use the socket for fan-out.',
        'Fan out only to sessions that are online and viewing; everyone else catches up on demand.',
        'Model storage on the dominant query: latest messages per channel, partitioned by (channel, time bucket).',
        'Hot keys need affinity + request coalescing, not just more cache.',
        'Voice is a separate SFU fleet placed by latency.',
        'Million-member servers need passive sessions and relays that split fan-out across machines.',
      ]} />
    </>
  )
}
