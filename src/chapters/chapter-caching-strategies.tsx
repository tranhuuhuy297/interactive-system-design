import {
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, References, Tabs,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { CacheEvictionSimulatorDemo } from './demos/cache-eviction-simulator-demo'
import { CacheStampedeSimulatorDemo } from './demos/cache-stampede-simulator-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Client', kind: 'client', x: 8, y: 50 },
  { id: 'app', label: 'App server', kind: 'service', x: 34, y: 50,
    detail: 'With cache-aside, the application owns all cache logic. With read-through or write-through, a cache library or proxy hides it.' },
  { id: 'cache', label: 'Cache', sub: 'Redis / Memcached', kind: 'cache', x: 64, y: 22,
    detail: 'In-memory with sub-millisecond reads. Size it by working set, not dataset: often 10–20% of the data serves most reads.' },
  { id: 'queue', label: 'Write buffer', sub: 'async flush', kind: 'queue', x: 88, y: 22,
    detail: 'Write-behind batches writes to the DB. Very fast, but if the cache node dies before flushing, those writes are lost unless the buffer is durable.' },
  { id: 'db', label: 'Database', sub: 'source of truth', kind: 'db', x: 64, y: 80 },
]
const EDGES: ArchEdge[] = [
  { from: 'client', to: 'app' }, { from: 'app', to: 'cache' }, { from: 'app', to: 'db' },
  { from: 'cache', to: 'db' }, { from: 'cache', to: 'queue', async: true }, { from: 'queue', to: 'db', async: true },
]

const REFS: Reference[] = [
  { title: "Scaling Memcache at Facebook", source: "Nishtala et al., NSDI", year: 2013, url: "https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala", kind: "paper", note: "Leases, invalidation and thundering herds" },
  { title: "Optimal Probabilistic Cache Stampede Prevention", source: "Vattani, Chierichetti & Lowenstein, VLDB", year: 2015, url: "https://www.vldb.org/pvldb/vol8/p886-vattani.pdf", kind: "paper", note: "Probabilistic early expiration (XFetch)" },
  { title: "Caching challenges and strategies", source: "Amazon Builders’ Library", url: "https://aws.amazon.com/builders-library/caching-challenges-and-strategies/", kind: "blog" },
  { title: "Key eviction", source: "Redis documentation", url: "https://redis.io/docs/latest/develop/reference/eviction/", kind: "docs" },
  { title: "RFC 9111: HTTP Caching", source: "IETF", year: 2022, url: "https://www.rfc-editor.org/rfc/rfc9111", kind: "rfc" },
  { title: "Space/Time Trade-offs in Hash Coding with Allowable Errors", source: "B. H. Bloom, Communications of the ACM", year: 1970, url: "https://doi.org/10.1145/362686.362692", kind: "paper", note: "Bloom filters" },
]

