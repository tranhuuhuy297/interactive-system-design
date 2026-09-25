export interface Upgrade {
  /** Rubric dimension the upgrade demonstrates. */
  signal: string
  /** What the candidate adds, in their own voice. */
  says: string
  /** Why an interviewer writes this down. */
  why: string
}

export interface UpgradeScenario {
  id: string
  label: string
  question: string
  senior: string
  upgrades: Upgrade[]
}

export const UPGRADE_SCENARIOS: UpgradeScenario[] = [
  {
    id: 'cache', label: 'Add a cache',
    question: 'Reads on the product catalog are slow. How do you fix it?',
    senior: 'Put Redis in front of the database using cache-aside with a TTL. On writes, invalidate the key. That should take most reads off the DB.',
    upgrades: [
      { signal: 'Quantifies', says: 'Catalog reads are about 20K QPS against 50 writes/s, and the hot set is roughly 200K SKUs × 2 KB ≈ 400 MB. That fits in one Redis node with a replica, so no cluster yet.',
        why: 'Numbers turn "add a cache" into a sized decision and show when the answer would change.' },
      { signal: 'Failure modes', says: 'The first thing to break is a stampede when a popular item\'s key expires during a sale. I\'d add single-flight loading and jittered TTLs.',
        why: 'Naming what breaks first, unprompted, is the strongest single staff signal.' },
      { signal: 'Consistency', says: 'Price and stock are different: price can be 60 s stale on listing pages, but checkout reads stock from the DB, never the cache.',
        why: 'Deciding consistency per field ties the design to product impact.' },
      { signal: 'Operability', says: 'I\'d track hit ratio and p99 per endpoint, and alert if the hit ratio drops below 90%. If Redis dies, we fall back to the DB with a concurrency limit, so we degrade instead of cascading.',
        why: 'Monitoring and degraded modes show experience running systems, not just drawing them.' },
      { signal: 'Evolution', says: 'If a CDN-cacheable listing page gets us 80% of the way, I\'d try that first: cheaper, and it removes load before it reaches our services.',
        why: 'Questioning the premise and offering a cheaper option shows judgment about cost and leverage.' },
    ],
  },
  {
    id: 'shard', label: 'Scale the database',
    question: 'The orders database is at 80% CPU and growing 10% a month. What do you do?',
    senior: 'Add read replicas for read traffic, then shard by customer_id when writes become the bottleneck.',
    upgrades: [
      { signal: 'Diagnose first', says: 'Before scaling I\'d check whether it\'s reads, writes, or one bad query. A missing index or an N+1 from a new feature is a common cause of a sudden jump.',
        why: 'Staff engineers find the actual bottleneck before adding infrastructure.' },
      { signal: 'Runway math', says: 'At 10% a month, 80% becomes 100% in about 2–3 months. Replicas and query fixes can buy 6–12 months, which gives time to shard properly instead of in a panic.',
        why: 'Turning growth into a timeline creates a plan leadership can act on.' },
      { signal: 'Trade-offs', says: 'Sharding by customer_id keeps a customer\'s orders on one shard, but reporting across customers moves to a separate analytics store fed by CDC.',
        why: 'Every shard key has a cost; naming who pays it shows depth.' },
      { signal: 'Migration plan', says: 'Pre-split into 1,024 logical shards on 4 physical nodes, backfill plus CDC, shadow reads to verify, then cut over tenant by tenant with a rollback switch.',
        why: 'A safe, incremental migration is what separates designs that ship from diagrams.' },
      { signal: 'Alternatives', says: 'Or we could move to a managed distributed SQL database and avoid building sharding ourselves. That is worth pricing against the engineering months it saves.',
        why: 'Build-vs-buy thinking at the right moment is an organizational-level signal.' },
    ],
  },
  {
    id: 'queue', label: 'Make it async',
    question: 'Order confirmation emails sometimes take 30 seconds and slow down checkout. Fix it.',
    senior: 'Put a message queue between checkout and the email service. Checkout publishes an event and returns; workers send the email.',
    upgrades: [
      { signal: 'Correctness', says: 'Publishing after the DB commit can lose the event if we crash in between. I\'d use a transactional outbox so the order and the event commit together.',
        why: 'Spotting the dual-write problem shows real distributed-systems experience.' },
      { signal: 'Delivery semantics', says: 'Delivery is at-least-once, so the email worker deduplicates on order_id. Customers never get two confirmations.',
        why: 'Pairing at-least-once delivery with idempotency is the expected mature answer.' },
      { signal: 'Failure handling', says: 'If the email provider is down, retries back off with jitter, then go to a DLQ with an alert. Checkout is never affected.',
        why: 'Isolating failures and planning for the poison-message case.' },
      { signal: 'Product', says: 'Product should decide the SLO: "95% of confirmation emails within 60 s." We alert on queue age, not queue depth.',
        why: 'Turning a vague complaint into a measurable SLO and the right alert.' },
    ],
  },
  {
    id: 'region', label: 'Go multi-region',
    question: 'Leadership wants the service to survive a full region outage. Design it.',
    senior: 'Deploy to two regions active-active behind GeoDNS, replicate the database across regions, and fail over automatically.',
    upgrades: [
      { signal: 'Clarify the goal', says: 'What RPO and RTO do we need? "Survive" could mean read-only in 5 minutes or full writes with zero data loss. The costs differ by an order of magnitude.',
        why: 'Pinning the requirement before designing avoids gold-plating.' },
      { signal: 'Data ownership', says: 'Active-active writes to the same rows create conflicts. I\'d home each user to one region and fail over the home region, which is simpler than multi-master.',
        why: 'The hard part of multi-region is data; addressing it directly shows depth.' },
      { signal: 'Capacity', says: 'Each region must absorb the other\'s traffic, so we run each at under 50% utilization. That is the real cost to put in front of leadership.',
        why: 'Surfacing cost and capacity implications is a staff-level expectation.' },
      { signal: 'Prove it', says: 'Failover we never test won\'t work. Quarterly game days that drain a region, plus automated checks for DNS TTLs and hidden single-region dependencies such as auth and config.',
        why: 'Operational rigor: dependencies and rehearsals, not just the architecture.' },
    ],
  },
]
