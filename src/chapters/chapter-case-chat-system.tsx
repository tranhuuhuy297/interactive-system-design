import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode } from '../components/ui'
import { ChatConnectionRoutingDemo } from './demos/chat-connection-routing-demo'
import { ChatOrderingSyncDemo } from './demos/chat-ordering-sync-demo'

const NODES: ArchNode[] = [
  { id: 'a', label: 'Sender', sub: 'app', kind: 'client', x: 6, y: 28 },
  { id: 'b', label: 'Recipient', sub: 'app', kind: 'client', x: 6, y: 78 },
  { id: 'lb', label: 'L4 load balancer', sub: 'long-lived TCP', kind: 'lb', x: 21, y: 52,
    detail: 'Layer-4 (TCP) balancing is enough, since the socket stays pinned once upgraded. Balance on connection count, not request count.' },
  { id: 'gw1', label: 'WS gateway 1', sub: 'stateful', kind: 'service', x: 38, y: 28,
    detail: 'Holds hundreds of thousands of idle sockets. It only terminates connections and relays frames, with no business logic, so it rarely needs redeploying.' },
  { id: 'gw2', label: 'WS gateway 2', sub: 'stateful', kind: 'service', x: 38, y: 78 },
  { id: 'chat', label: 'Chat service', sub: 'stateless', kind: 'service', x: 58, y: 52,
    detail: 'Assigns a per-conversation sequence number, persists, ACKs the sender, then routes to recipients\' gateways. Dedupes on clientMsgId so retries are safe.' },
  { id: 'reg', label: 'Session registry', sub: 'Redis: user → gateway', kind: 'cache', x: 76, y: 16,
    detail: 'Written on connect, deleted on disconnect, with a TTL refreshed by heartbeats so crashed gateways don\'t leave ghosts.' },
  { id: 'ps', label: 'Pub/sub', sub: 'channel per gateway', kind: 'queue', x: 58, y: 88,
    detail: 'Each gateway subscribes to its own channel. The chat service publishes to the recipient\'s gateway, so there is no all-to-all mesh.' },
  { id: 'store', label: 'Message store', sub: 'Cassandra / ScyllaDB', kind: 'db', x: 93, y: 52,
    detail: 'Partition = (conversationId, time bucket), clustering = seq DESC. Writes append, and reads fetch the newest page. This shape suits wide-column stores well.' },
  { id: 'push', label: 'Push service', sub: 'APNs / FCM', kind: 'external', x: 88, y: 88,
    detail: 'Used only when the recipient has no live socket.' },
]

const EDGES: ArchEdge[] = [
  { from: 'a', to: 'lb' }, { from: 'b', to: 'lb' }, { from: 'lb', to: 'gw1' }, { from: 'lb', to: 'gw2' },
  { from: 'gw1', to: 'chat' }, { from: 'chat', to: 'reg' }, { from: 'chat', to: 'store' },
  { from: 'chat', to: 'ps' }, { from: 'ps', to: 'gw2' }, { from: 'chat', to: 'push', async: true },
]

