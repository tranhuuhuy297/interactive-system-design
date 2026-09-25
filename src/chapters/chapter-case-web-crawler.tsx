import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, References, Requirements, TLDR, Term,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { CrawlerBloomCalculator } from './demos/crawler-bloom-calculator'
import { CrawlerFrontierSim } from './demos/crawler-frontier-sim'

const REFS: Reference[] = [
  { title: 'RFC 9309: Robots Exclusion Protocol', source: 'IETF', year: 2022, url: 'https://www.rfc-editor.org/rfc/rfc9309', kind: 'rfc' },
  { title: 'Mercator: A scalable, extensible Web crawler', source: 'A. Heydon & M. Najork, World Wide Web journal', year: 1999, url: 'https://doi.org/10.1023/A:1019213109274', kind: 'paper', note: 'crawler architecture, URL-seen test' },
  { title: 'Introduction to Information Retrieval, §20.2.3 The URL frontier', source: 'C. Manning, P. Raghavan, H. Schütze (Cambridge UP)', year: 2008, url: 'https://nlp.stanford.edu/IR-book/html/htmledition/the-url-frontier-1.html', kind: 'book', note: 'front queues (priority) and back queues (politeness)' },
  { title: 'Detecting Near-Duplicates for Web Crawling', source: 'G. S. Manku, A. Jain, A. Das Sarma (WWW)', year: 2007, url: 'https://research.google/pubs/detecting-near-duplicates-for-web-crawling/', kind: 'paper', note: '64-bit SimHash, Hamming distance ≤ 3' },
  { title: 'Space/time trade-offs in hash coding with allowable errors', source: 'Burton H. Bloom, Communications of the ACM', year: 1970, url: 'https://doi.org/10.1145/362686.362692', kind: 'paper', note: 'Bloom filters' },
  { title: 'On the resemblance and containment of documents', source: 'Andrei Z. Broder (SEQUENCES ’97)', year: 1997, url: 'https://doi.org/10.1109/SEQUEN.1997.666900', kind: 'paper', note: 'shingling / near-duplicate detection' },
  { title: 'The Anatomy of a Large-Scale Hypertextual Web Search Engine', source: 'S. Brin & L. Page', year: 1998, url: 'http://infolab.stanford.edu/~backrub/google.html', kind: 'paper', note: 'early distributed crawler design' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 1 (ch. “Design a Web Crawler”)', source: 'Alex Xu', year: 2020, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'seeds', label: 'Seed URLs', sub: 'curated', kind: 'client', x: 10, y: 18,
    detail: 'Starting points, chosen for coverage: popular domains per country or topic, plus sitemap.xml feeds. Poor seeds mean a crawl that never reaches large parts of the web.' },
  { id: 'frontier', label: 'URL frontier', sub: 'priority · polite', kind: 'queue', x: 29, y: 18,
    detail: 'Front queues order URLs by importance (PageRank-like score, freshness). Back queues map one host to one queue so a single worker owns each host and politeness can be enforced locally.' },
  { id: 'fetcher', label: 'Fetchers', sub: 'async HTTP', kind: 'worker', x: 50, y: 18,
    detail: 'Thousands of concurrent connections per box using async I/O. They respect robots.txt (cached per host), set timeouts, cap page size, and follow redirects with a limit.' },
  { id: 'dns', label: 'DNS cache', sub: 'local resolver', kind: 'cache', x: 50, y: 50,
    detail: 'DNS lookups often take tens of milliseconds and are synchronous in many libraries. A local caching resolver per crawler node removes one of the biggest hidden bottlenecks.' },
  { id: 'web', label: 'The web', kind: 'external', x: 71, y: 50 },
  { id: 'parser', label: 'Parse + dedup', sub: 'SimHash', kind: 'service', x: 71, y: 18,
    detail: 'Parses HTML, rejects malformed pages, and detects exact duplicates (content hash) and near-duplicates (SimHash fingerprints). Mirrors and boilerplate-heavy pages make up a large share of the web.' },
  { id: 'extract', label: 'Link extractor', sub: 'normalize + filter', kind: 'service', x: 71, y: 82,
    detail: 'Resolves relative links, lowercases the host, strips fragments and known session parameters, and drops blocked extensions and URLs over a length or depth limit (trap defense).' },
  { id: 'seen', label: 'URL seen?', sub: 'Bloom filter', kind: 'cache', x: 50, y: 82,
    detail: 'Probabilistic membership check before enqueueing. A false positive skips one page; it never re-crawls in a loop.' },
  { id: 'store', label: 'Content store', sub: 'blobs', kind: 'storage', x: 90, y: 18,
    detail: 'Compressed page bodies in blob storage (WARC-style), keyed by URL hash plus crawl time. Metadata (status, last-modified, ETag, fingerprint) goes to a wide-column store for recrawl scheduling.' },
]

