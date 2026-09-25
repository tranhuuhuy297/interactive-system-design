import type { BankQuestion } from './question-bank-data'

/** Rate limiting & IDs, Reliability & Observability, Case follow-ups, Trade-offs. */
export const OPERATIONS_QUESTIONS: BankQuestion[] = [
  // ── Rate limiting & IDs ──
  {
    id: 'rl-1', category: 'Rate limiting & IDs', level: 'senior',
    q: 'Compare token bucket, leaky bucket, fixed window and sliding window rate limiting.',
    senior: 'Token bucket refills tokens at a fixed rate and allows bursts up to the bucket size. Leaky bucket drains at a constant rate and smooths output. A fixed window counter is simple but allows 2× bursts at window boundaries. A sliding log is exact but memory-heavy; a sliding window counter approximates it cheaply.',
    staff: [
      'Choose by product semantics: APIs usually want bursts (token bucket); protecting a fragile downstream wants smoothing (leaky bucket).',
      'Return 429 with Retry-After and rate-limit headers so well-behaved clients back off.',
      'Rate limits are a product and business decision (tiers and plans), so make them configuration, not code.',
    ],
    followUps: ['What does the boundary-burst problem look like with fixed windows?'],
  },
  {
    id: 'rl-2', category: 'Rate limiting & IDs', level: 'staff',
    q: 'How do you implement a distributed rate limiter across many gateway nodes?',
    senior: 'Keep counters in Redis with atomic INCR and EXPIRE, or a Lua script for token bucket, keyed by user or API key.',
    staff: [
      'A central Redis adds a network hop and a dependency to every request; decide fail-open vs fail-closed when it is down (usually fail-open with local limits).',
      'Hybrid: local token buckets per node with periodic synchronization or a divided global quota, which trades precision for latency.',
      'Race-free updates need atomic scripts; check-then-set races let bursts through.',
      'Hot tenants can overload one Redis shard, so shard by key and watch cardinality.',
    ],
    followUps: ['Fail-open or fail-closed when the limiter store is unavailable?'],
  },
  {
    id: 'rl-3', category: 'Rate limiting & IDs', level: 'senior',
    q: 'How does a Snowflake-style ID generator work?',
    senior: '64 bits: a sign bit, a 41-bit millisecond timestamp (about 69 years from a custom epoch), 10 bits of machine or worker ID, and a 12-bit per-millisecond sequence (4096 IDs/ms per worker). IDs are unique without coordination and roughly time-sortable.',
    staff: [
      'Clock rollback is the main hazard: refuse to issue IDs or wait until the clock passes the last timestamp.',
      'Worker IDs must be unique: assign them via ZooKeeper/etcd or from deployment metadata, and handle reuse after crashes.',
      'Time-ordered IDs make B-tree inserts efficient but leak creation time and volume; decide whether that matters.',
    ],
    followUps: ['What happens if NTP moves the clock back 5 ms?'],
  },
  {
    id: 'rl-4', category: 'Rate limiting & IDs', level: 'senior',
    q: 'UUIDv4 vs UUIDv7 vs database auto-increment: trade-offs?',
    senior: 'Auto-increment is compact and ordered but needs a central authority and leaks volume. UUIDv4 is random and generated anywhere, but it is 128-bit and random inserts fragment B-tree indexes. UUIDv7 is time-ordered and generated anywhere, with good index locality.',
    staff: [
      'UUIDv7 (RFC 9562) is now a strong default for new systems when 128-bit keys are acceptable.',
      'For public IDs, avoid exposing sequential integers (enumeration attacks); use opaque IDs externally even if internal IDs are sequential.',
      'Key size affects every index and foreign key, which matters at billions of rows.',
    ],
    followUps: ['Why do random UUID primary keys hurt write performance in InnoDB?'],
  },
  {
    id: 'rl-5', category: 'Rate limiting & IDs', level: 'staff',
    q: 'Where do you place rate limiting in the architecture?',
    senior: 'At the API gateway, keyed by API key or user, before requests reach services.',
    staff: [
      'Layer it: edge/WAF for abusive IPs and DDoS, gateway for per-client quotas, services for protecting expensive operations and downstream dependencies.',
      'Also limit internally: one misbehaving internal caller can DoS a shared service.',
      'Adaptive concurrency limits (based on latency) protect services better than static QPS limits.',
    ],
    followUps: ['How do you rate-limit fairly across tenants of very different sizes?'],
  },
  {
    id: 'rl-6', category: 'Rate limiting & IDs', level: 'senior',
    q: 'How do you design a ticket server (centralized ID allocation) that is not a single point of failure?',
    senior: 'Run two DB servers issuing odd and even IDs (auto-increment offset and step), or lease ID ranges so application servers allocate locally.',
    staff: [
      'Range leasing reduces coordination to one call per block; a crash wastes at most one block.',
      'Store the high-water mark in a consensus-backed store so leases are never issued twice.',
      'Gaps are acceptable; if the product requires gap-free numbering (e.g. invoices), that is a different, harder problem.',
    ],
    followUps: ['How do you generate gap-free invoice numbers?'],
  },

  // ── Reliability & Observability ──
  {
    id: 'rel-1', category: 'Reliability & Observability', level: 'senior',
    q: 'What are SLIs, SLOs, SLAs and error budgets?',
    senior: 'An SLI is a measured indicator (e.g. the share of requests under 300 ms). An SLO is the target (99.9% over 30 days). An SLA is a contractual promise with penalties, set looser than the SLO. The error budget is 1 − SLO: the unreliability you may spend.',
    staff: [
      'Error budgets align product and reliability: budget left means ship faster, budget spent means freeze risky launches and fix reliability.',
      'Measure SLIs at the user\'s edge (load balancer or client), not on individual servers.',
      '99.9% is about 43 minutes of downtime a month and 99.99% about 4.3 minutes; each extra nine costs roughly 10× effort.',
      'Alert on burn rate (how fast budget is consumed) with multi-window alerts instead of raw thresholds.',
    ],
    followUps: ['How do you choose an SLO for a new service?'],
  },
  {
    id: 'rel-2', category: 'Reliability & Observability', level: 'senior',
    q: 'How should clients retry failed requests safely?',
    senior: 'Retry only transient errors and idempotent operations, with exponential backoff, jitter and a cap on attempts.',
    staff: [
      'Retries multiply load: 3 retries at each of 4 layers can amplify one request into 81; retry at one layer only.',
      'Use retry budgets (e.g. retries ≤ 10% of requests) so retries cannot cause a meltdown.',
      'Jitter matters: without it clients synchronize and hit the recovering service in waves.',
      'Respect deadlines: propagate the remaining time budget so downstream work stops when the caller has given up.',
    ],
    followUps: ['Why is full jitter better than no jitter?'],
  },
  {
    id: 'rel-3', category: 'Reliability & Observability', level: 'senior',
    q: 'Explain the circuit breaker pattern.',
    senior: 'Wrap calls to a dependency. When failures exceed a threshold the breaker opens and fails fast; after a cooldown it goes half-open and lets a few trial requests through; success closes it again.',
    staff: [
      'It protects both sides: the caller keeps its threads and latency, and the failing dependency gets room to recover.',
      'Pair it with fallbacks: cached data, a degraded response, or a clear error.',
      'Tune per dependency and monitor breaker state; a flapping breaker is a signal in itself.',
      'Bulkheads (separate pools per dependency) stop one slow dependency from exhausting shared resources.',
    ],
    followUps: ['What fallback would you use for a recommendations service?'],
  },
  {
    id: 'rel-4', category: 'Reliability & Observability', level: 'senior',
    q: 'What are the three pillars of observability, and what do you instrument first?',
    senior: 'Metrics (aggregated numbers over time), logs (discrete events) and traces (a request\'s path across services). Start with the golden signals: latency, traffic, errors and saturation.',
    staff: [
      'Use RED for services (rate, errors, duration) and USE for resources (utilization, saturation, errors).',
      'Propagate a trace or correlation ID everywhere, including through queues.',
      'Watch cardinality: user IDs as metric labels will blow up the metrics system; put them in logs or traces.',
      'Sample traces smartly: tail-based sampling keeps the slow and failed ones.',
    ],
    followUps: ['How do you debug a latency regression that only affects 1% of requests?'],
  },
  {
    id: 'rel-5', category: 'Reliability & Observability', level: 'staff',
    q: 'How do you design for graceful degradation?',
    senior: 'Identify non-critical features and disable them under load using feature flags, and serve cached or static content when backends fail.',
    staff: [
      'Classify dependencies as critical or optional per user journey; optional ones get timeouts, fallbacks and breakers.',
      'Load shedding: drop low-priority traffic (prefetch, analytics, bots) first, based on request criticality headers.',
      'Rehearse it: game days and chaos experiments confirm degradation paths actually work.',
      'Degraded modes need their own monitoring, or you will run degraded for weeks without knowing.',
    ],
    followUps: ['Which features of an e-commerce site would you shed first on Black Friday?'],
  },
  {
    id: 'rel-6', category: 'Reliability & Observability', level: 'staff',
    q: 'How do you deploy safely to a large fleet?',
    senior: 'Use rolling or blue-green deployments with health checks, and roll back automatically on errors.',
    staff: [
      'Canary by blast radius: one host, one AZ, one region, then global, with automated analysis comparing canary vs baseline metrics.',
      'Separate deploy from release with feature flags, which makes rollback a config flip.',
      'Config changes cause as many outages as code; they need the same staged rollout.',
      'Make schema changes backward compatible (expand, migrate, contract) so code can roll back independently.',
    ],
    followUps: ['How do you roll back a database migration?'],
  },
  {
    id: 'rel-7', category: 'Reliability & Observability', level: 'senior',
    q: 'What is the difference between high availability and disaster recovery? Define RPO and RTO.',
    senior: 'HA keeps the service running through component failures (redundancy, failover). DR restores service after a major event such as a region loss. RPO is the maximum acceptable data loss (time); RTO is the maximum acceptable downtime.',
    staff: [
      'RPO drives replication choice: synchronous cross-region for RPO≈0 costs latency; asynchronous means losing seconds of writes.',
      'Backups are only real if restores are tested regularly.',
      'Include dependencies in DR plans: DNS, identity, secrets and the deploy system itself.',
    ],
    followUps: ['What RPO/RTO would you set for a payments ledger vs a news feed?'],
  },

  // ── Case follow-ups ──
  {
    id: 'case-1', category: 'Case follow-ups', level: 'senior',
    q: 'News feed: fan-out on write or fan-out on read?',
    senior: 'Fan-out on write pushes each post into followers\' feed caches, so reads are fast but writes cost as much as the follower count. Fan-out on read builds the feed at request time, so writes are cheap but reads are slow. Use a hybrid: push for most users, pull for celebrities.',
    staff: [
      'The threshold for "celebrity" is tunable, and inactive followers can be skipped during push.',
      'The feed cache stores post IDs only, hydrated at read time, so edits and deletes stay consistent.',
      'Ranking changes the design: you need candidate generation plus scoring, not just a reverse-chronological merge.',
    ],
    followUps: ['How do you handle a user who follows 5,000 accounts?'],
  },
  {
    id: 'case-2', category: 'Case follow-ups', level: 'staff',
    q: 'Chat: how do you route a message to a recipient connected to a different WebSocket server?',
    senior: 'Keep a presence/session registry mapping user → gateway server. The sender\'s server looks up the recipient and forwards via pub/sub or a direct RPC.',
    staff: [
      'Persist the message before acknowledging to the sender; delivery to online devices is best-effort, with sync on reconnect by per-conversation sequence number.',
      'Multi-device: fan out to all of a user\'s sessions and track read receipts per device.',
      'Group chats with thousands of members need fan-out via a queue, not synchronous loops.',
      'The registry is soft state: rebuild it from heartbeats and tolerate staleness.',
    ],
    followUps: ['How do you order messages in a group chat?'],
  },
  {
    id: 'case-3', category: 'Case follow-ups', level: 'senior',
    q: 'Web crawler: how do you avoid overloading a single website?',
    senior: 'Enforce politeness: respect robots.txt, keep one queue per host, and limit concurrent connections and request rate per host.',
    staff: [
      'The frontier has two layers: priority queues (importance, freshness) feeding per-host queues with a scheduler that enforces delays.',
      'Resolve DNS once per host and cache it; DNS is a hidden bottleneck.',
      'Detect crawler traps (infinite calendars, session IDs) with URL normalization, depth limits and per-host page caps.',
    ],
    followUps: ['How do you detect duplicate content across different URLs?'],
  },
  {
    id: 'case-4', category: 'Case follow-ups', level: 'staff',
    q: 'Payment system: how do you guarantee a customer is charged exactly once?',
    senior: 'Use idempotency keys on the charge API and store the payment state machine; retries with the same key return the original result.',
    staff: [
      'Every call to an external PSP carries an idempotency key derived from the payment ID.',
      'Record intent before calling the PSP (state PENDING), then update on response; unknown outcomes (timeouts) go to status polling, never a blind retry with a new key.',
      'Use a double-entry ledger as the source of truth, and run daily reconciliation against PSP settlement files to catch drift.',
      'Money movement is at-least-once with idempotent effects; there is no exactly-once network.',
    ],
    followUps: ['What happens if the PSP times out?'],
  },
  {
    id: 'case-5', category: 'Case follow-ups', level: 'senior',
    q: 'Proximity service: geohash, quadtree or S2? How do you find nearby places?',
    senior: 'Geohash encodes lat/lng into a string whose prefix length sets cell size, so nearby places share prefixes. Query the user\'s cell plus its 8 neighbors. Quadtrees split space adaptively by density; S2 uses a Hilbert curve on a sphere.',
    staff: [
      'Always query neighboring cells: points near a cell edge are close but have different prefixes.',
      'Business data changes slowly, so an in-memory index per region with periodic rebuilds works well.',
      'Separate the read-heavy location search from write-heavy location updates (as in ride-hailing), because they need different stores.',
    ],
    followUps: ['How would this change for moving drivers updating every 4 seconds?'],
  },
  {
    id: 'case-6', category: 'Case follow-ups', level: 'staff',
    q: 'Reservation system: how do you prevent double booking under heavy concurrency?',
    senior: 'Use a database transaction with row locking (SELECT ... FOR UPDATE), or optimistic locking with a version column and retry on conflict.',
    staff: [
      'A unique constraint on (room_type, date, reservation slot) or an inventory counter with a CHECK (reserved ≤ total) makes the DB enforce correctness.',
      'Optimistic locking suits low contention; flash sales need a queue or token-based admission to serialize demand.',
      'Hold inventory with an expiring reservation during checkout, released by a TTL job.',
      'Idempotency keys on booking requests stop double submits from double booking.',
    ],
    followUps: ['How would you handle a concert with 1M users and 50K tickets?'],
  },
  {
    id: 'case-7', category: 'Case follow-ups', level: 'senior',
    q: 'Search autocomplete: how do you serve suggestions under 100 ms?',
    senior: 'Precompute a trie where each node caches its top-K completions; serve it from memory. Rebuild offline from aggregated query logs (e.g. weekly or hourly) and cache hot prefixes at the browser and CDN.',
    staff: [
      'Separate the data pipeline (log aggregation) from serving; serving is a read-only, replicated in-memory structure.',
      'Shard by prefix, but popular prefixes are uneven, so shard by measured load, not by letter.',
      'Add filtering for harmful or legally sensitive suggestions as a serving-layer step that can update quickly.',
    ],
    followUps: ['How do you add trending queries within minutes, not a week?'],
  },
  {
    id: 'case-8', category: 'Case follow-ups', level: 'staff',
    q: 'Ad click aggregation: how do you count clicks accurately with late and duplicate events?',
    senior: 'Stream events through Kafka into a stream processor (e.g. Flink) with tumbling windows, and write aggregates to an OLAP store. Deduplicate by click ID.',
    staff: [
      'Use event time with watermarks; allowed lateness decides when a window is final, and late events trigger corrections.',
      'Exactly-once counts need checkpointed state plus transactional or idempotent sinks.',
      'Reconcile with a batch job over raw events (lambda-style) since billing requires correctness over latency.',
      'Hot ads skew keys, so pre-aggregate with a combiner or salted keys.',
    ],
    followUps: ['What is a watermark, and what happens to an event after it?'],
  },
  {
    id: 'case-9', category: 'Case follow-ups', level: 'senior',
    q: 'File sync (Dropbox/Drive): why split files into chunks?',
    senior: 'Chunking lets you upload only changed chunks (delta sync), resume interrupted uploads, deduplicate identical chunks across users by content hash, and parallelize transfers.',
    staff: [
      'Content-defined chunking (rolling hash) keeps chunk boundaries stable when bytes are inserted, which makes deltas small.',
      'Metadata (file → ordered chunk hashes, versions) lives in a strongly consistent DB; blobs go to object storage.',
      'Conflicts from concurrent edits are resolved by keeping both as conflicting copies rather than silently merging.',
      'Cross-user deduplication has privacy implications (confirming a file exists), so consider per-user scoping.',
    ],
    followUps: ['How do clients learn about changes from other devices?'],
  },

  // ── Trade-offs ──
  {
    id: 'to-1', category: 'Trade-offs', level: 'staff',
    q: 'Monolith or microservices for a new product?',
    senior: 'Start with a well-modularized monolith and extract services when team size, scaling or deployment independence justify it.',
    staff: [
      'Microservices solve organizational scaling (team autonomy) more than technical scaling.',
      'Costs: network failures, distributed transactions, observability and platform investment.',
      'Draw module boundaries around business capabilities now so extraction is cheap later.',
    ],
    followUps: ['What signals tell you it is time to split a service?'],
  },
  {
    id: 'to-2', category: 'Trade-offs', level: 'staff',
    q: 'Build vs buy: when do you use a managed service over running your own?',
    senior: 'Buy managed services for undifferentiated infrastructure (databases, queues) to save operational effort; build when it is core to the product or cost at scale is prohibitive.',
    staff: [
      'Include total cost of ownership: on-call, upgrades and hiring, not just the invoice.',
      'Lock-in is a real risk but often cheaper than the operational burden; mitigate with abstraction at the right layer.',
      'Revisit at scale: some companies bring hot paths in-house once spend justifies a team.',
    ],
    followUps: ['At what spend would you consider self-hosting Kafka?'],
  },
  {
    id: 'to-3', category: 'Trade-offs', level: 'senior',
    q: 'Push vs pull models: where do you use each?',
    senior: 'Push sends data as soon as it is available (notifications, feed fan-out); pull lets consumers fetch at their own pace (polling, Kafka consumers, Prometheus scraping).',
    staff: [
      'Pull gives natural backpressure and simpler failure handling; push gives lower latency but must handle slow consumers.',
      'Hybrid patterns are common: push a small notification, then pull the details.',
      'Monitoring example: Prometheus pull makes target health visible; push suits short-lived batch jobs.',
    ],
    followUps: ['Why does Prometheus pull while StatsD pushes?'],
  },
  {
    id: 'to-4', category: 'Trade-offs', level: 'staff',
    q: 'The interviewer says "now handle 10× the traffic." How do you respond?',
    senior: 'Add more servers, more cache and more shards.',
    staff: [
      'Redo the key estimates first, then name what breaks first: usually the single-writer DB, hot keys, or fan-out cost.',
      'Change the design only where the numbers demand it, and state what stays the same.',
      'Consider the cheap levers before re-architecting: caching, batching, async processing, reducing payload size.',
      'Mention cost: 10× traffic should not mean 10× spend; look for sublinear scaling.',
    ],
    followUps: ['And 100×?'],
  },
  {
    id: 'to-5', category: 'Trade-offs', level: 'senior',
    q: 'Synchronous vs asynchronous processing: how do you decide?',
    senior: 'Synchronous when the user needs the result immediately; asynchronous (queue plus workers) for slow, retryable or spiky work such as email, video processing or reports.',
    staff: [
      'Async improves resilience (buffering spikes, isolating failures) but adds eventual consistency the UX must handle (pending states, notifications).',
      'Keep the synchronous path minimal: validate, persist intent, enqueue, respond.',
      'Every async flow needs visibility: status APIs, DLQs and alerts on stuck work.',
    ],
    followUps: ['How does the client learn when the async job is done?'],
  },
  {
    id: 'to-6', category: 'Trade-offs', level: 'staff',
    q: 'How do you justify a design trade-off to the interviewer convincingly?',
    senior: 'Explain pros and cons of each option and pick the one that fits the requirements.',
    staff: [
      'Anchor on a requirement or number: "because writes are 12K/s, a single primary is enough for 3 years."',
      'State what you give up and why it is acceptable ("feeds may be 5 s stale; users won\'t notice").',
      'Name the reversal condition: what would make you choose differently.',
      'Offer to go deeper on the risky part rather than listing every option.',
    ],
    followUps: ['Pick a decision in your design and argue the opposite.'],
  },
  {
    id: 'to-7', category: 'Trade-offs', level: 'senior',
    q: 'Strong consistency or high availability for a shopping cart?',
    senior: 'Availability: users must always be able to add items. Accept eventual consistency and merge carts on conflict (as in the Dynamo paper). Checkout and inventory, however, need stronger guarantees.',
    staff: [
      'Different parts of one flow need different guarantees; say which operation sits where.',
      'Merge semantics matter: a union of items can resurrect deleted items, which is why Dynamo carts sometimes showed removed items.',
      'CRDTs (e.g. an OR-set) give merge semantics that respect deletions.',
    ],
    followUps: ['How do you avoid overselling the last item in stock?'],
  },
]
