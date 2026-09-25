import {
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode } from '../components/ui'
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

export default function DiscordEpisode() {
  return (
    <>
      <p>
        Discord looks like a chat app, but it is really two hard systems stitched together. One is a
        <strong> real-time fan-out engine</strong> holding millions of open sockets. The other is a
        <strong> message archive</strong> that must return the latest page of any channel instantly, even when a
        channel is on fire. This episode grows both from a single server.
      </p>
      <Callout kind="info" title="How to watch this episode">
        At each stage, ask yourself: <em>who owns this piece of state, and how many copies of each event get made?</em>{' '}
        Almost every decision here is an answer to one of those two questions.
      </Callout>

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={DISCORD_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
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
        Writes are modest. <strong>Fan-out and hot reads</strong> are the real multipliers, which is why the two
        biggest redesigns in this story (lazy delivery and data services) attack those, not raw write throughput.
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
        When a huge server posts an announcement, thousands of clients request the <em>same</em> channel history
        within a second. Without protection, each one is a database query against the same partition. A data-service
        tier that routes by channel can keep <strong>one query in flight per channel</strong> and hand the result to
        everyone waiting. That only works if every request for that channel reaches the same instance.
      </p>
      <EpisodeDiscordCoalescingDemo />
      <Callout kind="pitfall">
        Coalescing without affinity is a common interview slip. If a load balancer spreads a hot key randomly across
        N instances, you still send N queries per window. Pair coalescing with consistent-hash routing by key.
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Server state', cells: ['One process owns each guild', 'Shared DB + stateless workers', 'Permissions and fan-out need a single consistent view; memory beats round-trips'] },
          { label: 'Sending path', cells: ['HTTP API, then fan out', 'Send over the socket', 'Stateless writes are easy to rate-limit, retry, and scale separately from sockets'] },
          { label: 'Message storage', cells: ['Wide-column, (channel, bucket)', 'Sharded SQL', 'The main query is “latest N in one channel”: one sequential partition read'] },
          { label: 'Hot reads', cells: ['Data services + coalescing', 'Bigger cache in front', 'Merges duplicate in-flight reads at the source and protects the DB from stampedes'] },
          { label: 'Voice', cells: ['SFU media servers', 'Peer-to-peer mesh / MCU', 'Mesh collapses past a few peers; MCU transcoding costs too much CPU'] },
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

      <KeyTakeaways items={[
        'Separate socket holding (gateways) from state ownership (one process per guild).',
        'Send writes over stateless HTTP; use the socket for fan-out.',
        'Fan out only to sessions that are online and viewing; everyone else catches up on demand.',
        'Model storage on the dominant query: latest messages per channel, partitioned by (channel, time bucket).',
        'Hot keys need affinity + request coalescing, not just more cache.',
        'Voice is a separate SFU fleet placed by latency.',
      ]} />
    </>
  )
}
