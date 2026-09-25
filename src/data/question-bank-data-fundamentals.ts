import type { BankQuestion } from './question-bank-data'

/** Estimation, Networking & APIs, Load balancing, Caching. */
export const FUNDAMENTALS_QUESTIONS: BankQuestion[] = [
  // ── Estimation ──
  {
    id: 'est-1', category: 'Estimation', level: 'senior',
    q: 'A service has 50M daily active users who each make 20 requests a day. What average and peak QPS do you design for?',
    senior: '50M × 20 = 1B requests/day. A day has about 86,400 s (round to 10⁵), so average is about 10K–12K QPS. Peak is usually 2–5× average depending on how diurnal the traffic is, so design for roughly 30K–60K QPS.',
    staff: [
      'State the rounding explicitly (86,400 ≈ 10⁵) so the interviewer can follow and correct you.',
      'Ask where the peak comes from: a global audience flattens the curve, a single-timezone product or event-driven traffic (sports, sales) spikes far above 3×.',
      'Split reads from writes early. The ratio decides whether caching or write scaling dominates the design.',
      'Turn QPS into a fleet: at about 1–2K QPS per stateless node, that is tens of nodes, plus N+2 headroom per AZ.',
    ],
    followUps: ['How many app servers is that?', 'How does a 10× marketing event change the plan?'],
  },
  {
    id: 'est-2', category: 'Estimation', level: 'senior',
    q: 'Recite the latency numbers you rely on during a design interview.',
    senior: 'L1 cache is about 1 ns, main memory about 100 ns, SSD random read about 100 µs, a round trip within a datacenter about 0.5 ms, a disk seek about 10 ms, and a cross-continent round trip about 100–150 ms. Reading 1 MB sequentially takes tens of µs from memory (older tables say 250 µs) and a few hundred µs from an NVMe SSD.',
    staff: [
      'Use orders of magnitude, not exact figures: memory ≪ SSD ≪ network ≪ disk seek ≪ cross-region.',
      'The design consequence matters more than the number: one cross-region round trip costs more than hundreds of same-DC calls, so keep synchronous chains inside one region.',
      'Tail latency compounds with fan-out: calling 100 backends in parallel means you see roughly the p99 of each on almost every request.',
    ],
    followUps: ['Why does fan-out make p99 matter more?', 'What changes if the DB is in another region?'],
  },
  {
    id: 'est-3', category: 'Estimation', level: 'senior',
    q: 'Estimate storage for a photo-sharing service with 10M uploads a day kept for 5 years.',
    senior: 'Assume about 2 MB per photo after compression. That is 10M × 2 MB = 20 TB/day, about 7.3 PB/year and about 36 PB over 5 years, before replication. With three replicas it is about 110 PB, or less with erasure coding (about 1.5× overhead).',
    staff: [
      'Include derived artifacts: thumbnails and multiple resolutions often add 20–50%.',
      'Name the storage tier: object storage (S3-like) for blobs, with only metadata (~1 KB/photo) in a database.',
      'Talk about cost: most photos go cold within weeks, so lifecycle policies to infrequent-access or archive tiers cut spend dramatically.',
      'Erasure coding vs triple replication is a cost/latency trade-off worth naming at petabyte scale.',
    ],
    followUps: ['How much metadata DB storage?', 'What would you do to halve storage cost?'],
  },
  {
    id: 'est-4', category: 'Estimation', level: 'staff',
    q: 'How do you use estimation to drive design decisions rather than as a ritual?',
    senior: 'Compute QPS, storage and bandwidth up front to size servers and databases and to decide whether sharding or caching is needed.',
    staff: [
      'Only estimate what changes a decision: "is 12K writes/s beyond a single primary?" is useful; computing to three significant figures is not.',
      'Do it at the fork points: working set vs RAM (cache or not), write QPS vs single-node limits (shard or not), egress vs cost (CDN or not).',
      'Revisit the numbers when the interviewer changes a requirement. It shows the design is driven by constraints.',
      'Say what would invalidate the design: "if writes grow 10×, the single-leader DB is the first thing to break."',
    ],
    followUps: ['Which estimate most often changes your architecture?'],
  },
  {
    id: 'est-5', category: 'Estimation', level: 'senior',
    q: 'A video service streams 1M concurrent viewers at 5 Mbps. What egress is that, and what does it imply?',
    senior: '1M × 5 Mbps = 5 Tbps of egress. No single origin can serve that, so a CDN is mandatory, and the origin only handles cache misses.',
    staff: [
      'Egress cost dominates at this scale, so CDN contracts, multi-CDN routing and ISP-embedded caches are business decisions, not just technical ones.',
      'The origin should be sized for the CDN miss rate (a few percent) plus thundering herds when new content launches.',
      'Adaptive bitrate lowers average bandwidth, and encoding efficiency (codec choice) is a direct cost lever.',
    ],
    followUps: ['What happens when a popular video is first released?'],
  },
  {
    id: 'est-6', category: 'Estimation', level: 'senior',
    q: 'Why are powers of two useful in estimation, and what are the anchors?',
    senior: '2¹⁰ ≈ 1 thousand (KB), 2²⁰ ≈ 1 million (MB), 2³⁰ ≈ 1 billion (GB), 2⁴⁰ ≈ 1 trillion (TB). They make it fast to convert between counts, bits and bytes, e.g. a 32-bit ID covers about 4 billion values.',
    staff: [
      'They tell you when an ID space runs out: 32-bit auto-increment overflows at about 2.1B signed, which is a classic outage source.',
      'Know the character capacity of short codes: 62⁶ ≈ 57B, 62⁷ ≈ 3.5T.',
      'Keep bits and bytes separate for bandwidth (Mbps vs MB/s is a factor of 8).',
    ],
    followUps: ['When would a 32-bit ID bite you?'],
  },

  // ── Networking & APIs ──
  {
    id: 'net-1', category: 'Networking & APIs', level: 'senior',
    q: 'REST, gRPC or GraphQL — how do you choose?',
    senior: 'REST for public, resource-oriented, cache-friendly APIs. gRPC for internal service-to-service calls where performance, strong typing and streaming matter. GraphQL for client-driven aggregation, where many clients need different shapes of data.',
    staff: [
      'Choose per boundary, not per company: public REST, internal gRPC and a GraphQL BFF can coexist.',
      'GraphQL moves complexity to the server: query cost limits, N+1 via dataloaders, and HTTP caching gets harder.',
      'gRPC needs HTTP/2 end to end; browser support requires gRPC-Web or a proxy.',
      'Name the operational costs: schema evolution rules, versioning, and tooling for observability of each.',
    ],
    followUps: ['How do you version a REST API?', 'How do you rate-limit GraphQL fairly?'],
  },
  {
    id: 'net-2', category: 'Networking & APIs', level: 'senior',
    q: 'Compare short polling, long polling, SSE and WebSockets for real-time updates.',
    senior: 'Short polling is simple but wasteful. Long polling holds a request until data arrives. SSE is a one-way server-to-client stream over HTTP. WebSockets are full-duplex persistent connections, best for chat and collaboration.',
    staff: [
      'Pick the least powerful tool that works: notifications or feeds are fine with SSE, and bidirectional low-latency needs point to WebSockets.',
      'Persistent connections make servers stateful: you need connection-aware LBs, graceful draining on deploy, and a pub/sub layer to route messages to the right node.',
      'Reconnect storms after an outage need jittered backoff and resume tokens (last event ID).',
      'Mobile networks and proxies drop idle connections, so heartbeats are required.',
    ],
    followUps: ['How do you deploy a WebSocket fleet without dropping users?'],
  },
  {
    id: 'net-3', category: 'Networking & APIs', level: 'senior',
    q: 'What happens when you type a URL and press enter? Keep it relevant to system design.',
    senior: 'DNS resolution (possibly GeoDNS to the nearest region), a TCP handshake and TLS negotiation (QUIC with HTTP/3), the request hits a CDN or edge, then the load balancer, then app servers, which call caches and databases. The response streams back and the browser renders it and fetches assets, often from the CDN.',
    staff: [
      'Highlight the levers at each hop: DNS TTLs for failover speed, TLS session resumption, and connection reuse via HTTP/2 multiplexing.',
      'The edge can terminate TLS and serve static assets and cached responses, which removes origin load and latency.',
      'Each hop is a failure domain; say how the system degrades if DNS, the CDN or a region is down.',
    ],
    followUps: ['How does GeoDNS failover work and how fast is it?'],
  },
  {
    id: 'net-4', category: 'Networking & APIs', level: 'staff',
    q: 'How do you design idempotent APIs, and why does it matter in distributed systems?',
    senior: 'The client sends an idempotency key with mutating requests. The server stores the key with the result and returns the stored result on retries instead of re-executing.',
    staff: [
      'Networks make retries unavoidable, and without idempotency retries mean double charges or duplicate orders.',
      'Store key → (request hash, status, response) atomically with the side effect, or use the key as a unique constraint in the same transaction.',
      'Handle concurrent duplicates: the second request should wait for or observe the in-progress record, not execute in parallel.',
      'Keys need a TTL and must be scoped per client, and a reused key with a different payload should be rejected.',
    ],
    followUps: ['What if the server crashes after the side effect but before recording the key?'],
  },
  {
    id: 'net-5', category: 'Networking & APIs', level: 'senior',
    q: 'What does an API gateway do, and what should it not do?',
    senior: 'It is a single entry point that handles routing, authentication, rate limiting, TLS termination, request logging and sometimes response aggregation.',
    staff: [
      'Keep business logic out of the gateway, or it becomes a bottleneck that every team must change.',
      'It is a critical shared dependency, so it needs horizontal scale, multi-AZ deployment and careful config rollout (config pushes cause outages).',
      'A BFF (backend-for-frontend) per client type is often better than one smart gateway for aggregation.',
    ],
    followUps: ['Gateway vs service mesh: where does each concern live?'],
  },
  {
    id: 'net-6', category: 'Networking & APIs', level: 'senior',
    q: 'How do you paginate a large, changing collection?',
    senior: 'Prefer cursor (keyset) pagination: return an opaque cursor encoding the last seen sort key, and query WHERE key > cursor LIMIT n. Offset pagination gets slow at deep pages and skips or duplicates items when data changes.',
    staff: [
      'The sort key must be unique and stable: use (created_at, id) as a tuple to break ties.',
      'Opaque, signed cursors let you change the implementation later without breaking clients.',
      'Total counts are expensive at scale, so offer approximate counts or none.',
    ],
    followUps: ['How would you paginate a ranked feed whose scores change?'],
  },

  // ── Load balancing ──
  {
    id: 'lb-1', category: 'Load balancing', level: 'senior',
    q: 'L4 vs L7 load balancing: what is the difference and when do you use each?',
    senior: 'L4 balances on TCP/UDP connection info. It is fast and protocol-agnostic but cannot see HTTP. L7 understands HTTP, so it can route by path or header, terminate TLS, retry and do sticky sessions, at more CPU cost.',
    staff: [
      'Common layering: an L4 LB (or anycast + ECMP) in front of an L7 proxy fleet (Envoy, NGINX).',
      'L7 retries can amplify load during incidents, so bound them with retry budgets.',
      'Long-lived connections (gRPC, WebSockets) balance poorly at L4 because one connection carries many requests, so use L7 or client-side balancing.',
    ],
    followUps: ['Why can gRPC traffic end up unbalanced behind an L4 LB?'],
  },
  {
    id: 'lb-2', category: 'Load balancing', level: 'senior',
    q: 'Which load-balancing algorithms do you know, and when does "least connections" beat round robin?',
    senior: 'Round robin, weighted round robin, least connections, least response time, IP or consistent hashing, and random. Least connections wins when request cost varies a lot, because round robin keeps sending work to a server that is stuck on slow requests.',
    staff: [
      '"Power of two random choices" (pick two at random, send to the less loaded) gets near-optimal balance without global state.',
      'Hash-based balancing gives affinity (cache locality) but creates hot spots, so combine it with bounded load.',
      'Health checks decide more than the algorithm: slow-but-alive nodes need outlier ejection, not just liveness probes.',
    ],
    followUps: ['How do you detect a gray-failing node?'],
  },
  {
    id: 'lb-3', category: 'Load balancing', level: 'senior',
    q: 'Explain consistent hashing and why virtual nodes are used.',
    senior: 'Nodes and keys are hashed onto a ring, and each key goes to the next node clockwise. Adding or removing a node moves only about 1/N of the keys instead of nearly all of them. Virtual nodes place each physical node at many ring positions, which evens out load and spreads a failed node\'s keys across many others.',
    staff: [
      'The number of vnodes trades balance against metadata size; weighting vnode count per node handles heterogeneous hardware.',
      'Alternatives: rendezvous (HRW) hashing needs no ring state; jump consistent hash is compact but only supports adding buckets at the end.',
      'Consistent hashing alone does not fix hot keys; it balances key count, not traffic.',
    ],
    followUps: ['How do you handle a single hot key on the ring?'],
  },
  {
    id: 'lb-4', category: 'Load balancing', level: 'staff',
    q: 'Sticky sessions: when are they acceptable and what do they cost?',
    senior: 'They route a user to the same server, which helps when session state is kept in memory. Better to make servers stateless and store sessions in Redis or a signed token.',
    staff: [
      'Stickiness breaks even load distribution and turns deploys and node failures into user-visible session loss.',
      'Acceptable for caches of expensive per-user state (for example a game server or collaborative doc) if you have a handoff or rebuild path.',
      'Stateful affinity is better expressed through consistent hashing on an entity ID with explicit ownership and rebalancing.',
    ],
    followUps: ['How would you drain a sticky node for a deploy?'],
  },
  {
    id: 'lb-5', category: 'Load balancing', level: 'staff',
    q: 'How do you route users across multiple regions?',
    senior: 'Use GeoDNS or anycast to send users to the nearest healthy region. Each region has its own LBs and services, and data is replicated between regions.',
    staff: [
      'Distinguish active-active from active-passive. The hard part is data: which region owns writes for a user?',
      'Home-region routing (the user pinned to the region that owns their data) avoids cross-region write conflicts.',
      'Failover speed is bounded by DNS TTL and client caching; anycast fails over faster but is harder to control.',
      'Capacity plan for N-1 regions: surviving regions must absorb the failed region\'s traffic.',
    ],
    followUps: ['How do you test regional failover without an outage?'],
  },

  // ── Caching ──
  {
    id: 'ca-1', category: 'Caching', level: 'senior',
    q: 'Compare cache-aside, read-through, write-through and write-back.',
    senior: 'Cache-aside: the app reads the cache, and on a miss loads from the DB and populates the cache. Read-through: the cache loads on miss itself. Write-through: writes go to cache and DB synchronously. Write-back: writes go to the cache and are flushed to the DB later, which is fast but risks data loss.',
    staff: [
      'Cache-aside is the default because the cache is optional: if it fails, the system is slower but still correct.',
      'On writes, prefer invalidate (delete) over update to avoid races where a stale value overwrites a fresh one.',
      'Write-back suits counters and metrics where losing a small window is acceptable, but not money.',
    ],
    followUps: ['Describe the race in cache-aside when you update instead of delete.'],
  },
  {
    id: 'ca-2', category: 'Caching', level: 'senior',
    q: 'What is a cache stampede (thundering herd) and how do you prevent it?',
    senior: 'When a hot key expires, many requests miss at once and all hit the database. Fixes: request coalescing (single-flight), locks so only one caller recomputes, and jittered TTLs.',
    staff: [
      'Probabilistic early expiration (e.g. XFetch) refreshes hot keys before they expire, spreading the recompute.',
      'Serve stale-while-revalidate: return the old value while one worker refreshes.',
      'Cold starts are stampedes too: warm caches before shifting traffic to a new region or cluster.',
    ],
    followUps: ['How do you warm a cache for a new region?'],
  },
  {
    id: 'ca-3', category: 'Caching', level: 'senior',
    q: 'LRU vs LFU vs TTL-based eviction: when does each fit?',
    senior: 'LRU evicts the least recently used item and is good for recency-skewed workloads. LFU evicts the least frequently used item, which is better when popularity is stable. TTL expires by time to bound staleness. Most systems combine TTL with LRU or LFU.',
    staff: [
      'Plain LRU is vulnerable to scans (one big batch job flushes the hot set); segmented LRU or W-TinyLFU (used by Caffeine) resist that.',
      'Redis\'s approximate LRU/LFU samples keys, which is good enough and cheap.',
      'Size the cache from the working set and target hit ratio, not from total data.',
    ],
    followUps: ['How do you pick a cache size?'],
  },
  {
    id: 'ca-4', category: 'Caching', level: 'staff',
    q: 'How do you handle a hot key that overloads one cache shard?',
    senior: 'Replicate the hot key or add a local in-process cache in front of the distributed cache.',
    staff: [
      'Detect hot keys first: sample traffic per key at the proxy or client.',
      'Mitigations: an L1 in-process cache with a short TTL, key splitting (key#1..key#N with the client picking a random suffix), or read replicas for the shard.',
      'For writes to a hot key (counters), shard the counter and aggregate asynchronously.',
      'Watch the consistency cost: more copies means slower invalidation.',
    ],
    followUps: ['How would you shard a hot counter like a like-count?'],
  },
  {
    id: 'ca-5', category: 'Caching', level: 'staff',
    q: 'How do you keep a cache consistent with the database?',
    senior: 'Set TTLs and invalidate on write. Accept eventual consistency within the TTL.',
    staff: [
      'Invalidate from the source of truth: tail the DB change log (CDC, e.g. Debezium) and delete keys, which avoids forgetting an invalidation in some code path.',
      'Delete-after-write can still race with a concurrent reader. Delayed double delete or version checks narrow the window.',
      'Decide per data type: user-visible own writes need read-your-writes (bypass the cache for the writer), while aggregate counts can be stale.',
      'Say which data should never be cached, such as balances used for authorization decisions.',
    ],
    followUps: ['How do you guarantee read-your-writes with a cache in front?'],
  },
  {
    id: 'ca-6', category: 'Caching', level: 'senior',
    q: 'What belongs in a CDN, and how do you invalidate it?',
    senior: 'Static assets, images and video, and cacheable API responses. Invalidate by versioned URLs (content hashes in file names) rather than purges; use purge APIs for urgent fixes.',
    staff: [
      'Cache keys matter: vary on the fewest headers possible or the hit rate collapses.',
      'Personalized content can still use the edge with edge compute or by splitting into cacheable shell plus a personalized fragment.',
      'Origin shield (a mid-tier cache) protects the origin from miss storms across many PoPs.',
    ],
    followUps: ['How do you cache a page that is 95% the same for everyone?'],
  },
]
