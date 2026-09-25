import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode } from '../components/ui'
import { NearbyFriendsSimulationDemo } from './demos/nearby-friends-simulation-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Mobile app', sub: 'opted in', kind: 'client', x: 7, y: 50,
    detail: 'Sends its location every ~30 s while the feature is active and keeps one WebSocket open to receive friends’ updates.' },
  { id: 'lb', label: 'Load balancer', sub: 'L4, long-lived', kind: 'lb', x: 26, y: 50,
    detail: 'Spreads WebSocket connections by least-connections. Connections are long-lived, so deploys must drain servers gracefully instead of cutting millions of sockets at once.' },
  { id: 'ws', label: 'WebSocket servers', sub: 'stateful', kind: 'service', x: 48, y: 30,
    detail: 'Each connection handler subscribes to every friend’s channel. On a friend update it computes distance and forwards only if within radius. The filtering lives here.' },
  { id: 'api', label: 'REST API', sub: 'stateless', kind: 'service', x: 48, y: 74,
    detail: 'Friend management, privacy settings, sharing toggles: everything that is not the real-time stream.' },
  { id: 'pubsub', label: 'Pub/sub cluster', sub: 'Redis, sharded', kind: 'queue', x: 72, y: 30,
    detail: 'One channel per user. Publishing a location sends it to every subscriber, meaning every online friend. CPU-bound on fan-out and sharded by channel with consistent hashing.' },
  { id: 'locache', label: 'Location cache', sub: 'TTL ~10 min', kind: 'cache', x: 92, y: 14,
    detail: 'Latest location per user. It seeds a newly connected client with where friends are right now and expires stale users automatically.' },
  { id: 'history', label: 'Location history', sub: 'Cassandra', kind: 'db', x: 92, y: 46,
    detail: 'Optional, append-only, partitioned by user_id and clustered by time. Keep it only if the product needs it, with retention limits.' },
  { id: 'userdb', label: 'User & friends DB', kind: 'db', x: 72, y: 80,
    detail: 'Friend graph and settings. Read when a connection opens (who to subscribe to) and cached on the WebSocket server.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'lb' }, { from: 'lb', to: 'ws' }, { from: 'lb', to: 'api' },
  { from: 'ws', to: 'pubsub' }, { from: 'ws', to: 'locache' }, { from: 'ws', to: 'history', async: true },
  { from: 'ws', to: 'userdb' }, { from: 'api', to: 'userdb' },
]