const EDGES: ArchEdge[] = [
  { from: 'seeds', to: 'frontier' }, { from: 'frontier', to: 'fetcher' }, { from: 'fetcher', to: 'dns' },
  { from: 'fetcher', to: 'web' }, { from: 'fetcher', to: 'parser' }, { from: 'parser', to: 'store' },
  { from: 'parser', to: 'extract' }, { from: 'extract', to: 'seen' }, { from: 'seen', to: 'frontier', async: true },
]

export default function WebCrawlerChapter() {
  return (
    <>
      <TLDR items={[
        'Fetch billions of pages, extract links, and feed new URLs back in, in a continuous loop.',
        'The URL frontier is the heart: priority queues pick what matters, per-host queues keep you polite.',
        'Partition hosts across crawler nodes so each host’s rate limit lives in one process.',
        'Normalize URLs and use a Bloom filter to skip what you have already seen; fingerprints catch near-duplicates.',
        'Defend against spider traps, and recrawl pages based on how often they actually change.',
      ]} />

      <p>
        A crawler looks like a breadth-first search over a graph, and in an interview it is easy to treat it that
        way. The hard parts are elsewhere.
      </p>
      <p>
        You must <strong>be polite</strong> to billions of servers you don't own. You must{' '}
        <strong>not drown in duplicates and traps</strong>. And you must choose <em>which</em> pages matter, because
        you will never fetch them all.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>Pin down the scale, what content counts, and what the crawl is for.</p>
      <Requirements
        functional={['Crawl HTML pages from seed URLs', 'Extract links and discover new pages', 'Store content for a search indexer', 'Recrawl pages based on how often they change']}
        nonFunctional={['~2B pages / month', 'Politeness: never overload a host', 'Robust to traps, malformed HTML, slow servers', 'Horizontally scalable; extensible to new content types']}
        outOfScope={['Ranking / indexing', 'JavaScript-rendered SPAs (mention as an extension)', 'Images and video']}
      />
      <Callout kind="tip">
        Ask what the crawl is <strong>for</strong>: a search index, an archive, or an ML dataset. The purpose sets
        the priority function, the recrawl cadence, and whether near-duplicates are waste or data.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>Estimate fetch rate, bandwidth and storage to see where the real limits are.</p>
      <EstimationTable
        assumptions={['2B pages / month (illustrative target)', 'Average HTML page ≈ 100 KB raw, ~5× compression', 'Keep 3 years of snapshots']}
        rows={[
          { label: 'Fetch rate', math: '2B / (30 × 86,400 s)', result: '≈ 770 pages/s' },
          { label: 'Peak', math: '770 × 2', result: '≈ 1.5K pages/s' },
          { label: 'Inbound bandwidth', math: '1.5K × 100 KB', result: '≈ 1.2 Gbps' },
          { label: 'Storage / month', math: '2B × 100 KB ÷ 5', result: '≈ 40 TB' },
          { label: 'Storage / 3 yr', math: '40 TB × 36', result: '≈ 1.4 PB' },
          { label: 'URL-seen set', math: '10B URLs × ~10 bits', result: '≈ 12 GB Bloom' },
        ]}
      />
      <p>
        Throughput is modest per machine: async I/O on one node handles hundreds of pages per second. The real limits
        are <strong>per-host politeness</strong>, <strong>DNS latency</strong> and <strong>storage growth</strong>.
      </p>

      <H2 id="api">3 · Interfaces</H2>
      <p>A crawler has no public API. Its contracts are internal: how URLs enter the frontier, and what the indexer consumes.</p>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/frontier/urls', desc: 'Enqueue discovered or seed URLs, with a priority hint.', body: '{ urls: [{ url, priority?, discoveredFrom }] }', returns: '202' },
        { method: 'GET', path: '/frontier/lease?worker=w17', desc: 'A worker leases a batch from the host queues it owns; unacked leases expire and return to the queue.', returns: '{ leaseId, urls[], ttlMs }' },
        { method: 'POST', path: '/pages', desc: 'Emit a fetched page to storage and publish a “page crawled” event for the indexer.', body: '{ url, status, headers, bodyRef, fingerprint }', returns: '201' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>
        The crawler is one loop. The{' '}
        <Term def="The queue of URLs waiting to be fetched, organized by priority and by host.">frontier</Term>{' '}
        hands out URLs, fetchers download pages, parsers extract links, and deduplication decides which links go back
        into the frontier.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={360}
        caption="The crawl loop: frontier → fetch → parse → extract → dedup → frontier"
        flows={[
          { name: 'Crawl loop', path: ['frontier', 'fetcher', 'web', 'fetcher', 'parser', 'extract', 'seen', 'frontier'],
            steps: ['Lease a URL from a ready host queue', 'Resolve DNS (cached) and GET the page', 'Response returns to the fetcher', 'Parse and check for duplicate content', 'Extract and normalize outlinks', 'Filter out URLs already seen', 'Enqueue the new URLs with a priority'] },
          { name: 'Store content', path: ['fetcher', 'parser', 'store'],
            steps: ['Fetched body goes to the parser', 'Unique content is compressed and written to blob storage, and metadata to the page table'] },
        ]} />

      <H2 id="frontier">5 · Deep dive: the URL frontier</H2>
      <p>
        The frontier decides what to fetch next and when. A single first-in, first-out queue fails in two ways. It
        hammers whichever host has the most links in a row. And it treats a spam page the same as a front page.
      </p>
      <p>The standard fix, from the Mercator crawler design, splits the frontier into two stages:</p>
      <ul>
        <li><strong>Front queues = priority.</strong> A prioritizer scores each URL (link-based importance, domain quality, change frequency) and places it in one of <em>F</em> queues. A biased selector draws more from high-priority queues without starving low ones.</li>
        <li><strong>Back queues = politeness.</strong> Each back queue holds URLs for exactly one host. A min-heap keyed by <em>“earliest time this host may be hit”</em> tells workers which queue is ready.</li>
      </ul>
      <CrawlerFrontierSim />
      <Callout kind="pitfall">
        Enforcing politeness with a global lock or a shared “last fetch time” table turns every fetch into a
        distributed transaction. Instead, <strong>partition hosts across crawler nodes</strong> (hash(host) → node),
        so each host's timer lives in exactly one process.
      </Callout>

      <H2 id="dedup">6 · Deep dive: duplicates, near-duplicates, and the “seen” set</H2>
      <p>
        Much of the web repeats itself. We need cheap checks for URLs we have already queued and pages we have already
        stored. A{' '}
        <Term def="A compact bit array that answers “definitely not seen” or “probably seen”. It never misses a seen item, but has a small false-positive rate.">Bloom filter</Term>{' '}
        handles the URL check; content fingerprints such as{' '}
        <Term def="A hash where similar documents get similar fingerprints, so near-duplicates differ in only a few bits.">SimHash</Term>{' '}
        catch near-duplicate pages.
      </p>
      <CompareTable
        columns={['What', 'Technique', 'Cost']}
        rows={[
          { label: 'Same URL', cells: ['Normalized URL string', 'Bloom filter or sharded hash set', 'Bits per URL, O(k) hashes'] },
          { label: 'Same bytes', cells: ['Exact mirror / syndication', 'Content hash (e.g. SHA-256) index', '32 B per page'] },
          { label: 'Almost the same', cells: ['Boilerplate, dates, ads differ', 'SimHash fingerprint + Hamming distance ≤ 3', '64 bits per page, clever indexing'] },
        ]}
      />
      <CrawlerBloomCalculator />
      <p>
        Normalize every URL before the seen-check. Otherwise the same page reached through different spellings looks
        new each time.
      </p>
      <CodeBlock lang="ts" title="URL normalization (before the seen-check)" code={`
function normalize(raw: string, base: string): string | null {
  const u = new URL(raw, base)                 // resolve relative links
  if (!/^https?:$/.test(u.protocol)) return null
  u.hash = ''                                  // fragments never change content
  u.hostname = u.hostname.toLowerCase()
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) u.port = ''
  for (const p of ['utm_source', 'utm_medium', 'sessionid', 'sid']) u.searchParams.delete(p)
  u.searchParams.sort()                        // ?b=1&a=2 ≡ ?a=2&b=1
  if (u.href.length > 2048 || u.pathname.split('/').length > 16) return null // trap guard
  return u.href
}`} />

      <H2 id="robustness">7 · Deep dive: politeness, traps, and freshness</H2>
      <p>
        A crawler runs for months against hostile and fragile servers. These rules keep it welcome, keep it out of{' '}
        <Term def="Pages that generate endless new URLs, such as infinite calendars, trapping a crawler forever.">spider traps</Term>,
        and keep its copy fresh.
      </p>
      <ul>
        <li><strong>robots.txt</strong>: fetch once per host, cache it (RFC 9309 suggests no longer than about a day), and obey <code>Allow</code>/<code>Disallow</code>. <code>Crawl-delay</code> is not part of the standard, but honor it where given. Identify yourself with a user agent that has a contact URL.</li>
        <li><strong>Adaptive delay</strong>: back off when response time or 429/503 rates rise. Treat a slow host as a signal, not an obstacle.</li>
        <li><strong>Spider traps</strong>: infinite calendars, session IDs in paths, faceted search. Defend with URL length and depth caps, per-host page budgets, and pattern detection on repeating path segments.</li>
        <li><strong>Freshness</strong>: schedule recrawls based on how often each page has actually changed. Use conditional GETs (<code>If-Modified-Since</code>, ETag) so unchanged pages cost a 304, not a full download.</li>
      </ul>

      <H2 id="data-model">8 · Data model</H2>
      <p>One metadata record per URL tracks fetch history, fingerprints and how often the page changes.</p>
      <CodeBlock lang="ts" title="page metadata (wide-column, key = urlHash)" code={`
type PageRecord = {
  urlHash: string          // partition key: hash(normalizedUrl)
  url: string
  host: string
  lastFetchedAt: number
  httpStatus: number
  etag?: string
  lastModified?: string
  contentHash: string      // exact-dup index
  simhash: bigint          // near-dup fingerprint
  changeRate: number       // EWMA of "changed since last crawl" → recrawl interval
  bodyRef?: string         // pointer to compressed blob
}`} />

      <H2 id="staff">9 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Priority is the product.</strong> With a finite budget, the crawl is only as good as its ordering. Discuss the scoring signals and how you'd measure crawl quality: index coverage of queried pages, and freshness lag on top sites.</li>
          <li><strong>JS rendering</strong> is 10–100× more expensive. Use a separate pool of headless browsers, and send only pages the cheap parser flags as “needs rendering”.</li>
          <li><strong>Geo-distributed fetchers</strong> close to target hosts reduce latency and cross-region egress, but you then need to partition the frontier by region.</li>
          <li><strong>Being a good citizen</strong>: honor opt-outs quickly and give site owners a way to reach you. A crawler that gets blocked by many sites loses coverage, so this is a correctness concern as well as an ethical one.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How do you guarantee you never send more than one request per second to any single host, across 500 crawler machines?"
        senior={<p>Keep a per-host queue and track the last fetch time in a shared store such as Redis. Before fetching, check that enough time has passed.</p>}
        staff={<>
          <p>Avoid shared state on the hot path. Partition by host with consistent hashing, so exactly one crawler node owns each host, and that node's back queue plus min-heap enforces the delay locally with zero coordination.</p>
          <p>When nodes join or leave, only a small share of hosts move. The new owner starts from a conservative delay. I'd treat IP-level politeness as well, because many small hosts share one IP (shared hosting), so the partition key may need to be the resolved IP or ASN for those.</p>
        </>}
        followUps={['What happens to in-flight leases when a node dies?', 'How would you handle a host that is 10× larger than any other?']}
      />
      <InterviewQuestion
        q="Your crawler's disk usage is growing much faster than your count of unique pages. What's going on?"
        senior={<p>Probably duplicate content. Add a content hash check before storing pages.</p>}
        staff={<>
          <p>Likely a mix of three things: <strong>near-duplicates</strong> that exact hashing misses (timestamps, ads, session tokens embedded in HTML), <strong>spider traps</strong> generating endless unique URLs with the same template, and <strong>recrawls that store full copies</strong> even when content hasn't changed.</p>
          <p>Fixes: add SimHash near-dup detection, per-host page budgets with trap detection, conditional GETs, and store a new snapshot only when the fingerprint changes. I'd add a dashboard of bytes per unique fingerprint by host, so the top offenders show up immediately.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Two-stage frontier: front queues for priority, back queues (one host each) for politeness.',
        'Partition hosts across crawler nodes so politeness needs no distributed coordination.',
        'Normalize URLs, then check a Bloom filter. False positives cost a skipped page, never a loop.',
        'Handle exact duplicates (hash), near-duplicates (SimHash), and traps (length, depth, budget caps) separately.',
        'Staff depth: priority as the product, JS rendering economics, IP-level politeness, crawl-quality metrics.',
      ]} />
    </>
  )
}
