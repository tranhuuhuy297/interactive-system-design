import {
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, References, Tabs,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { LbAlgorithmRaceDemo } from './demos/lb-algorithm-race-demo'
import { LbConsistentHashRingDemo } from './demos/lb-consistent-hash-ring-demo'

const GLOBAL_NODES: ArchNode[] = [
  { id: 'user', label: 'User (Tokyo)', kind: 'client', x: 8, y: 50 },
  { id: 'dns', label: 'GeoDNS / Anycast', sub: 'picks nearest healthy region', kind: 'external', x: 30, y: 50,
    detail: 'GeoDNS answers with the IP of the nearest healthy region. Anycast advertises one IP from many PoPs and lets BGP route to the closest. DNS TTLs limit how fast failover takes effect; anycast reacts in seconds.' },
  { id: 'l4', label: 'L4 LB', sub: 'TCP/UDP, per connection', kind: 'lb', x: 52, y: 28,
    detail: 'Works on IP and port only. Very fast, often done in the kernel with ECMP, IPVS or Maglev-style consistent hashing. It cannot see HTTP paths or headers.' },
  { id: 'l7', label: 'L7 LB / proxy', sub: 'HTTP-aware', kind: 'lb', x: 52, y: 72,
    detail: 'Terminates TLS and routes on path, headers and cookies. Does retries, rate limits and canary splits. Costs more CPU per request than L4.' },
  { id: 'a', label: 'Service pool A', sub: '/api/*', kind: 'service', x: 80, y: 28 },
  { id: 'b', label: 'Service pool B', sub: '/media/*', kind: 'service', x: 80, y: 72 },
]
const GLOBAL_EDGES: ArchEdge[] = [
  { from: 'user', to: 'dns' }, { from: 'dns', to: 'l4' }, { from: 'l4', to: 'l7' },
  { from: 'l7', to: 'a', label: '/api' }, { from: 'l7', to: 'b', label: '/media' },
]

const REFS: Reference[] = [
  { title: "Consistent Hashing and Random Trees", source: "Karger et al., STOC", year: 1997, url: "https://doi.org/10.1145/258533.258660", kind: "paper", note: "Origin of consistent hashing" },
  { title: "Dynamo: Amazon’s Highly Available Key-value Store", source: "DeCandia et al., SOSP", year: 2007, url: "https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf", kind: "paper", note: "Virtual nodes and ring-based partitioning in practice" },
  { title: "The Power of Two Choices in Randomized Load Balancing", source: "M. Mitzenmacher, IEEE TPDS", year: 2001, url: "https://www.eecs.harvard.edu/~michaelm/postscripts/tpds2001.pdf", kind: "paper" },
  { title: "Maglev: A Fast and Reliable Software Network Load Balancer", source: "Eisenbud et al., NSDI", year: 2016, url: "https://research.google/pubs/maglev-a-fast-and-reliable-software-network-load-balancer/", kind: "paper" },
  { title: "A Fast, Minimal Memory, Consistent Hash Algorithm (jump hash)", source: "J. Lamping & E. Veach", year: 2014, url: "https://arxiv.org/abs/1406.2294", kind: "paper" },
  { title: "Consistent Hashing with Bounded Loads", source: "Mirrokni, Thorup & Zadimoghaddam", year: 2016, url: "https://arxiv.org/abs/1608.01350", kind: "paper" },
  { title: "Load Balancing in the Datacenter (Site Reliability Engineering, ch. 20)", source: "Google", year: 2016, url: "https://sre.google/sre-book/load-balancing-datacenter/", kind: "book" },
  { title: "Two random choices", source: "Marc Brooker", year: 2012, url: "https://brooker.co.za/blog/2012/01/17/two-random.html", kind: "blog" },
  { title: "How Elastic Load Balancing works", source: "AWS documentation", url: "https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html", kind: "docs" },
]

export default function LoadBalancingChapter() {
  return (
    <>
      <p>
        A load balancer does three jobs: <strong>spread work</strong> so no single machine melts, <strong>hide
        failures</strong> by routing around unhealthy backends, and give you a <strong>stable front door</strong> so
        you can add, drain and replace servers without clients noticing. Consistent hashing is the companion idea
        for the cases where <em>which</em> server handles a key matters, as with caches, shards and stateful sessions.
      </p>

      <H2 id="l4-vs-l7">L4 vs L7</H2>
      <CompareTable
        columns={['Layer 4 (transport)', 'Layer 7 (application)']}
        rows={[
          { label: 'Sees', cells: ['IP, port, protocol', 'Full HTTP: path, headers, cookies, body'] },
          { label: 'Unit of balancing', cells: ['Connection (or flow)', 'Request'] },
          { label: 'TLS', cells: ['Passed through', 'Usually terminated here'] },
          { label: 'Features', cells: ['Raw throughput, low latency', 'Path routing, retries, auth, canaries, rate limits'] },
          { label: 'Gotcha', cells: ['Long-lived HTTP/2 or gRPC connections pin to one backend', 'CPU cost; it becomes a critical, stateful tier'] },
          { label: 'Examples', cells: ['AWS NLB, IPVS, Maglev, Katran', 'AWS ALB, Envoy, NGINX, HAProxy (HTTP mode)'] },
        ]}
      />
      <Callout kind="pitfall">
        With gRPC or HTTP/2, an L4 balancer spreads <em>connections</em>, but each client keeps a single connection
        open for hours. One backend ends up hot while the rest idle. You need L7 (per-request) balancing or
        client-side balancing.
      </Callout>

      <H2 id="algorithms">Balancing algorithms</H2>
      <ul>
        <li><strong>Round robin / weighted round robin</strong>: simple and stateless. It ignores how busy each server actually is.</li>
        <li><strong>Least connections / least outstanding requests</strong>: adapts to slow requests and slow servers, but needs a global view of load.</li>
        <li><strong>Least response time (EWMA)</strong>: weights servers by recent latency. Good with heterogeneous fleets.</li>
        <li><strong>Power of two choices (P2C)</strong>: sample two servers at random and pick the less loaded. It gets most of least-connections' benefit with almost no coordination, which is why many distributed proxies use it (Envoy's least-request policy, Finagle, Linkerd).</li>
        <li><strong>Hash-based (source IP, header, consistent hash)</strong>: sends the same key to the same server for affinity, at the cost of balance.</li>
      </ul>
      <LbAlgorithmRaceDemo />
      <Callout kind="tip">
        Why does P2C work so well? With purely random placement, the maximum queue grows like log n / log log n.
        Choosing the better of just two random servers drops it to log log n. Most of the gain comes from the
        second choice.
      </Callout>

      <H2 id="health">Health checks, draining & sticky sessions</H2>
      <ul>
        <li><strong>Active checks</strong> probe <code>/healthz</code> on an interval. <strong>Passive checks</strong> (outlier detection) eject a backend after N consecutive 5xx responses or timeouts. Use both.</li>
        <li><strong>Liveness ≠ readiness.</strong> A process can be alive but not ready (cache still warming, dependency down). Route only to ready backends.</li>
        <li><strong>Connection draining</strong>: stop sending new requests, let in-flight requests finish, then terminate. This is essential for zero-downtime deploys.</li>
        <li><strong>Sticky sessions</strong> (cookie or IP affinity) make stateful servers work, but they undermine balancing and failover. Prefer stateless services with state in Redis or the DB.</li>
      </ul>

      <H2 id="global">Global load balancing</H2>
      <ArchitectureDiagram nodes={GLOBAL_NODES} edges={GLOBAL_EDGES} height={320}
        caption="A typical tiered path: DNS or anycast picks a region, L4 spreads connections, L7 routes requests"
        flows={[
          { name: 'API request', path: ['user', 'dns', 'l4', 'l7', 'a'], steps: ['Resolve to the nearest region', 'L4 hashes the flow to one proxy', 'The proxy terminates TLS and matches /api', 'Least-request pick inside pool A'] },
          { name: 'Media request', path: ['user', 'dns', 'l4', 'l7', 'b'], steps: ['Resolve', 'L4 flow hash', 'Match /media', 'Route to pool B'] },
        ]} />

      <H2 id="consistent-hashing">Consistent hashing</H2>
      <p>
        With <code>hash(key) % N</code>, changing N remaps almost every key. For a cache cluster that means a cold
        cache and a stampede on the database. Consistent hashing places servers and keys on a ring. Each key belongs
        to the first server clockwise, so adding or removing a server moves only about <strong>1/N</strong> of the keys.
      </p>
      <LbConsistentHashRingDemo />
      <p>
        With only one point per server, the arcs are wildly uneven. <strong>Virtual nodes</strong> give each
        physical server many points, which smooths the load and lets you weight bigger machines with more points.
        When a server fails, its load spreads across many neighbours instead of landing on one.
      </p>
      <Tabs items={[
        { label: 'Ring lookup', content: <CodeBlock lang="ts" title="consistent-hash.ts" code={`
class HashRing {
  private points: { pos: number; node: string }[] = []

  add(node: string, vnodes = 100) {
    for (let v = 0; v < vnodes; v++) this.points.push({ pos: hash32(\`\${node}#\${v}\`), node })
    this.points.sort((a, b) => a.pos - b.pos)
  }

  remove(node: string) {
    this.points = this.points.filter((p) => p.node !== node)
  }

  owner(key: string): string {
    const h = hash32(key)
    let lo = 0, hi = this.points.length           // binary search: first pos >= h
    while (lo < hi) { const m = (lo + hi) >> 1; this.points[m].pos < h ? (lo = m + 1) : (hi = m) }
    return this.points[lo % this.points.length].node // wrap around
  }
}`} /> },
        { label: 'Alternatives', content: <CompareTable columns={['Idea', 'Trade-off']} rows={[
          { label: 'Rendezvous (HRW)', cells: ['score = hash(key, node); pick the max', 'No ring to store, but O(N) per lookup'] },
          { label: 'Jump hash', cells: ['O(1) memory, near-perfect balance', 'Buckets only added or removed at the end; no arbitrary node removal'] },
          { label: 'Maglev', cells: ['Precomputed lookup table, very fast', 'Built for L4 LBs; small disruption when the table is rebuilt'] },
          { label: 'Bounded loads', cells: ['Consistent hashing plus a per-node capacity cap', 'Spills overflow to the next node, so it handles hot keys'] },
        ]} /> },
      ]} />
      <FlowDiagram steps={[
        { label: 'Cache cluster', sub: 'memcached clients' },
        { label: 'Dynamo / Cassandra', sub: 'partition placement' },
        { label: 'Service mesh', sub: 'session affinity' },
        { label: 'CDN', sub: 'which edge caches an object' },
      ]} caption="Where consistent hashing shows up in real systems" />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <p>The load balancer is itself a distributed system. Staff answers cover:</p>
        <ul>
          <li><strong>The LB must not be a SPOF.</strong> Run active-active pairs with a VIP, ECMP across many L4 nodes, or anycast.</li>
          <li><strong>Retry storms</strong>: L7 retries multiply load during a brownout. Use retry budgets (for example, retries ≤ 10% of requests) and don't retry at every layer.</li>
          <li><strong>Slow start</strong>: a freshly added instance with a cold JIT or cache gets hammered by least-conn because it reports zero connections. Ramp its weight up gradually.</li>
          <li><strong>Hot keys defeat consistent hashing.</strong> A celebrity key still lands on one node. Use bounded-load hashing, replicate hot keys, or add a local cache tier.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Why use consistent hashing instead of hash mod N for a distributed cache?"
        senior={<p>Changing N with modulo hashing remaps almost every key, which empties the cache. With consistent hashing only about 1/N of keys move when a node joins or leaves. Virtual nodes keep the load balanced.</p>}
        staff={<>
          <p>The real cost of mod-N is a <strong>correlated miss storm</strong>: every key misses at once, so the database takes the full read load. That often turns a routine scale-out into an outage. Consistent hashing limits the movement to about 1/N, and virtual nodes spread a failed node's range across many peers instead of doubling one neighbour's load.</p>
          <p>I'd call out what it doesn't solve: hot keys, and the fact that the moved 1/N is still cold. For the hot-key case I'd use bounded-load hashing or key replication. When adding capacity, I'd warm the moved range, or double-read from the old owner during the transition.</p>
        </>}
        followUps={['How many virtual nodes per server, and what does that cost?', 'How do clients learn about ring membership changes?', 'Compare with rendezvous hashing.']}
      />
      <InterviewQuestion
        q="Your gRPC service has 20 pods but two of them run at 90% CPU while the rest idle. What's going on?"
        senior={<p>gRPC uses long-lived HTTP/2 connections, and an L4 load balancer balances connections, not requests. Switch to an L7 proxy like Envoy, or use client-side load balancing.</p>}
        staff={<>
          <p>Connection-level balancing plus HTTP/2 multiplexing means each client pins all of its requests to whichever pod it connected to first, and new pods never get existing clients. I'd fix it in layers:</p>
          <ul>
            <li>Per-request L7 balancing through a mesh sidecar or proxy, or client-side with P2C or least-request.</li>
            <li>A server-side max connection age (<code>MAX_CONNECTION_AGE</code>) so clients reconnect periodically and rebalance.</li>
            <li>Slow-start for new pods.</li>
          </ul>
          <p>Then I'd verify with a per-pod RPS dashboard, not just CPU.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'L4 balances connections quickly; L7 balances requests with full context. Most real paths use both.',
        'Least-outstanding-requests and P2C beat round robin with heavy-tailed costs or mixed hardware.',
        'Health checks need readiness plus outlier ejection. Draining enables zero-downtime deploys.',
        'Consistent hashing moves about 1/N of keys on membership change. Virtual nodes fix skew and spread failover.',
        'Staff depth: the LB is not a SPOF, retry budgets, slow start, and hot keys still need their own fix.',
      ]} />
    </>
  )
}