export default function NearbyFriendsChapter() {
  return (
    <>
      <p>
        Nearby Friends looks like a proximity problem, but it isn't one. Proximity search (“restaurants near me”)
        queries a mostly <em>static</em> index. Here every point <strong>moves constantly</strong>, and the set of
        people who care about a given point is the <strong>friend graph</strong>, not geography. That turns it into a
        real-time <strong>fan-out</strong> problem, closer to chat than to Yelp.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['See opted-in friends within X km, with distance', 'List updates within about a minute', 'Toggle sharing on and off at any time', 'Optional: location history']}
        nonFunctional={['Low latency for updates (seconds)', 'Eventual consistency is fine: an occasionally stale dot is OK', 'Battery friendly', 'Privacy by default']}
        outOfScope={['Showing strangers nearby (discussed as an extension)', 'Turn-by-turn navigation']}
      />

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['100M users of the feature, 10% active concurrently', 'Location update every 30 s', 'Avg 400 friends, ~10% of them online and sharing']}
        rows={[
          { label: 'Concurrent users', math: '100M × 10%', result: '10M' },
          { label: 'Location updates', math: '10M / 30 s', result: '≈ 330K/s' },
          { label: 'Subscribers per update', math: '400 × 10%', result: '≈ 40' },
          { label: 'Pub/sub deliveries', math: '330K × 40', result: '≈ 13M/s' },
          { label: 'WebSocket servers', math: '10M conns / ~100K per box', result: '≈ 100+ (illustrative)' },
        ]}
      />
      <p>
        The number that shapes the design is <strong>13M deliveries per second</strong>, forty times the inbound rate.
        Connections are a solved problem. The fan-out is where the capacity plan lives.
      </p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'WS', path: 'wss://…/nearby', desc: 'Client → server: location updates. Server → client: friend location changes and removals.', body: '{ type: "loc", lat, lng, ts }', returns: '{ type: "friend", userId, lat, lng, distanceKm, ts } | { type: "gone", userId }' },
        { method: 'PUT', path: '/v1/me/sharing', desc: 'Turn location sharing on or off; takes effect immediately.', body: '{ enabled, visibleTo?: "all" | friendIds[] }' },
        { method: 'GET', path: '/v1/me/nearby', desc: 'Snapshot of nearby friends when the screen opens, served from the location cache.', returns: '{ friends: [{ userId, distanceKm, updatedAt }] }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={400}
        caption="Stateful WebSocket tier and a sharded pub/sub tier; each user owns one channel"
        flows={[
          { name: 'Publish my location', path: ['client', 'lb', 'ws', 'pubsub'], steps: ['App sends { lat, lng } over its socket', 'Existing connection via the LB', 'WS server updates the cache (and history, async), then publishes to channel user:{me}'] },
          { name: 'Friend update arrives', path: ['pubsub', 'ws', 'lb', 'client'], steps: ['Pub/sub pushes to every subscriber of channel user:{friend}', 'WS server computes the distance and drops it if beyond the radius', 'Within radius: push to the phone'] },
          { name: 'Open the screen', path: ['client', 'lb', 'ws', 'locache'], steps: ['Client connects', 'WS server loads the friend list (DB, cached) and subscribes to each channel', 'Batch-read friends’ latest locations from the cache to render immediately'] },
        ]} />

      <H2 id="fanout">5 · Deep dive: fan-out and filtering</H2>
      <p>
        Every update is published to the user's own channel. Each online friend's connection handler is subscribed
        and decides locally whether it's close enough to show. It's wasteful by design, because the distance check
        is cheap and the alternative, a spatial index of moving points queried per friend, is not.
      </p>
      <NearbyFriendsSimulationDemo />
      <CodeBlock lang="ts" title="connection handler (per connected user)" code={`
async function onFriendLocation(conn: Conn, msg: { userId: string; lat: number; lng: number; ts: number }) {
  if (msg.ts <= (conn.lastSeen.get(msg.userId) ?? 0)) return   // out-of-order: ignore older fixes
  conn.lastSeen.set(msg.userId, msg.ts)

  const d = haversineKm(conn.me, msg)
  const wasNear = conn.near.has(msg.userId)
  if (d <= conn.radiusKm) {
    conn.near.add(msg.userId)
    conn.send({ type: 'friend', userId: msg.userId, distanceKm: round1(d), ts: msg.ts })
  } else if (wasNear) {
    conn.near.delete(msg.userId)
    conn.send({ type: 'gone', userId: msg.userId })          // left the radius
  }                                                          // else: filtered, never leaves the server
}`} />
      <CompareTable
        columns={['Redis pub/sub', 'Kafka topics', 'Geo index (query on read)']}
        rows={[
          { label: 'Model', cells: ['Fire-and-forget push to live subscribers', 'Durable log, consumers pull', 'Store points, run radius queries'] },
          { label: 'Fits because', cells: ['Only online friends matter; a missed update is replaced in 30 s', 'Durability and replay aren’t needed', 'Good for strangers nearby, not friends'] },
          { label: 'Per-user channels', cells: ['Cheap (memory per subscription)', 'Millions of topics/partitions: not practical', 'n/a'] },
          { label: 'Weak spot', cells: ['No persistence; CPU on fan-out', 'Latency and overhead for tiny messages', 'Write amplification at 330K moves/s'] },
        ]}
      />

      <H2 id="scaling">6 · Deep dive: scaling the two stateful tiers</H2>
      <h3>Pub/sub cluster</h3>
      <ul>
        <li><strong>Shard by channel</strong> (user id) with consistent hashing. A service-discovery store (etcd or ZooKeeper) holds the ring, and publishers and subscribers look up the owning shard.</li>
        <li>Size for <strong>CPU on fan-out</strong>, not memory: at ~13M deliveries/s you need many shards even though the channel metadata fits on a few boxes.</li>
        <li>Classic Redis Cluster pub/sub <strong>broadcasts to every node</strong>. Use sharded pub/sub (<code>SSUBSCRIBE</code>, Redis 7+) or client-side sharding across independent instances.</li>
        <li>Resizing moves channels, so every subscriber on them must resubscribe. Do it off-peak and gradually, and treat it as an operational event, not autoscaling.</li>
      </ul>
      <h3>WebSocket tier</h3>
      <ul>
        <li>Stateful but <strong>replaceable</strong>: a lost connection just reconnects, re-subscribes and re-reads the cache.</li>
        <li>Deploys <strong>drain</strong>: stop accepting, tell clients to reconnect with jitter, then terminate. This avoids a thundering herd of 100K sockets.</li>
        <li>Autoscale on connection count and CPU. Per-connection memory, which includes the subscription set, is the main limit.</li>
      </ul>

      <H2 id="battery-privacy">7 · Deep dive: battery and privacy</H2>
      <CompareTable
        columns={['Choice', 'Battery', 'Freshness', 'Privacy']}
        rows={[
          { label: 'Fixed 30 s GPS', cells: ['Simple', 'Poor', 'Good', 'Neutral'] },
          { label: 'Adaptive interval', cells: ['Slow down when stationary, speed up when moving', 'Good', 'Good', 'Neutral'] },
          { label: 'OS significant-change APIs', cells: ['Cell/Wi-Fi based', 'Best', 'Coarse', 'Better (less precise)'] },
          { label: 'Coarsen before sending', cells: ['Round to ~100 m or share only the distance band', 'n/a', 'OK', 'Best'] },
        ]}
      />
      <Callout kind="warn">
        Location is among the most sensitive data you can hold. Make sharing opt-in, visible (users can see who sees
        them), instantly revocable (a <code>gone</code> event to all subscribers), and history-free by default.
      </Callout>

      <H2 id="data-model">8 · Data model</H2>
      <CodeBlock lang="ts" title="storage" code={`
// Location cache (Redis):  key loc:{userId}  →  { lat, lng, ts }   TTL 600 s
//   TTL doubles as presence: no update for 10 min ⇒ user disappears from friends' lists.
// Pub/sub channel:         user:{userId}     (no storage; live subscribers only)
// Friend graph (SQL/graph DB), cached per WS connection at open:
type Friendship = { userId: string; friendId: string; sharing: boolean }
// Optional history (Cassandra): PRIMARY KEY ((user_id), ts) WITH default_time_to_live = 2592000 -- 30 days`} />

      <H2 id="staff">9 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Nearby strangers</strong> flip the model: subscribe to <em>geohash cells</em> (yours plus the 8 neighbors) instead of friends. Moving across a cell boundary means unsubscribing and subscribing, and dense cities need finer cells.</li>
          <li><strong>Celebrity-like users</strong> with 5,000 online friends turn one update into 5,000 deliveries. Cap subscriptions per viewer to the closest or most relevant friends, or reduce their update rate.</li>
          <li><strong>Multi-region</strong>: friends span continents. Either route cross-region channels through a relay, or accept that far-away friends are never “nearby” and skip subscribing to them at all, which is the cheapest filter there is.</li>
          <li><strong>Failure mode</strong>: a pub/sub shard dies and its channels go silent. Clients see stale dots until the TTL expires, and the resubscription storm on failover must be rate-limited.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Why not store everyone's location in a geospatial index and query friends within radius?"
        senior={<p>Locations change every 30 seconds, so the index would take 330K writes per second. We also only care about friends, so a friend-based pub/sub is more direct.</p>}
        staff={<>
          <p>The access pattern is wrong for an index. The query is “which of <em>my friends</em> are near me”, and the candidate set, about 40 online friends, is tiny and already known. Pulling their 40 latest locations and computing distances is cheaper than a geo query, and pushing changes avoids polling entirely.</p>
          <p>A geo index is the right tool when the candidate set is <em>unknown</em>, as with nearby strangers. Then I'd use geohash-cell channels rather than a queried index, so the push model survives. The rule I'd state is to pick the fan-out key from who cares: the friend graph here, geography for strangers.</p>
        </>}
        followUps={['What happens when a user toggles sharing off?', 'How would you add “nearby strangers” without a second system?']}
      />
      <InterviewQuestion
        q="Your pub/sub tier is at 90% CPU during a big event. What do you do now and later?"
        senior={<p>Add more Redis nodes and rebalance channels, and maybe increase the update interval.</p>}
        staff={<>
          <p><strong>Now</strong>: shed load without resharding, since resharding forces a resubscription storm mid-incident. Push a config change that stretches the update interval (30 s → 60 s halves fan-out) and prioritizes moving users over stationary ones.</p>
          <p><strong>Later</strong>: pre-split shards for predictable events, move to sharded pub/sub so fan-out doesn't broadcast cluster-wide, and filter earlier. For example, skip publishing when a user hasn't moved more than ~50 m, which removes most updates from stationary phones. I'd add a capacity alert on deliveries/s, not just CPU, because that's the true demand signal.</p>
        </>}
        followUps={['How do you reshard without a thundering herd?', 'What metric would you autoscale on?']}
      />

      <KeyTakeaways items={[
        'Moving points plus a friend-graph audience make this a fan-out problem, closer to chat than to proximity search.',
        'One pub/sub channel per user; each friend’s connection handler filters by distance locally.',
        'Deliveries (~40× updates) drive capacity, so shard pub/sub by channel and size for fan-out CPU.',
        'The location cache with TTL gives fresh snapshots and presence for free.',
        'Staff depth: privacy and revocation, adaptive updates, sharded pub/sub, geohash channels for strangers.',
      ]} />
    </>
  )
}
