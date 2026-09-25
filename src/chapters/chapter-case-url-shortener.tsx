import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, References, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { UrlBase62EncoderDemo } from './demos/url-base62-encoder-demo'

const REFS: Reference[] = [
  { title: 'RFC 9110: HTTP Semantics (§15.4 Redirection 3xx, §15.4.2 301, §15.4.3 302)', source: 'IETF', year: 2022, url: 'https://www.rfc-editor.org/rfc/rfc9110', kind: 'rfc', note: '301/302/307 semantics and default cacheability' },
  { title: 'Announcing Snowflake', source: 'Ryan King, Twitter Engineering', year: 2010, url: 'https://blog.x.com/engineering/en_us/a/2010/announcing-snowflake', kind: 'blog', note: 'coordination-free 64-bit IDs' },
  { title: 'Condition expressions (conditional writes)', source: 'Amazon DynamoDB Developer Guide', url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html', kind: 'docs', note: 'put-if-absent for custom aliases' },
  { title: 'Google Safe Browsing', source: 'Google for Developers', url: 'https://developers.google.com/safe-browsing', kind: 'docs', note: 'checking URLs against malware and phishing lists' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 1 (ch. “Design a URL Shortener”)', source: 'Alex Xu', year: 2020, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'client', label: 'Client', sub: 'browser / app', kind: 'client', x: 10, y: 50 },
  { id: 'cdn', label: 'Edge / CDN', sub: 'caches 301s', kind: 'cdn', x: 26, y: 22,
    detail: 'Popular redirects can be served from the edge. Only cache them if you accept losing per-click analytics at the origin, or log clicks at the edge.' },
  { id: 'lb', label: 'Load balancer', kind: 'lb', x: 30, y: 62 },
  { id: 'write', label: 'Shorten API', sub: 'stateless', kind: 'service', x: 52, y: 80,
    detail: 'Validates the URL, checks an optional custom alias, takes the next ID from its locally leased range, and base62-encodes it.' },
  { id: 'read', label: 'Redirect API', sub: 'stateless', kind: 'service', x: 52, y: 40,
    detail: 'Hot path: look up the code in cache, fall back to the DB, return 301/302. Emit a click event asynchronously and never block the redirect on analytics.' },
  { id: 'ids', label: 'ID range allocator', sub: 'ZK / etcd / DB row', kind: 'external', x: 75, y: 88,
    detail: 'Hands each writer a block of e.g. 10,000 IDs. Writers allocate locally with no coordination per request. A crash wastes at most one block, which is fine.' },
  { id: 'cache', label: 'Cache', sub: 'Redis, LRU', kind: 'cache', x: 75, y: 18,
    detail: 'Reads are heavily skewed toward recent and popular links, so a modest cache absorbs most traffic. Use a TTL plus LRU eviction.' },
  { id: 'db', label: 'URL store', sub: 'KV / wide-column', kind: 'db', x: 90, y: 78,
    detail: 'Access is by key only, so a KV or wide-column store (DynamoDB, Cassandra) partitioned by code scales linearly. A relational DB also works at moderate scale.' },
  { id: 'q', label: 'Click stream', sub: 'Kafka', kind: 'queue', x: 75, y: 50,
    detail: 'Click events feed an analytics pipeline off the critical path.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'cdn' }, { from: 'client', to: 'lb' }, { from: 'cdn', to: 'lb' },
  { from: 'lb', to: 'read' }, { from: 'lb', to: 'write' },
  { from: 'read', to: 'cache' }, { from: 'read', to: 'db' }, { from: 'read', to: 'q', async: true },
  { from: 'write', to: 'ids' }, { from: 'write', to: 'db' },
]

export default function UrlShortenerChapter() {
  return (
    <>
      <p>
        The URL shortener is the “hello world” of system design, and that is exactly why it is dangerous. Everyone
        knows the base62 trick, so <strong>interviewers grade you on what comes after</strong>: how you generate
        IDs without a bottleneck, how you keep redirects fast under a 100:1 read skew, and what you trade away when
        you choose 301 over 302.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Given a long URL, return a short one', 'Redirect short → long', 'Optional custom alias', 'Optional expiry']}
        nonFunctional={['100M new URLs/day', 'Redirect p99 < 50 ms', '99.99% availability on redirects', 'Codes should not be guessable in sequence (nice-to-have)']}
        outOfScope={['User accounts & dashboards', 'Link-preview rendering']}
      />
      <Callout kind="tip">
        Ask for the <strong>read:write ratio</strong> and whether <strong>analytics</strong> matter. Both change the
        design: analytics pushes you to 302, and the read skew decides how much cache and edge caching you need.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['100M writes/day, reads 10× writes', 'Retain for 10 years', '~500 bytes per record (URL + metadata)']}
        rows={[
          { label: 'Write QPS', math: '100M / 86,400 s', result: '≈ 1.2K/s' },
          { label: 'Read QPS', math: '1.2K × 10', result: '≈ 12K/s' },
          { label: 'Peak read', math: '12K × 2–3', result: '≈ 30K/s' },
          { label: 'Records (10 yr)', math: '100M × 365 × 10', result: '≈ 365B' },
          { label: 'Storage', math: '365B × 500 B', result: '≈ 180 TB' },
          { label: 'Code space', math: '62⁷', result: '≈ 3.5T ≫ 365B' },
        ]}
      />
      <p>Seven base62 characters are enough, with about 10× headroom. The storage is large but simple, so this is a <strong>partitioned KV</strong> problem, not a relational one.</p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/urls', desc: 'Create a short URL. Idempotent per (user, long URL) if you want de-duplication.', body: '{ longUrl, alias?, expiresAt? }', returns: '201 { code, shortUrl }' },
        { method: 'GET', path: '/{code}', desc: 'Redirect to the long URL.', returns: '301 | 302 Location: longUrl · 404 · 410 if expired' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={400}
        caption="Reads and writes are split into separate services so each scales on its own"
        flows={[
          { name: 'Redirect (cache hit)', path: ['client', 'lb', 'read', 'cache'], steps: ['Client hits sho.rt/abc123', 'LB routes to any redirect node', 'Cache hit → 302 with Location header'] },
          { name: 'Redirect (miss)', path: ['client', 'lb', 'read', 'db'], steps: ['Client request', 'LB → redirect node', 'Cache miss → DB lookup by code, then populate the cache'] },
          { name: 'Shorten', path: ['client', 'lb', 'write', 'db'], steps: ['POST /v1/urls', 'LB → shorten node', 'Allocate ID from the local range, encode base62, write the record'] },
        ]} />

      <H2 id="id-generation">5 · Deep dive: generating the code</H2>
      <UrlBase62EncoderDemo />
      <CompareTable
        columns={['Counter + base62', 'Hash + truncate', 'Random + check']}
        rows={[
          { label: 'Collisions', cells: ['None by construction', 'Possible, so check-and-retry', 'Possible, so check-and-retry'] },
          { label: 'Coordination', cells: ['Needs an ID source (range leasing)', 'None', 'None'] },
          { label: 'Same URL twice', cells: ['Two codes (dedupe separately)', 'Same code (natural dedupe)', 'Two codes'] },
          { label: 'Guessable', cells: ['Sequential; can be shuffled with a bijective permutation', 'No', 'No'] },
          { label: 'Write cost', cells: ['1 write', '1 read + 1 write, more on collision', '1 read + 1 write'] },
        ]}
      />
      <CodeBlock lang="ts" title="range-leased counter (per writer process)" code={`
class IdRange {
  private next = 0n
  private end = 0n

  constructor(private allocator: { lease(size: number): Promise<bigint> }) {}

  async nextId(): Promise<bigint> {
    if (this.next >= this.end) {
      const start = await this.allocator.lease(10_000) // one coordinated call per 10K IDs
      this.next = start
      this.end = start + 10_000n
    }
    return this.next++
  }
}`} />
      <Callout kind="pitfall">
        A single auto-increment column in one database is the classic answer that gets you down-leveled. It is a
        write bottleneck and a single point of failure. Range leasing keeps the simplicity and removes the hot spot.
      </Callout>

      <H2 id="redirects">6 · Deep dive: 301 vs 302 and the read path</H2>
      <CompareTable
        columns={['301 Moved Permanently', '302 Found / 307']}
        rows={[
          { label: 'Browser caching', cells: ['Cacheable by default, so repeat clicks may never reach you', 'Cached only if you send explicit freshness headers'] },
          { label: 'Server load', cells: ['Lower', 'Higher'] },
          { label: 'Analytics', cells: ['Lose repeat clicks', 'Every click observed'] },
          { label: 'Changing target', cells: ['Hard, stale in browsers', 'Easy'] },
        ]}
      />
      <p>
        If clicks are the product, every click must reach you: use <strong>302/307</strong>, or a 301 with a short
        <code>Cache-Control: max-age</code> so browsers only cache it briefly. Keep the redirect path
        lean: cache → DB fallback → respond, with the click event emitted <em>asynchronously</em> to a stream. Add a
        <strong> negative cache</strong> for unknown codes so scanners can't hammer the DB.
      </p>

      <H2 id="data-model">7 · Data model & partitioning</H2>
      <CodeBlock lang="ts" title="record (KV / wide-column)" code={`
// partition key = code  → uniform spread, O(1) lookup
type UrlRecord = {
  code: string        // 'aZ3kP9q'
  longUrl: string
  createdAt: number
  expiresAt?: number  // TTL column in Cassandra/DynamoDB
  ownerId?: string
}`} />

      <H2 id="staff">8 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <p>Seniors finish the diagram. Staff candidates raise the problems that will actually hurt in production:</p>
        <ul>
          <li><strong>Abuse</strong>: phishing and malware links. Add async URL scanning, a blocklist check on redirect, and per-user rate limits on creation.</li>
          <li><strong>Multi-region</strong>: redirects are read-only, so serve them from every region. Give each region its own ID range and write locally with async replication. A code never conflicts.</li>
          <li><strong>Cost</strong>: at 180 TB, storage tiering (hot recent codes vs a cold archive) matters more than CPU.</li>
          <li><strong>Custom aliases</strong> go through a conditional write (<code>PutItem if not exists</code>) to avoid a read-then-write race.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How do you generate unique short codes across many write servers without a bottleneck?"
        senior={<p>Use a distributed ID generator such as Snowflake, or a counter service, then base62-encode the result. Alternatively hash the URL and handle collisions by retrying with a salt.</p>}
        staff={<>
          <p>I'd lease ID ranges: a strongly consistent store such as etcd or a single DB row hands out blocks of about 10K IDs, and each writer allocates locally. Coordination drops to one call per 10K writes, a crash wastes at most one block, and codes never collide.</p>
          <p>If sequential codes are a concern for enumeration or leaking volume, I'd pass the counter through a keyed bijective permutation (e.g. a Feistel network over a 41-bit space, since 2⁴¹ ≈ 2.2T values all fit in 7 base62 characters) before encoding. It stays collision-free but no longer looks sequential. I'd also note that Snowflake's 64-bit IDs encode to 11 characters, which is too long for this product.</p>
        </>}
        followUps={['What happens if the allocator is down?', 'How would you support custom aliases safely?', 'How do you expire links at 365B-record scale?']}
      />
      <InterviewQuestion
        q="Redirect traffic spikes 50× because one link goes viral. What breaks and what do you do?"
        senior={<p>The cache absorbs it because the key is hot. We can add more redirect servers behind the load balancer.</p>}
        staff={<>
          <p>A single hot key can overload <strong>one cache shard</strong>, since all requests for that key hash to the same node. Mitigations, in order:</p>
          <ul>
            <li>A small in-process LRU on each redirect node, which removes the network hop.</li>
            <li>Replicating hot keys across shards.</li>
            <li>Serving from the CDN edge with a short TTL if analytics can be sampled or logged at the edge.</li>
          </ul>
          <p>I'd also make sure the click stream can buffer the spike without applying backpressure to redirects.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Pin down the read:write ratio and analytics needs first. They decide the cache and edge strategy and 301 vs 302.',
        'Seven base62 characters cover about 3.5 trillion codes. Show the math.',
        'Range-leased counters give collision-free codes without a per-request bottleneck.',
        'Separate the read path from the write path. The redirect path must never wait on analytics.',
        'Staff depth: abuse, hot keys, multi-region ID ranges, storage cost.',
      ]} />
    </>
  )
}
