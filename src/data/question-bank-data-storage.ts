import type { BankQuestion } from './question-bank-data'

/** Databases, Consistency & Consensus, Messaging. */
export const STORAGE_QUESTIONS: BankQuestion[] = [
  // ── Databases ──
  {
    id: 'db-1', category: 'Databases', level: 'senior',
    q: 'SQL or NoSQL: how do you decide?',
    senior: 'SQL for relational data, transactions, joins and flexible queries. NoSQL (key-value, wide-column, document) for massive scale with simple access patterns, flexible schemas, or very high write throughput.',
    staff: [
      'Start from access patterns and consistency needs, not from the data shape.',
      'Modern SQL scales further than people assume (read replicas, partitioning, and distributed SQL like Spanner or CockroachDB).',
      'NoSQL shifts work to the application: denormalization, secondary indexes and multi-item consistency become your problem.',
      'Operational familiarity counts: the team\'s ability to run it at 3 a.m. is a legitimate criterion.',
    ],
    followUps: ['When would you pick DynamoDB over Postgres for a new service?'],
  },
  {
    id: 'db-2', category: 'Databases', level: 'senior',
    q: 'B-tree vs LSM-tree storage engines: what are the trade-offs?',
    senior: 'B-trees update pages in place and are good for read-heavy workloads with predictable reads (Postgres, MySQL/InnoDB). LSM-trees buffer writes in memory, flush sorted files and compact them later. They are optimized for writes (Cassandra, RocksDB) but reads may touch several files.',
    staff: [
      'Frame it as amplification trade-offs: LSMs have lower write amplification but more read and space amplification; B-trees the reverse.',
      'LSM reads rely on Bloom filters and compaction strategy (size-tiered vs leveled) to stay fast.',
      'Compaction competes with foreground traffic, which shows up as latency spikes; plan capacity for it.',
    ],
    followUps: ['Why does an LSM need Bloom filters?'],
  },
  {
    id: 'db-3', category: 'Databases', level: 'senior',
    q: 'How do you choose a shard key?',
    senior: 'Pick a key with high cardinality and even distribution that matches the main access pattern, so most queries hit one shard. For example, user_id for per-user data.',
    staff: [
      'Beware of monotonically increasing keys (timestamps) with range sharding, which send every write to the last shard.',
      'Cross-shard queries and transactions get expensive, so design so the common path stays within one shard.',
      'Plan for hot entities (celebrities, big tenants): isolate them or split them further.',
      'Changing a shard key later is a migration project, so treat it as a one-way door and decide carefully.',
    ],
    followUps: ['How would you shard a multi-tenant SaaS with some huge tenants?'],
  },
  {
    id: 'db-4', category: 'Databases', level: 'staff',
    q: 'Walk through resharding a live database with no downtime.',
    senior: 'Create the new shards, copy the data, then switch traffic. Use consistent hashing so less data moves.',
    staff: [
      'Phases: backfill a snapshot, then stream changes (CDC) to catch up, then dual-read to verify, then cut over writes per key range, then decommission.',
      'Use a directory or lookup service (or logical shards mapped to physical nodes) so moving data is a mapping change, not a rehash.',
      'Pre-split into many logical shards up front (e.g. 4096) so future scaling moves whole logical shards.',
      'Have a rollback path and consistency checks (row counts and checksums) at every phase.',
    ],
    followUps: ['How do you handle writes that arrive during cutover?'],
  },
  {
    id: 'db-5', category: 'Databases', level: 'senior',
    q: 'How do database indexes speed up reads, and what do they cost?',
    senior: 'An index is a sorted structure (usually a B-tree) that lets the DB find rows without a full scan. Composite indexes follow the left-prefix rule. Each index slows writes and uses storage.',
    staff: [
      'Covering indexes serve the query from the index alone, avoiding table lookups.',
      'In distributed or NoSQL stores, secondary indexes are either local (scatter-gather reads) or global (asynchronously updated and eventually consistent).',
      'Index design follows the query plan: check with EXPLAIN, not intuition.',
    ],
    followUps: ['Local vs global secondary indexes in DynamoDB/Cassandra?'],
  },
  {
    id: 'db-6', category: 'Databases', level: 'senior',
    q: 'What does replication lag break, and how do you mitigate it?',
    senior: 'Reading from a lagging replica can return stale data, so a user may not see their own write. Mitigations: read your own writes from the primary, route by session, or wait for the replica to reach a given log position.',
    staff: [
      'Name the anomalies: no read-your-writes, non-monotonic reads (time goes backward across replicas), and inconsistent prefix reads.',
      'Pin a user to one replica, or track the last-write LSN in their session and only read from replicas that have caught up.',
      'Monitor lag as an SLO and remove lagging replicas from rotation automatically.',
    ],
    followUps: ['How do you implement read-your-writes across a fleet of replicas?'],
  },
  {
    id: 'db-7', category: 'Databases', level: 'staff',
    q: 'When would you denormalize, and how do you keep denormalized data correct?',
    senior: 'Denormalize to avoid expensive joins on hot read paths, for example storing the author name on each post. Update copies when the source changes.',
    staff: [
      'Treat denormalized data as a derived view: one source of truth, with copies updated from its change stream.',
      'Decide tolerated staleness per field: a display name can lag, a price used at checkout cannot.',
      'Rebuildability is the safety net: you should be able to regenerate derived views from the log.',
    ],
    followUps: ['What is the risk of dual writes, and how does the outbox pattern fix it?'],
  },

  // ── Consistency & Consensus ──
  {
    id: 'cc-1', category: 'Consistency & Consensus', level: 'senior',
    q: 'Explain CAP, and why PACELC is a more useful framing.',
    senior: 'CAP says that during a network partition you must choose consistency or availability. PACELC adds that even without a partition you trade latency against consistency.',
    staff: [
      'Partitions are rare, but the latency/consistency trade-off applies to every request, which is why PACELC is more practical.',
      '"CP" and "AP" describe behavior under a partition for a specific operation, not a whole database; many systems are tunable per request.',
      'Tie it to the product: a checkout must refuse rather than oversell, while a like counter can be approximate.',
    ],
    followUps: ['Give an example of a system that is PA/EL and one that is PC/EC.'],
  },
  {
    id: 'cc-2', category: 'Consistency & Consensus', level: 'senior',
    q: 'How do quorum reads and writes (N, R, W) give consistency?',
    senior: 'With N replicas, a write waits for W acknowledgements and a read queries R replicas. If R + W > N, the read and write sets overlap, so a read sees at least one up-to-date replica.',
    staff: [
      'R + W > N is not linearizability on its own: concurrent writes, sloppy quorums and read repair timing can still expose anomalies.',
      'Tuning: W = N gives fast reads and fragile writes; R = 1 with W = N suits read-heavy data; W = 1 favors availability.',
      'Sloppy quorums with hinted handoff keep writes available during failures but break the overlap guarantee.',
      'Conflicts need a resolution policy: last-write-wins (loses data), vector clocks (siblings), or CRDTs.',
    ],
    followUps: ['Why is last-write-wins dangerous with clock skew?'],
  },
  {
    id: 'cc-3', category: 'Consistency & Consensus', level: 'senior',
    q: 'At a high level, how does Raft elect a leader and replicate a log?',
    senior: 'Nodes are followers, candidates or leaders. A follower that stops hearing heartbeats becomes a candidate, increments the term and requests votes, and wins with a majority. The leader appends entries and replicates them; an entry is committed once a majority has stored it.',
    staff: [
      'Randomized election timeouts avoid split votes.',
      'Terms act as a logical clock: a stale leader discovers a higher term and steps down, which prevents split brain.',
      'A 5-node cluster tolerates 2 failures; more nodes add fault tolerance but slow writes.',
      'You rarely implement Raft; you use etcd, ZooKeeper or a DB built on consensus, and keep them off the hot data path.',
    ],
    followUps: ['Why do consensus clusters use odd sizes?'],
  },
  {
    id: 'cc-4', category: 'Consistency & Consensus', level: 'staff',
    q: 'How do you prevent a zombie leader from corrupting data after a failover?',
    senior: 'Use leader election with leases so only one leader is active at a time.',
    staff: [
      'Leases alone are unsafe: a GC pause or clock skew can let an old leader act after its lease expired.',
      'Use fencing tokens: each new leader gets a monotonically increasing token, and storage rejects writes with an older token.',
      'The storage layer must enforce fencing; the client cannot be trusted to know it is stale.',
    ],
    followUps: ['Where have you seen split brain in practice?'],
  },
  {
    id: 'cc-5', category: 'Consistency & Consensus', level: 'senior',
    q: 'Compare strong, causal and eventual consistency with product examples.',
    senior: 'Strong (linearizable): every read sees the latest write, needed for things like balances. Causal: related operations are seen in order, so a reply never appears before its comment. Eventual: replicas converge over time, fine for likes or view counts.',
    staff: [
      'Consistency is a per-feature decision; one product usually mixes several models.',
      'Session guarantees (read-your-writes, monotonic reads) fix most user-visible anomalies cheaply.',
      'Stronger models cost latency (coordination) and availability during partitions.',
    ],
    followUps: ['Which consistency model does a chat app need for message order?'],
  },
  {
    id: 'cc-6', category: 'Consistency & Consensus', level: 'staff',
    q: 'How do you coordinate a transaction across multiple services?',
    senior: 'Use two-phase commit for atomicity, or sagas: a sequence of local transactions with compensating actions on failure.',
    staff: [
      '2PC blocks if the coordinator fails and couples availability across services, so it is rarely used across service boundaries.',
      'Sagas trade atomicity for availability: intermediate states are visible, so design for them (e.g. a "pending" order).',
      'Choreography (events) vs orchestration (a central workflow engine such as Temporal): orchestration is easier to reason about and observe at scale.',
      'Compensations must be idempotent and may themselves fail, which needs retries and manual escalation paths.',
    ],
    followUps: ['How do you handle a saga step that cannot be compensated, such as a sent email?'],
  },
  {
    id: 'cc-7', category: 'Consistency & Consensus', level: 'staff',
    q: 'Why are wall clocks dangerous in distributed systems, and what do you use instead?',
    senior: 'Clocks drift and NTP corrections can move them backward, so timestamps from different machines are not reliably ordered. Use logical clocks or sequence numbers.',
    staff: [
      'Lamport clocks give a total order consistent with causality; vector clocks detect concurrency.',
      'Hybrid logical clocks (HLC) combine physical time with logical counters and are used by CockroachDB and others.',
      'Spanner\'s TrueTime exposes bounded uncertainty and waits it out for external consistency, which requires special hardware.',
    ],
    followUps: ['When is last-write-wins by timestamp acceptable?'],
  },

  // ── Messaging ──
  {
    id: 'msg-1', category: 'Messaging', level: 'senior',
    q: 'Queue vs log (e.g. RabbitMQ/SQS vs Kafka): what is the difference?',
    senior: 'A queue delivers each message to one consumer and deletes it after acknowledgement, which is good for task distribution. A log is an append-only, retained, partitioned stream; consumers track offsets, can replay, and multiple consumer groups read independently.',
    staff: [
      'Logs enable replay, new consumers joining later and event sourcing; queues are simpler for work dispatch with per-message retries and delays.',
      'Kafka orders messages only within a partition, and parallelism is capped by the partition count.',
      'Poison messages behave differently: queues have per-message dead-letter queues, while a log partition can be blocked by one bad record unless you skip it or route it to a DLQ topic.',
    ],
    followUps: ['How do you choose the number of Kafka partitions?'],
  },
  {
    id: 'msg-2', category: 'Messaging', level: 'senior',
    q: 'At-most-once, at-least-once, exactly-once: what do they mean in practice?',
    senior: 'At-most-once may lose messages; at-least-once may duplicate them; exactly-once means effects happen once. Most systems use at-least-once delivery plus idempotent consumers.',
    staff: [
      '"Exactly-once" is really exactly-once processing: Kafka transactions give it within Kafka (read-process-write), but external side effects still need idempotency.',
      'Deduplicate with a processed-ID store, or make writes naturally idempotent (upserts keyed by event ID).',
      'Commit offsets after processing for at-least-once; committing before gives at-most-once.',
    ],
    followUps: ['How would you get exactly-once effects into an external database?'],
  },
  {
    id: 'msg-3', category: 'Messaging', level: 'staff',
    q: 'What is the dual-write problem and how does the transactional outbox solve it?',
    senior: 'Writing to the DB and publishing an event separately can leave them inconsistent if one fails. The outbox writes the event into a DB table in the same transaction; a relay publishes it later.',
    staff: [
      'The relay can be a poller or CDC on the outbox table (e.g. Debezium); CDC gives lower latency and less DB load.',
      'Delivery becomes at-least-once, so consumers must be idempotent.',
      'Ordering per aggregate is preserved by partitioning on the aggregate ID.',
      'An alternative is event sourcing, where the log is the source of truth, but that is a much larger commitment.',
    ],
    followUps: ['How do you clean up the outbox table?'],
  },
  {
    id: 'msg-4', category: 'Messaging', level: 'senior',
    q: 'How do you handle backpressure when consumers cannot keep up?',
    senior: 'Let the queue buffer, scale consumers horizontally, and alert on growing lag. If lag keeps growing, shed or throttle producers.',
    staff: [
      'Scale on lag, not CPU; consumer parallelism is bounded by partitions, so over-provision partitions up front.',
      'Decide what to drop under overload: sample analytics events, never drop payments.',
      'Keep retries off the main path: retry topics with delays prevent slow failures from blocking healthy traffic.',
    ],
    followUps: ['What metrics tell you a consumer is falling behind?'],
  },
  {
    id: 'msg-5', category: 'Messaging', level: 'senior',
    q: 'How do you guarantee message ordering?',
    senior: 'Send related messages to the same partition using a key (e.g. user_id), and process each partition with one consumer at a time.',
    staff: [
      'Only order what needs it: per-entity ordering is cheap, global ordering kills parallelism.',
      'Retries can reorder messages; per-key sequential processing or version numbers let consumers reject stale events.',
      'Repartitioning (changing the partition count) breaks key-to-partition mapping, so plan partition counts ahead.',
    ],
    followUps: ['What happens to ordering when you add partitions?'],
  },
  {
    id: 'msg-6', category: 'Messaging', level: 'staff',
    q: 'When is event-driven architecture the wrong choice?',
    senior: 'When you need an immediate response or a simple request/response call; events add latency and complexity.',
    staff: [
      'Debugging and tracing asynchronous flows is harder, so it needs correlation IDs and good tooling.',
      'Events become contracts: schema evolution needs a registry and compatibility rules.',
      'Hidden coupling: consumers depend on event semantics nobody documents, and the producer cannot see who breaks.',
      'Use events for fan-out and decoupling; use synchronous calls where the caller needs the answer.',
    ],
    followUps: ['How do you evolve an event schema without breaking consumers?'],
  },
]
