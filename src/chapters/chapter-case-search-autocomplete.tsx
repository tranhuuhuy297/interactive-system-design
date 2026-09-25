import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, FlowDiagram, H2,
  InterviewQuestion, KeyTakeaways, LayerStack, MentalModel, References, Requirements, StatRow, Term, TLDR,
} from '../components/ui'
import { Copy, Globe, Monitor, Server } from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { AutocompleteTrieExplorerDemo } from './demos/autocomplete-trie-explorer-demo'

const REFS: Reference[] = [
  { title: 'Trie Memory', source: 'Edward Fredkin, Communications of the ACM', year: 1960, url: 'https://doi.org/10.1145/367390.367400', kind: 'paper', note: 'the trie data structure' },
  { title: 'The Life of a Typeahead Query', source: 'Keith Adams, Engineering at Meta', year: 2010, url: 'https://engineering.fb.com/2010/05/17/web/the-life-of-a-typeahead-query/', kind: 'blog', note: 'sub-100 ms typeahead, aggregator + leaves' },
  { title: 'Completion suggester', source: 'Elasticsearch reference', url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/search-suggesters.html', kind: 'docs', note: 'prefix suggestions from an in-memory structure' },
  { title: 'Windows (DataStream API)', source: 'Apache Flink documentation', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/', kind: 'docs', note: 'sliding windows for trending queries' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 1 (ch. “Design a Search Autocomplete System”)', source: 'Alex Xu', year: 2020, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'client', label: 'Search box', sub: 'debounce + local cache', kind: 'client', x: 10, y: 30,
    detail: 'Debounce about 50–100 ms, cancel in-flight requests when the prefix changes, and cache responses per prefix so backspacing costs nothing.' },
  { id: 'edge', label: 'Edge cache', sub: 'CDN, short TTL', kind: 'cdn', x: 27, y: 30,
    detail: 'Short, popular prefixes ("w", "we", "wea") are requested millions of times per hour and give identical answers for everyone, which makes them ideal for the CDN.' },
  { id: 'svc', label: 'Suggest service', sub: 'stateless', kind: 'service', x: 45, y: 30,
    detail: 'Normalizes the prefix, looks up top-k, applies safety filters and (optionally) personalization, and returns in a few milliseconds.' },
  { id: 'trie', label: 'Top-k index', sub: 'in-memory, replicated', kind: 'cache', x: 64, y: 30,
    detail: 'Either an in-memory trie or a flattened prefix → top-k table. Sharded by prefix range and read-only between rebuilds.' },
  { id: 'logs', label: 'Query logs', sub: 'Kafka', kind: 'queue', x: 44, y: 80,
    detail: 'Every submitted search (not every keystroke) is logged, possibly sampled 1-in-N to cut cost.' },
  { id: 'agg', label: 'Aggregator', sub: 'Spark / Flink', kind: 'worker', x: 66, y: 80,
    detail: 'Counts queries over windows with time decay, and merges long-term frequency with a short-window trending signal.' },
  { id: 'build', label: 'Index builder', kind: 'worker', x: 86, y: 80,
    detail: 'Builds the trie and precomputes top-k per node offline, then writes a versioned snapshot. Serving nodes hot-swap to the new version.' },
  { id: 'snap', label: 'Snapshot store', sub: 'object storage', kind: 'storage', x: 90, y: 30,
    detail: 'Versioned index snapshots. Rollback is just pointing back at the previous version.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'edge' }, { from: 'edge', to: 'svc' }, { from: 'svc', to: 'trie' },
  { from: 'svc', to: 'logs', async: true }, { from: 'logs', to: 'agg', async: true }, { from: 'agg', to: 'build' },
  { from: 'build', to: 'snap' }, { from: 'snap', to: 'trie' },
]

export default function SearchAutocompleteChapter() {
  return (
    <>
      <TLDR items={[
        'Return the top 5 completions for a typed prefix, between keystrokes (well under 100 ms).',
        'Do all the expensive work offline; serving is a lookup, never a computation.',
        'A trie with the top-k results cached at every node makes each lookup nearly constant time.',
        'Rank by a time-decayed popularity score, built from logged searches in a batch pipeline.',
        'Scale reads with client debounce, CDN caching of short prefixes, and read-only replicas.',
      ]} />
      <MentalModel id="autocomplete" />

      <p>
        Autocomplete has a brutal latency budget. It must answer <strong>between keystrokes</strong>, so the answer
        needs to come back in well under 100 ms end to end.
      </p>
      <p>
        One design principle makes this possible: <strong>do all the expensive work offline</strong>. The serving
        path should be a lookup, never a computation.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>Agree on how many suggestions, how they are ranked, and how fresh they must be.</p>
      <Requirements
        functional={['Return the top 5 completions for a typed prefix', 'Ranked by popularity (with recency)', 'Prefix match only, lowercase, single language to start']}
        nonFunctional={['End-to-end p99 < 100 ms', '50M DAU, ~10 searches per user per day', 'Suggestions may lag reality by hours (trending: minutes, as an extension)', 'Filter unsafe or legally removed suggestions']}
        outOfScope={['Spell correction / fuzzy match', 'Full search results page']}
      />

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>Estimate request volume and whether the index fits in memory.</p>
      <EstimationTable
        assumptions={['50M DAU × 10 searches × ~20 characters typed', 'Client debounce removes roughly half of keystroke requests (illustrative)', 'Around 100M distinct queries worth indexing']}
        rows={[
          { label: 'Raw keystroke requests', math: '50M × 10 × 20', result: '10B/day' },
          { label: 'After debounce', math: '10B × 0.5 / 86,400', result: '≈ 58K/s' },
          { label: 'Peak', math: '58K × 2–3', result: '≈ 150K/s' },
          { label: 'Logged searches', math: '50M × 10 / 86,400', result: '≈ 6K/s' },
          { label: 'Index size', math: '100M queries × ~(20 B + top-k refs)', result: 'tens of GB' },
        ]}
      />
      <StatRow stats={[
        { value: '10B/day', label: 'raw keystroke requests' },
        { value: '58K/s', label: 'after debounce', note: '≈ 150K/s at peak' },
        { value: '6K/s', label: 'logged searches' },
        { value: 'tens of GB', label: 'index size, fits in RAM' },
      ]} />
      <p>
        The index fits in the memory of a few machines, and read QPS is high but cacheable. Reads are a caching and
        replication problem. Writes are a <strong>batch analytics</strong> problem.
      </p>

      <H2 id="api">3 · API</H2>
      <p>The serving API is a single read: prefix in, ranked suggestions out.</p>
      <ApiSpec endpoints={[
        { method: 'GET', path: '/v1/suggest', desc: 'Top-k completions. The response is identical for all users (unless personalized), so it can be cached at the edge.', body: '?q={prefix}&limit=5&locale=en', returns: '200 { suggestions[] } · Cache-Control: max-age=600' },
        { method: 'POST', path: '/v1/search-events', desc: 'Log a submitted search, which feeds aggregation (often piggybacked on the search request itself).', body: '{ query, ts, sessionId }', returns: '202' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>
        Split the system in two. The read path only looks up a prebuilt index. The write path collects search logs,
        aggregates them offline, and periodically publishes a new index version.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={380}
        caption="A read path of lookups only; a write path of offline aggregation and index rebuilds"
        flows={[
          { name: 'Suggest (edge hit)', path: ['client', 'edge'], steps: ['Debounced GET /suggest?q=we is served straight from the CDN'] },
          { name: 'Suggest (miss)', path: ['client', 'edge', 'svc', 'trie'], steps: ['Client requests the prefix', 'Edge miss → origin', 'Service walks the index: O(prefix length) plus precomputed top-k'] },
          { name: 'Rebuild', path: ['svc', 'logs', 'agg', 'build', 'snap', 'trie'],
            steps: ['Submitted searches are logged', 'Aggregator counts with time decay', 'Builder precomputes top-k for every prefix', 'A new versioned snapshot is written', 'Serving replicas hot-swap to the new version'] },
        ]} />

      <H2 id="trie">5 · Deep dive: the trie and cached top-k</H2>
      <p>
        The index is a <Term def="A tree where each edge is one character, so every path from the root spells a prefix.">trie</Term>.
        Type into the explorer to watch a lookup walk down it.
      </p>
      <AutocompleteTrieExplorerDemo />
      <p>
        A naive trie lookup walks to the prefix node, which costs O(p) for a prefix of length p. It then traverses
        the <em>entire subtree</em> to find the best completions. For a one-letter prefix, that is a large fraction
        of all queries.
      </p>
      <p>
        Precomputing the <strong><Term def="The k best-scoring items, e.g. the 5 most popular completions under a prefix.">top-k</Term> at every node</strong>{' '}
        turns the lookup into O(p) plus a constant. It trades memory for latency.
      </p>
      <CodeBlock lang="ts" title="serving lookup" code={`
function suggest(root: TrieNode, rawPrefix: string, k = 5): string[] {
  const prefix = normalize(rawPrefix)          // lowercase, trim, NFKC
  let node: TrieNode | undefined = root
  for (const ch of prefix) {
    node = node.children.get(ch)
    if (!node) return []                         // or fall back to fuzzy search
  }
  return node.topK.slice(0, k).map((e) => e.q)  // precomputed offline
}`} />
      <CompareTable
        columns={['In-memory trie', 'Flattened prefix → top-k in a KV store']}
        rows={[
          { label: 'Lookup', cells: ['Walk p nodes', 'One key get'] },
          { label: 'Memory', cells: ['Shares prefixes, compact', 'Duplicates top-k per prefix; cap prefix length (e.g. 20)'] },
          { label: 'Ops', cells: ['Custom serving process, snapshot loading', 'Off-the-shelf Redis / Cassandra'] },
          { label: 'Sharding', cells: ['By prefix range', 'Hash of prefix, which is naturally even'] },
          { label: 'Good for', cells: ['Very low latency, fuzzy extensions', 'Simplicity; most teams start here'] },
        ]}
      />

      <H2 id="pipeline">6 · Deep dive: collecting and ranking data</H2>
      <p>The index is only as good as its data. This pipeline turns raw search logs into ranked suggestions.</p>
      <FlowDiagram steps={[
        { label: 'Search logs', sub: 'submitted queries' },
        { label: 'Sample + clean', sub: '1-in-N, dedupe bots' },
        { label: 'Aggregate', sub: 'count with time decay' },
        { label: 'Filter', sub: 'unsafe, legal removals' },
        { label: 'Build index', sub: 'top-k per prefix' },
        { label: 'Hot swap', sub: 'versioned snapshot' },
      ]} caption="Weekly or daily batch build, plus a streaming trending layer if freshness matters" />
      <p>
        Rank by a <strong>decayed score</strong>, not raw all-time counts, so last year's fad doesn't beat today's
        news: <code>score = Σ count(day) × e^(−λ·age)</code>.
      </p>
      <p>
        Log <em>submitted</em> searches rather than keystrokes. That is two orders of magnitude less data, and it
        reflects what people actually wanted.
      </p>

      <H2 id="scaling">7 · Deep dive: scaling reads</H2>
      <p>
        Finally, absorb the read load. Each layer below removes traffic before it reaches the next. Client-side{' '}
        <Term def="Waiting briefly after each keystroke and only sending a request once typing pauses.">debounce</Term>{' '}
        is the cheapest win.
      </p>
      <LayerStack legend="Each layer removes traffic before the next one sees it"
        caption="Bar width shows how much of the original request volume still reaches that layer"
        layers={[
          { label: 'Client', sub: 'debounce, cancel stale, cache per prefix, prefetch', icon: Monitor, size: 1, value: 'cheapest win', highlight: true },
          { label: 'Edge / CDN', sub: 'short prefixes: hottest, same for everyone', icon: Globe, size: 0.7 },
          { label: 'Sharded index', sub: 'ranges from the prefix distribution', icon: Server, size: 0.45 },
          { label: 'Read replicas', sub: 'read-only between builds', icon: Copy, size: 0.3, value: 'add freely' },
        ]} />
      <p>
        Don't shard by first letter: far more queries start with “s” than “x”. Split using ranges derived from the
        historical prefix distribution, or hash the prefix in the KV design. Because the index is read-only between
        builds, replicas have no consistency problems within a version.
      </p>
      <Callout kind="pitfall">
        Updating the trie synchronously on every search. It turns a read-optimized, lock-free structure into a hot
        write path and gains freshness nobody asked for. Rebuild offline and swap versions.
      </Callout>

      <H2 id="staff">8 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Trending in minutes</strong>: keep a streaming layer (Flink with sliding windows) that computes a small set of trending prefixes, and blend it with the batch index at query time. Don't rebuild the whole index.</li>
          <li><strong>Personalization</strong>: blend global top-k with the user's recent history on the server or client. This breaks CDN cacheability, so personalize only after the global response or for longer prefixes.</li>
          <li><strong>Trust and safety</strong>: autocomplete speaks with your brand's voice. Filter at build time <em>and</em> at serve time (a fast blocklist for urgent removals), and resist manipulation (bot-driven query inflation) with per-user dedup and anomaly detection.</li>
          <li><strong>Internationalization</strong>: Unicode normalization, languages without spaces (CJK), and transliteration make “prefix” itself non-trivial.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="A major news event happens. How do you get it into suggestions within minutes instead of tomorrow?"
        senior={<p>Rebuild the trie more often, maybe every few minutes, from recent logs.</p>}
        staff={<>
          <p>Full rebuilds every few minutes are wasteful and risky. I'd add a separate <strong>real-time layer</strong>: a stream job counts queries in short sliding windows, detects spikes relative to baseline, and publishes a small trending table (prefix → trending queries). The suggest service merges it with the batch top-k at read time.</p>
          <p>Guardrails: trending suggestions go through the same safety filter plus a stricter threshold, because the fastest-rising queries during breaking news are often the most sensitive. The edge TTL for short prefixes also needs to drop, or the CDN will hide the update.</p>
        </>}
        followUps={['How do you detect a spike versus normal daily seasonality?', 'What is your blend ratio between trending and baseline?']}
      />
      <InterviewQuestion
        q="How would you shard the index?"
        senior={<p>By first character, with multiple replicas of each shard for read throughput.</p>}
        staff={<>
          <p>First-character sharding is skewed, so I'd compute shard boundaries from the historical prefix distribution, e.g. [a–ap), [ap–b), …, so each shard carries similar traffic, with a small routing table in the service. If we choose the flattened KV design, hashing the prefix gives an even spread for free, at the cost of duplicated top-k lists.</p>
          <p>Since the index is immutable per version, I'd deploy each version as a whole: build all shards, verify, then flip a version pointer atomically. Otherwise different shards could serve different versions during rollout.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'The serving path is a lookup. Precompute top-k per prefix offline.',
        'Trie with cached top-k: O(prefix) reads, paid for with memory. A flattened KV of prefix → top-k is the simpler alternative.',
        'Cache aggressively at the client and the edge. Short prefixes are the hottest and identical for everyone.',
        'Log submitted searches, rank with time decay, build a versioned index, and hot-swap it.',
        'Staff depth: a streaming trending layer, safety filtering, personalization versus cacheability.',
      ]} />
    </>
  )
}
