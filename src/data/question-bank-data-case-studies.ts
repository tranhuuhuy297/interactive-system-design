import type { BankQuestion } from './question-bank-data'

/** Follow-ups for the newer case studies: maps, nearby friends, object storage, exchange, collab editing, LLM serving. */
export const CASE_STUDY_QUESTIONS: BankQuestion[] = [
  {
    id: 'cs-maps-1', category: 'Case follow-ups', level: 'senior',
    q: 'Google Maps: how do you compute a driving route across a continent in milliseconds?',
    senior: 'Model roads as a weighted graph and run a shortest-path search. Plain Dijkstra is too slow at continental scale, so use A* with a good heuristic plus precomputed shortcuts (contraction hierarchies) so a query explores only a tiny part of the graph.',
    staff: [
      'Split preprocessing into a slow, traffic-independent phase and a fast "customization" phase (e.g. customizable route planning) so live traffic weights can be applied every few minutes.',
      'Partition the graph into regions; long routes stitch region-level boundary paths, which also bounds memory per routing server.',
      'ETA is a separate ML problem: historical speeds per road segment and time of day, blended with live probe data.',
      'Name the failure mode: a stale traffic layer silently produces bad ETAs, so monitor predicted vs actual trip times.',
    ],
    followUps: ['How do you apply a road closure within a minute?', 'How do you handle turn restrictions?'],
  },
  {
    id: 'cs-maps-2', category: 'Case follow-ups', level: 'senior',
    q: 'Google Maps: how are map tiles served to billions of devices?',
    senior: 'Render the world into tiles addressed by (zoom, x, y). Each zoom level has 4× the tiles of the previous one. Tiles are static per data version, so they are served from object storage behind a CDN and cached on the device.',
    staff: [
      'Vector tiles (geometry plus style applied on device) shrink bandwidth and allow restyling, rotation and dark mode without re-rendering.',
      'Pre-render popular zoom levels; render sparse, deep zoom levels on demand and cache the result.',
      'Version tiles in the URL so a data update is a cache miss, not a purge storm.',
    ],
    followUps: ['Roughly how many tiles exist at zoom 20?'],
  },
  {
    id: 'cs-nearby-1', category: 'Case follow-ups', level: 'staff',
    q: 'Nearby Friends: how do you fan out frequent location updates to friends in real time?',
    senior: 'Clients hold WebSocket connections and send their location every ~30 s. Store the latest location in Redis with a TTL. Publish each update to a pub/sub channel per user; the WebSocket servers of online friends subscribe and push the update if the friend is within range.',
    staff: [
      'Only the latest location matters: keep it in memory with a TTL, and write history asynchronously only if the product needs it.',
      'The pub/sub layer is the bottleneck. Shard channels with consistent hashing and plan for channel migration when adding nodes.',
      'Filter by distance on the subscriber side, and skip inactive friends entirely.',
      'Privacy is a requirement, not a feature: opt-in, coarse location for distant friends, and short retention.',
    ],
    followUps: ['What changes if a user has 5,000 friends?', 'How do you handle a Redis pub/sub node failure?'],
  },
  {
    id: 'cs-s3-1', category: 'Case follow-ups', level: 'senior',
    q: 'Object storage: why separate the metadata service from the data store?',
    senior: 'Metadata (bucket, key, version, where each object lives) needs strong consistency and fast lookups, while object bytes need cheap, durable bulk storage. Separating them lets each scale independently: a sharded, replicated metadata DB and a large pool of storage nodes.',
    staff: [
      'The metadata tier is usually the scaling limit; shard by bucket and key prefix and watch for hot prefixes.',
      'Write data first and commit metadata last, so a crash leaves only orphaned bytes that garbage collection can reclaim, never a pointer to missing data.',
      'Listing is a range scan over metadata, so the key layout determines list performance.',
    ],
    followUps: ['How does S3-style strong read-after-write consistency constrain the metadata design?'],
  },
  {
    id: 'cs-s3-2', category: 'Case follow-ups', level: 'staff',
    q: 'Object storage: replication or erasure coding for durability?',
    senior: '3× replication is simple and gives fast reads and repair, but costs 3× storage. Erasure coding (e.g. 8 data + 4 parity fragments) tolerates losing any 4 fragments with only 1.5× overhead, at the cost of CPU and more network for reads and repair.',
    staff: [
      'Use tiers: replicate hot or small objects and erasure-code large or cold ones.',
      'Place fragments across failure domains (disks, racks, availability zones); durability math assumes independent failures, so correlated failures are the real risk.',
      'Repair speed drives durability: the faster you rebuild lost fragments, the smaller the window for a second failure.',
      'Background scrubbing with checksums catches silent corruption before it compounds.',
    ],
    followUps: ['How do you estimate annual durability ("eleven nines")?'],
  },
  {
    id: 'cs-s3-3', category: 'Case follow-ups', level: 'senior',
    q: 'Object storage: how do multipart uploads work and why use them?',
    senior: 'The client initiates an upload, sends parts (e.g. 5–100 MB each) in parallel with part numbers, then calls complete with the list of part ETags. The service stitches the parts into one object. Failed parts are retried individually.',
    staff: [
      'Incomplete uploads leak storage, so lifecycle rules must abort them after N days.',
      'Parallel parts saturate bandwidth and make multi-GB uploads resumable over flaky networks.',
      'The completion step is the atomic commit point: metadata switches to the new object only then.',
    ],
    followUps: ['How would you implement upload resumption across client restarts?'],
  },
  {
    id: 'cs-exchange-1', category: 'Case follow-ups', level: 'staff',
    q: 'Stock exchange: why is the matching engine single-threaded per symbol?',
    senior: 'Orders must be matched in a strict price-time priority. A single-threaded engine processing a sequenced stream of orders for a symbol avoids locks and guarantees a deterministic, fair order. Scale by partitioning symbols across engines.',
    staff: [
      'Determinism is the core invariant: the same sequenced input yields the same trades, so hot standbys replay the log and fail over with identical state.',
      'A sequencer stamps every inbound order with a monotonic ID before matching; that log is the source of truth for audit and recovery.',
      'Latency comes from mechanical sympathy: in-memory order books, pre-allocated structures, no GC pauses on the hot path, and kernel-bypass networking.',
      'Market data is fanned out via multicast, so every participant sees updates at the same time.',
    ],
    followUps: ['What data structure represents the order book?', 'How do you fail over without losing or duplicating an order?'],
  },
  {
    id: 'cs-exchange-2', category: 'Case follow-ups', level: 'senior',
    q: 'Stock exchange: what data structure do you use for an order book?',
    senior: 'Two sides, bids and asks, each keyed by price level (a sorted map or an array indexed by tick), with a FIFO queue of orders at each level. Add a hash map from order ID to its node so cancels are O(1).',
    staff: [
      'Most activity is near the best price, so an array of price levels around the top of book beats a tree in cache efficiency.',
      'Cancels and modifies are far more frequent than trades; optimize for them.',
    ],
    followUps: ['How do you handle a modify that changes price vs one that only reduces quantity?'],
  },
  {
    id: 'cs-collab-1', category: 'Case follow-ups', level: 'staff',
    q: 'Collaborative editor: OT or CRDT?',
    senior: 'Operational transformation transforms concurrent operations against each other so all replicas converge; it usually relies on a central server to order operations. CRDTs give every element a unique ID so concurrent operations commute and merge without coordination, which suits offline and peer-to-peer editing.',
    staff: [
      'OT with a central server is simpler to reason about for online editing (Google Docs uses it); CRDTs shine when offline edits and multi-device merges are first-class (Yjs, Automerge).',
      'CRDT metadata and tombstones grow over time; plan for compaction and snapshotting.',
      'Convergence is not intent: both approaches converge, but interleaving concurrent inserts can still surprise users, so test real editing patterns.',
      'Presence and cursors are ephemeral: send them over a separate lossy channel, not the document log.',
    ],
    followUps: ['How do you store document history for version browsing?', 'How do you shard sessions across servers?'],
  },
  {
    id: 'cs-collab-2', category: 'Case follow-ups', level: 'senior',
    q: 'Collaborative editor: how do you route everyone editing one document to the same place?',
    senior: 'Assign each document to one collaboration server (session owner) using consistent hashing on the document ID. All clients for that document connect to it over WebSockets; it orders operations and persists them to a log, with periodic snapshots.',
    staff: [
      'The owner is a single writer, so failover needs a lease and fencing to avoid two owners.',
      'Very popular documents (a company-wide doc) need read-only fan-out replicas for viewers.',
      'Snapshot plus operation log keeps load time bounded instead of replaying the full history.',
    ],
    followUps: ['What happens to in-flight edits when the owner server crashes?'],
  },
  {
    id: 'cs-llm-1', category: 'Case follow-ups', level: 'staff',
    q: 'LLM inference platform: how do you maximize GPU throughput without hurting latency?',
    senior: 'Batch requests so each forward pass serves many sequences. Use continuous (iteration-level) batching so new requests join as soon as others finish, and stream tokens to users as they are generated.',
    staff: [
      'Measure two latencies: time to first token (prefill-bound) and time per output token (decode-bound); they conflict, so some systems disaggregate prefill and decode onto separate GPU pools.',
      'KV-cache memory limits concurrency; paged attention cuts fragmentation and prefix caching reuses shared system prompts.',
      'Route by model and adapter, with admission control and per-tenant quotas, because a GPU queue that is too deep turns into timeouts.',
      'Cost per token is the business metric: quantization, speculative decoding and right-sizing models often beat adding GPUs.',
    ],
    followUps: ['How do you autoscale when GPUs take minutes to load a model?', 'How do you handle one tenant sending 100K-token prompts?'],
  },
  {
    id: 'cs-llm-2', category: 'Case follow-ups', level: 'senior',
    q: 'LLM inference platform: how do you stream responses to clients reliably?',
    senior: 'Stream tokens over Server-Sent Events or a WebSocket as they are generated. Keep a request ID so the client can show progress and cancel; cancellation must free the GPU slot immediately.',
    staff: [
      'Long-lived streams pin connections on gateways; size load balancers for concurrent streams, not requests per second.',
      'Resuming a dropped stream requires buffering generated tokens server-side for a short window.',
      'Apply safety and moderation filters incrementally on the stream rather than only at the end.',
    ],
    followUps: ['How do you bill for tokens when a stream is cancelled halfway?'],
  },
]