export default function CachingChapter() {
  return (
    <>
      <p>
        Caching is the cheapest performance win in system design and one of the most common sources of subtle
        bugs. The questions that matter are <strong>where</strong> to cache, <strong>how</strong> reads and writes
        flow, <strong>what gets evicted</strong>, and <strong>what happens when the cache is wrong or empty</strong>.
      </p>

      <H2 id="layers">Where to cache</H2>
      <FlowDiagram steps={[
        { label: 'Client', sub: 'HTTP cache, app memory' },
        { label: 'CDN / edge', sub: 'static + cacheable GETs' },
        { label: 'Gateway / LB', sub: 'response cache' },
        { label: 'App local', sub: 'in-process LRU' },
        { label: 'Distributed', sub: 'Redis / Memcached' },
        { label: 'DB', sub: 'buffer pool, query cache' },
      ]} caption="Each layer closer to the user is faster and cheaper, but harder to invalidate" />
      <Callout kind="tip">
        In-process caches cost nothing per lookup but go incoherent across N servers. A distributed cache is
        coherent but adds a network hop. A common production pattern is <strong>two tiers</strong>: a small local LRU
        with a short TTL in front of Redis, which also shields Redis from hot keys.
      </Callout>

      <H2 id="patterns">Read & write patterns</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={330}
        caption="Pick a pattern to trace the request path"
        flows={[
          { name: 'Cache-aside read', path: ['client', 'app', 'cache', 'app', 'db', 'app', 'cache'],
            steps: ['Request arrives', 'App checks the cache', 'Miss returned', 'App reads the DB', 'Row returned', 'App populates the cache with a TTL'] },
          { name: 'Read-through', path: ['client', 'app', 'cache', 'db'],
            steps: ['Request arrives', 'App asks the cache only', 'On a miss the cache loads from the DB itself'] },
          { name: 'Write-through', path: ['client', 'app', 'cache', 'db'],
            steps: ['Write request', 'App writes to the cache layer', 'Cache synchronously writes the DB before acking'] },
          { name: 'Write-behind', path: ['client', 'app', 'cache', 'queue', 'db'],
            steps: ['Write request', 'Cache updated, ack immediately', 'Change buffered', 'Flushed to the DB asynchronously in batches'] },
          { name: 'Write-around', path: ['client', 'app', 'db'],
            steps: ['Write request', 'App writes the DB directly and deletes the cached key'] },
        ]} />
      <CompareTable
        columns={['Latency', 'Consistency', 'Risk', 'Use when']}
        rows={[
          { label: 'Cache-aside', cells: ['Miss = 3 hops', 'Stale until TTL or invalidation', 'Race on concurrent write + read', 'The default for read-heavy apps'] },
          { label: 'Read-through', cells: ['Same as cache-aside', 'Same', 'Cache becomes critical infra', 'You want the logic out of app code'] },
          { label: 'Write-through', cells: ['Slower writes', 'Cache always fresh', 'Caches data nobody reads', 'Read-after-write matters'] },
          { label: 'Write-behind', cells: ['Fastest writes', 'DB lags', 'Data loss on crash', 'Counters, metrics, write bursts'] },
          { label: 'Write-around', cells: ['Normal writes', 'First read misses', 'Cold reads after writes', 'Write-once, read-rarely data'] },
        ]}
      />

      <H2 id="eviction">Eviction policies</H2>
      <p>
        When memory is full, something has to go. <strong>LRU</strong> bets on recency, <strong>LFU</strong> on
        long-term popularity, <strong>FIFO</strong> on insertion order. Real systems use approximations. Redis
        samples a few keys for approximate LRU/LFU instead of keeping a global ordered list. Modern designs like
        W-TinyLFU (Caffeine) combine a recency window with a frequency sketch to resist scans.
      </p>
      <CacheEvictionSimulatorDemo />

      <H2 id="invalidation">Invalidation & consistency</H2>
      <p>The classic cache-aside race, even when you “delete on write”:</p>
      <CodeBlock lang="text" title="stale forever (until TTL)" code={`
t1  Reader A: cache miss → reads DB (value = v1)
t2  Writer B: updates DB to v2
t3  Writer B: deletes cache key
t4  Reader A: writes v1 into cache   ← stale value repopulated after the delete`} />
      <ul>
        <li><strong>Always set a TTL</strong>, so every bug has a bounded lifetime.</li>
        <li><strong>Delete, don't update</strong> the cache on writes. Updating races even worse.</li>
        <li><strong>Delayed double delete</strong>, or <strong>versioned values</strong> with compare-and-set, shrink the race window.</li>
        <li><strong>CDC-driven invalidation</strong> (DB binlog → Kafka → invalidator) removes the dual-write problem from app code.</li>
        <li>Leases, as used in Facebook's memcache, let the cache refuse a stale set from a reader that started before the delete.</li>
      </ul>

      <H2 id="failure-modes">Failure modes: stampede, penetration, avalanche, hot keys</H2>
      <CacheStampedeSimulatorDemo />
      <Tabs items={[
        { label: 'Stampede', content: <p className="muted">A hot key expires and thousands of requests recompute it at once. Fixes: <strong>request coalescing</strong> (single-flight per key per process, or a distributed lock), <strong>probabilistic early refresh</strong> (XFetch), <strong>serve stale while revalidating</strong>.</p> },
        { label: 'Penetration', content: <p className="muted">Requests for keys that don't exist always miss and hit the DB, often from scanners or attackers. Fixes: <strong>negative caching</strong> (cache “not found” with a short TTL), a <strong>Bloom filter</strong> of existing keys in front of the cache, and input validation.</p> },
        { label: 'Avalanche', content: <p className="muted">Many keys expire at the same moment (all set at deploy with the same TTL), or the cache cluster restarts cold. Fixes: <strong>TTL jitter</strong> (TTL ± random 10–20%), warming before cutover, replicated cache tiers, and a circuit breaker or rate limit on the DB path.</p> },
        { label: 'Hot key', content: <p className="muted">One key receives a big share of traffic and saturates a single cache shard. Fixes: <strong>local L1 cache</strong>, <strong>key replication</strong> (<code>key#0..k</code> spread across shards, read one at random), and read replicas for the shard.</p> },
      ]} />
      <CodeBlock lang="ts" title="single-flight + stale-while-revalidate" code={`
const inflight = new Map<string, Promise<Value>>()

async function get(key: string): Promise<Value> {
  const entry = await cache.get(key)             // { value, softExpiry }
  if (entry && Date.now() < entry.softExpiry) return entry.value

  if (entry) {                                    // stale: serve it, refresh in background
    refresh(key).catch(() => {})
    return entry.value
  }
  return refresh(key)                             // hard miss: everyone awaits one load
}

function refresh(key: string): Promise<Value> {
  let p = inflight.get(key)
  if (!p) {
    p = loadFromDb(key)
      .then((v) => cache.set(key, { value: v, softExpiry: Date.now() + TTL }, { ttl: TTL * 2 }).then(() => v))
      .finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  return p
}`} />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>The cache is load-bearing.</strong> At 95% hit rate the DB sees 5% of traffic. If the cache dies, the DB sees 20× its normal load and falls over too. Capacity-plan the DB for a cache failure, or have load shedding ready.</li>
          <li><strong>Measure hit rate per key class</strong>, not globally. A 99% overall hit rate can hide a 40% hit rate on the endpoint that matters.</li>
          <li><strong>Cache consistency is a product decision.</strong> Ask what the user sees if the data is 30 seconds stale. Prices and inventory get different answers than avatars.</li>
          <li><strong>Cost</strong>: RAM is expensive. Weigh the p99 improvement against the cost of the cluster versus adding a DB index.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How do you keep a cache consistent with the database?"
        senior={<p>Cache-aside with delete-on-write and a TTL. For stricter needs use write-through. Accept eventual consistency within the TTL window.</p>}
        staff={<>
          <p>First, what staleness is acceptable for each data class? That drives everything else. Then I'd name the concrete race (a reader repopulates stale data after the writer's delete) and pick mitigations to match:</p>
          <ul>
            <li>TTL as a backstop for every key.</li>
            <li>Delete rather than set.</li>
            <li>Versioned compare-and-set or leases to reject stale fills.</li>
            <li>Invalidation from CDC (binlog → stream) so there is no dual-write in app code, with retries and idempotent deletes.</li>
          </ul>
          <p>For read-your-writes, I'd route the writer's own reads to the DB, or pin a version in their session, for a short window.</p>
        </>}
        followUps={['What if the invalidation message is lost?', 'How would you cache a list/feed rather than a single row?', 'Multi-region caches?']}
      />
      <InterviewQuestion
        q="Your cache cluster restarted and the database went down right after. Walk me through what happened and how to prevent it."
        senior={<p>The cache was empty, so every request went to the database and overloaded it. Warm the cache before sending traffic, and add TTL jitter.</p>}
        staff={<>
          <p>This is a cold-cache avalanche: DB load jumped by 1/(1 − hit rate), roughly 20× at a 95% hit rate. Timeouts caused retries, and the retries amplified the load further. Prevention works in layers:</p>
          <ul>
            <li><strong>Avoid cold restarts</strong>: replicas, rolling restarts, persistence or snapshots.</li>
            <li><strong>Protect the DB</strong>: single-flight fills, concurrency limits on the DB path, load shedding, retry budgets.</li>
            <li><strong>Degrade gracefully</strong>: serve stale values or a reduced feature set.</li>
            <li><strong>Test it</strong>: a game day that kills the cache in staging.</li>
          </ul>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Cache-aside plus TTL plus delete-on-write is the default. Know its race condition and the fixes.',
        'Write-through buys freshness with write latency; write-behind buys speed with durability risk.',
        'LRU favours recency, LFU resists scans. Production caches use sampled or TinyLFU approximations.',
        'Stampede, penetration, avalanche and hot keys each have a named fix: coalescing and XFetch, negative caching and Bloom filters, TTL jitter, key replication.',
        'Staff depth: the cache is load-bearing, so plan the DB for cache loss, and staleness per data class is a product decision.',
      ]} />
    </>
  )
}