export default function ChatSystemChapter() {
  return (
    <>
      <p>
        Chat is the classic <strong>stateful connection</strong> problem. Unlike request/response services, every
        online user holds a long-lived socket pinned to one machine, so “which server is Bob on?” becomes a
        first-class question. Around that sit three hard guarantees: messages are <strong>never lost</strong>,
        they show up <strong>in order</strong>, and every device ends up with the <strong>same history</strong>.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['1:1 and group chat (groups ≤ 500 members)', 'Delivery + read receipts', 'Online presence', 'Multi-device with shared history', 'Push notification when offline']}
        nonFunctional={['100M DAU, ~40 messages per user per day', 'Delivery p99 < 200 ms when both online', 'Durable: an ACKed message is never lost', 'Per-conversation ordering']}
        outOfScope={['Voice / video calls', 'Large broadcast channels (discussed as an extension)']}
      />

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['100M DAU × 40 messages/day; ~200 B per message with metadata', 'Half of DAU connected at peak', 'A tuned gateway holds on the order of 500K idle sockets (varies with memory and TLS)']}
        rows={[
          { label: 'Messages/sec', math: '4B / 86,400', result: '≈ 46K/s' },
          { label: 'Peak', math: '46K × 3', result: '≈ 140K/s' },
          { label: 'Concurrent sockets', math: '100M × 50%', result: '≈ 50M' },
          { label: 'Gateways', math: '50M / 500K (+ headroom)', result: '≈ 100–150' },
          { label: 'Storage per year', math: '4B × 200 B × 365', result: '≈ 290 TB' },
        ]}
      />
      <p>The QPS is modest. The difficulty is <strong>connection count</strong> and <strong>storage growth</strong>, so the design centers on gateways and a write-optimized store.</p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'WS', path: '/v1/connect', desc: 'Upgrade to WebSocket. Auth once at handshake, then heartbeat every ~30 s.', returns: 'bidirectional frames' },
        { method: 'WS', path: 'frame: send', desc: 'Client → server message. clientMsgId makes retries idempotent.', body: '{ clientMsgId, conversationId, body }', returns: 'ack { clientMsgId, seq }' },
        { method: 'GET', path: '/v1/sync', desc: 'Catch up after reconnect: everything past the device cursor, across conversations.', body: '?after={cursor}&limit=500', returns: '{ messages[], nextCursor }' },
        { method: 'POST', path: '/v1/conversations/{id}/read', desc: 'Advance the read marker, which fans out as a receipt.', body: '{ upToSeq }', returns: '204' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Gateways are stateful but thin; all logic lives in the stateless chat service"
        flows={[
          { name: 'Recipient online', path: ['a', 'lb', 'gw1', 'chat', 'ps', 'gw2', 'b'],
            steps: ['Sender writes a frame', 'Already-open socket through the L4 LB', 'Gateway 1 relays to the chat service', 'Assign seq, persist, ACK sender; registry says the recipient is on gateway 2', 'Publish on gateway 2\'s channel', 'Gateway 2 pushes down the recipient\'s socket'] },
          { name: 'Recipient offline', path: ['a', 'lb', 'gw1', 'chat', 'push'],
            steps: ['Sender writes a frame', 'Through the LB', 'To the chat service', 'Persisted; the registry has no session, so trigger a push notification'] },
          { name: 'Reconnect & sync', path: ['b', 'lb', 'gw2', 'chat', 'store'],
            steps: ['App reconnects (with jittered backoff)', 'Routed to any gateway', 'Registry updated; client calls sync(after=cursor)', 'Chat service reads everything past the cursor'] },
        ]} />

      <H2 id="connections">5 · Deep dive: connections and routing</H2>
      <CompareTable
        columns={['Short polling', 'Long polling', 'SSE', 'WebSocket']}
        rows={[
          { label: 'Direction', cells: ['Client pull', 'Client pull (held)', 'Server → client', 'Full duplex'] },
          { label: 'Latency', cells: ['Poll interval', 'Near real-time', 'Real-time', 'Real-time'] },
          { label: 'Overhead', cells: ['Very high (empty responses)', 'Reconnect per message', 'Low', 'Lowest per message'] },
          { label: 'Fit for chat', cells: ['No', 'Fallback only', 'Receive only; sends via HTTP', 'Default choice'] },
        ]}
      />
      <ChatConnectionRoutingDemo />
      <Callout kind="warn">
        Deploying gateways drops their sockets. Without <strong>jittered reconnect backoff</strong> and connection
        draining, every client reconnects at once and hammers the auth and sync paths. This is a real incident
        pattern. Keep gateways thin so they rarely need to be redeployed.
      </Callout>

      <H2 id="ordering">6 · Deep dive: ordering, receipts, and sync</H2>
      <p>
        Wall clocks across devices can't be trusted for ordering. Instead, the chat service assigns a
        <strong> monotonically increasing sequence number per conversation</strong>. Each device keeps a
        <strong> cursor</strong>: the highest contiguous seq it has applied. That single number drives gap detection,
        offline sync, and delivery receipts.
      </p>
      <ChatOrderingSyncDemo />
      <CodeBlock lang="ts" title="idempotent send (server)" code={`
async function handleSend(userId: string, f: SendFrame): Promise<Ack> {
  // Retry-safe: the same clientMsgId always maps to the same seq.
  const existing = await dedupe.get(\`\${f.conversationId}:\${f.clientMsgId}\`)
  if (existing) return { clientMsgId: f.clientMsgId, seq: existing }

  const seq = await seqAllocator.next(f.conversationId)   // e.g. Redis INCR, or a LWT per conversation
  await store.append({ ...f, seq, senderId: userId, ts: Date.now() })
  await dedupe.set(\`\${f.conversationId}:\${f.clientMsgId}\`, seq, { ttlSec: 86_400 })
  void fanOut(f.conversationId, seq)                        // async; the ACK doesn't wait for delivery
  return { clientMsgId: f.clientMsgId, seq }
}`} />
      <Callout kind="tip">
        Delivery is <strong>at-least-once</strong> (retries, reconnect syncs). Display is effectively
        <strong> exactly-once</strong> because clients apply messages idempotently by seq. Say that sentence out loud
        in the interview.
      </Callout>

      <H2 id="groups-presence">7 · Deep dive: groups and presence</H2>
      <CompareTable
        columns={['Small groups (≤ ~500)', 'Large channels (10K+)']}
        rows={[
          { label: 'Delivery', cells: ['Fan out to each member\'s gateway', 'Fan-out on read: clients fetch from the channel log'] },
          { label: 'Receipts', cells: ['Per-member delivered/read', 'Aggregate counts only'] },
          { label: 'Cost driver', cells: ['Members × messages', 'Readers polling or subscribing'] },
        ]}
      />
      <p>
        <strong>Presence</strong> is a heartbeat with a TTL: each heartbeat refreshes <code>presence:user</code>{' '}
        with a TTL of about 2× the interval. Broadcasting every change to every friend explodes at scale, so push
        presence only to users <em>currently viewing</em> that contact, and debounce flapping connections so a
        subway tunnel doesn't produce 20 online/offline events.
      </p>

      <H2 id="data-model">8 · Data model</H2>
      <CodeBlock lang="ts" title="wide-column layout (CQL-style)" code={`
// messages: newest-first pages per conversation; bucket bounds partition size
// PRIMARY KEY ((conversation_id, bucket), seq)  WITH CLUSTERING ORDER BY (seq DESC)
type MessageRow = {
  conversationId: string
  bucket: number        // e.g. seq / 10_000 or month; keeps partitions under ~100 MB
  seq: bigint
  senderId: string
  clientMsgId: string
  body: Uint8Array      // ciphertext if end-to-end encrypted
  ts: number
}

// inbox: per-user list of conversations, ordered by last activity (drives the chat list)
// PRIMARY KEY (user_id, last_seq_ts) ...`} />

      <H2 id="staff">9 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>End-to-end encryption</strong> (Signal protocol) changes the design. The server stores ciphertext, so no server-side search, previews, or moderation. Multi-device needs per-device keys and fan-out of encrypted copies.</li>
          <li><strong>Multi-region</strong>: give each conversation a home region that owns its seq allocation. Cross-region users connect locally, and gateways forward to the home region.</li>
          <li><strong>Gateway failure</strong>: registry entries expire by TTL, clients reconnect elsewhere and sync by cursor, and no message is lost because persistence happened before the ACK.</li>
          <li><strong>Retention and compliance</strong>: per-conversation TTLs, legal hold, and deletion that propagates to all devices.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How do you guarantee messages appear in the same order on every device?"
        senior={<p>Timestamps from the client aren't reliable, so the server assigns a sequence number per conversation, and clients sort by it.</p>}
        staff={<>
          <p>A per-conversation seq comes from a single allocator: Redis INCR on a key, or a lightweight transaction on the conversation row. Ordering is only promised <em>within</em> a conversation. Global ordering is unnecessary and expensive.</p>
          <p>Clients track the highest contiguous seq. A gap triggers a hold plus a fetch of the missing range, and duplicates are dropped. This also gives offline sync (fetch after cursor) and receipts (compare cursors) for free. If the allocator is a bottleneck for one huge group, partition that conversation or relax to per-sender ordering, and say so explicitly.</p>
        </>}
        followUps={['What happens if the seq allocator fails over?', 'How do you order messages sent concurrently from two devices of the same user?']}
      />
      <InterviewQuestion
        q="A gateway holding 500K sockets crashes. Walk me through the recovery."
        senior={<p>Clients detect the disconnect, reconnect through the load balancer to another gateway, and fetch missed messages.</p>}
        staff={<>
          <p>Messages are durable before the ACK, so nothing is lost. Messages routed to the dead gateway in the meantime simply fail to deliver and are recovered by sync. Registry entries expire via TTL, or a health checker purges them on the gateway's death.</p>
          <p>The real risk is the <strong>thundering herd</strong>: 500K reconnects plus 500K sync calls within seconds. Mitigations: exponential backoff with full jitter on the client, sync endpoints that page and rate-limit, and enough spare gateway capacity (N+2) to absorb a failed node.</p>
        </>}
        followUps={['How do you deploy gateways with zero dropped connections?', 'How would you detect half-open TCP connections?']}
      />

      <KeyTakeaways items={[
        'Chat is a stateful-connection problem. Keep gateways thin and put logic in stateless services.',
        'A session registry (user → gateway) plus per-gateway pub/sub routes messages without a mesh.',
        'Per-conversation seq numbers + device cursors give ordering, gap detection, sync, and receipts.',
        'At-least-once delivery + idempotent apply = effectively exactly-once display.',
        'Plan for reconnect storms: jittered backoff, draining, spare capacity.',
      ]} />
    </>
  )
}
