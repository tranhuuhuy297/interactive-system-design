import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, EstimationTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways,
  LayerStack, MentalModel, References, Requirements, SideBySide, StatRow, Term, TLDR,
} from '../components/ui'
import {
  BarChart3, Brain, Combine, Database, FileText, Filter, FlaskConical, HardDrive, Layers, ListOrdered, MousePointerClick,
  Rows3, Scissors, Sparkles, Timer, Trophy,
} from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { SengIndexExplorerDemo } from './demos/seng-index-explorer-demo'
import { SengShardFanoutDemo } from './demos/seng-shard-fanout-demo'

const REFS: Reference[] = [
  { title: 'The Anatomy of a Large-Scale Hypertextual Web Search Engine', source: 'S. Brin & L. Page', year: 1998, url: 'http://infolab.stanford.edu/~backrub/google.html', kind: 'paper', note: 'crawling, inverted index, PageRank' },
  { title: 'The Probabilistic Relevance Framework: BM25 and Beyond', source: 'S. Robertson & H. Zaragoza', year: 2009, url: 'https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf', kind: 'paper', note: 'BM25 and BM25F' },
  { title: 'Introduction to Information Retrieval', source: 'C. Manning, P. Raghavan & H. Schütze', year: 2008, url: 'https://nlp.stanford.edu/IR-book/', kind: 'book', note: 'posting lists, intersection, index construction (free online)' },
  { title: 'Challenges in Building Large-Scale Information Retrieval Systems (WSDM keynote)', source: 'Jeff Dean, Google', year: 2009, url: 'https://static.googleusercontent.com/media/research.google.com/en//people/jeff/WSDM09-keynote.pdf', kind: 'talk', note: 'document-partitioned serving, index evolution' },
  { title: 'The Tail at Scale', source: 'J. Dean & L. A. Barroso, CACM', year: 2013, url: 'https://www.barroso.org/publications/TheTailAtScale.pdf', kind: 'paper', note: 'fan-out tail latency, hedged requests' },
  { title: 'Near real-time search', source: 'Elasticsearch documentation', url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/near-real-time.html', kind: 'docs', note: 'segments, refresh, default 1 s interval' },
  { title: 'Size your shards', source: 'Elasticsearch documentation', url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/size-your-shards.html', kind: 'docs', note: '10–50 GB and < 200M docs per shard' },
  { title: 'Cumulated Gain-based Evaluation of IR Techniques', source: 'K. Järvelin & J. Kekäläinen, ACM TOIS', year: 2002, url: 'https://doi.org/10.1145/582415.582418', kind: 'paper', note: 'DCG and NDCG' },
]

const NODES: ArchNode[] = [
  { id: 'client', label: 'Search box', kind: 'client', x: 10, y: 50 },
  { id: 'qsvc', label: 'Query service', sub: 'parse, rewrite', kind: 'service', x: 28, y: 50,
    detail: 'Runs the same analyzer as indexing, expands synonyms and spelling fixes, applies filters and permissions, and checks the result cache.' },
  { id: 'cache', label: 'Result cache', sub: 'popular queries', kind: 'cache', x: 28, y: 18,
    detail: 'Query frequency is heavily skewed, so caching the top results of popular queries absorbs a large share of traffic. Invalidate or expire on index refresh.' },
  { id: 'coord', label: 'Coordinator', sub: 'scatter-gather', kind: 'lb', x: 47, y: 50,
    detail: 'Sends the query to one replica of every shard, merges each shard’s top-k, and can hedge slow shards to another replica.' },
  { id: 'rerank', label: 'Re-ranker', sub: 'ML models', kind: 'worker', x: 66, y: 18,
    detail: 'Only sees the top few hundred merged candidates. Learning-to-rank and neural models are too expensive to run over every match.' },
  { id: 'shards', label: 'Index shards', sub: 'N × replicas', kind: 'search', x: 66, y: 50,
    detail: 'Each shard is a Lucene-style index over a slice of documents: immutable segments with posting lists, stored fields for snippets, and doc values for sorting.' },
  { id: 'indexer', label: 'Indexer', sub: 'builds segments', kind: 'worker', x: 66, y: 84,
    detail: 'Analyzes documents, buffers them in memory, and writes new segments on refresh. Background merges combine small segments into larger ones.' },
  { id: 'ingest', label: 'Ingest stream', sub: 'crawler / CDC', kind: 'queue', x: 86, y: 84,
    detail: 'New and changed documents from the crawler or from change data capture on the source database. Deletes arrive here too.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'qsvc' }, { from: 'qsvc', to: 'cache' }, { from: 'qsvc', to: 'coord' },
  { from: 'coord', to: 'shards' }, { from: 'coord', to: 'rerank' },
  { from: 'ingest', to: 'indexer', async: true }, { from: 'indexer', to: 'shards', label: 'refresh' },
]

export default function SearchEngineChapter() {
  return (
    <>
      <TLDR items={[
        'Return the most relevant documents for a query in well under a second, over a corpus that keeps changing.',
        'An inverted index maps each term to the documents containing it, so queries never scan documents.',
        'Shard by document and fan out to every shard; tail latency, not averages, sets your SLO.',
        'Rank in stages: cheap BM25 over many candidates, expensive models over a few hundred.',
        'Staff insight: freshness, relevance and latency trade against each other. Measure all three.',
      ]} />
      <MentalModel id="search-engine" />

      <p>
        Search looks like “find documents containing these words”. The interview is about doing it over a billion
        documents, in milliseconds, while documents change underneath you.
      </p>
      <p>
        Crawling is covered in the <a href="#/web-crawler">web crawler</a> case study and query suggestions in{' '}
        <a href="#/autocomplete">autocomplete</a>. Mixing keyword and vector retrieval is covered in{' '}
        <a href="#/ai-rag">RAG systems</a>. This chapter is the index and the serving path.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>First decide whose documents these are and how fresh results must be.</p>
      <Requirements
        functional={['Keyword search with ranked results and snippets', 'Filters (date, type, language) and pagination', 'New and edited documents become searchable', 'Deleted documents disappear from results']}
        nonFunctional={['p99 query latency < 200 ms (illustrative target)', 'Freshness: searchable within seconds to minutes', 'Available during node failures', 'Relevance measured, not guessed']}
        outOfScope={['Crawling (see web crawler)', 'Ads', 'Query autocomplete (see autocomplete)']}
      />
      <Callout kind="tip">
        Ask whether this is <strong>web search</strong> (untrusted pages, link signals, spam) or <strong>site or product
        search</strong> (structured fields, permissions, facets). The index is similar; ranking and ingest differ a lot.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>The numbers decide how many shards you need and how expensive every query fan-out is.</p>
      <EstimationTable
        assumptions={['1B documents, ~10 KB of text each (illustrative)', 'Index ≈ 3 TB (an assumption; measure on your data)', '10K queries/s at peak', 'Elastic guidance: 10–50 GB and under 200M documents per shard']}
        rows={[
          { label: 'Raw text', math: '1B × 10 KB', result: '≈ 10 TB' },
          { label: 'Shards by size', math: '3 TB ÷ 10–50 GB', result: '≈ 60–300' },
          { label: 'Shards by doc count', math: '1B ÷ 200M', result: '≥ 5' },
          { label: 'Shard requests/s', math: '10K QPS × 64 shards', result: '≈ 640K/s' },
        ]}
      />
      <StatRow caption="Illustrative sizing; the fan-out multiplier is the number to remember" stats={[
        { value: '1B', label: 'documents' },
        { value: '~64', label: 'primary shards', note: 'size bound dominates' },
        { value: '64×', label: 'work per query', note: 'every shard answers' },
      ]} />

      <H2 id="api">3 · API</H2>
      <p>Search and indexing are separate APIs with separate scaling and failure modes.</p>
      <ApiSpec endpoints={[
        { method: 'GET', path: '/v1/search?q=…&filter=…&cursor=…', desc: 'Ranked results with highlighted snippets.', returns: '{ results: [{ id, title, snippet, score }], nextCursor }' },
        { method: 'PUT', path: '/v1/docs/{id}', desc: 'Create or replace a document; searchable after the next refresh.', body: '{ title, body, fields, version }' },
        { method: 'DELETE', path: '/v1/docs/{id}', desc: 'Marks the document deleted; space is reclaimed at merge time.' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>
        Two paths share the index. The query path is latency-critical and read-only. The indexing path writes new{' '}
        <Term def="An immutable mini-index on disk. New documents create new segments; background merges combine them.">segments</Term>{' '}
        that queries start seeing after a refresh.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Query path on top, indexing path underneath; they meet at the shards"
        flows={[
          { name: 'Query', path: ['client', 'qsvc', 'coord', 'shards', 'coord', 'rerank'], steps: ['User submits a query', 'Parse and rewrite; cache miss goes to the coordinator', 'Scatter to one replica of every shard', 'Each shard returns its local top-k ids and scores', 'Merge, then rerank the top few hundred'] },
          { name: 'Cache hit', path: ['client', 'qsvc', 'cache'], steps: ['Popular query arrives', 'Served from the result cache without touching shards'] },
          { name: 'Index', path: ['ingest', 'indexer', 'shards'], steps: ['Changed document arrives from the crawler or CDC', 'Indexer writes a new segment; the next refresh makes it searchable'] },
        ]} />

      <H2 id="inverted-index">5 · Deep dive: the inverted index</H2>
      <p>
        For each term, the index stores a{' '}
        <Term def="The sorted list of documents that contain a term, often with term frequency and positions.">posting list</Term>.
        A query looks up a few lists and combines them. Documents themselves are only read to build snippets.
      </p>
      <FlowDiagram caption="The same analyzer must run at index time and query time, or terms won't match" steps={[
        { label: 'Document', icon: FileText },
        { label: 'Analyze', sub: 'tokenize, lowercase, stem', icon: Scissors },
        { label: 'Posting lists', sub: 'term → doc ids', icon: ListOrdered },
        { label: 'Intersect', sub: 'AND via two pointers', icon: Combine },
        { label: 'Score', sub: 'BM25', icon: Trophy },
      ]} />
      <SengIndexExplorerDemo />
      <CodeBlock lang="ts" title="BM25 for one term in one document (the demo uses this)" code={`
// k1 ≈ 1.2 controls term-frequency saturation; b ≈ 0.75 controls length normalization.
const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))       // rare terms matter more
const tfPart = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgDocLen))
score += idf * tfPart                                          // summed over query terms`} />

      <H2 id="segments-freshness">6 · Deep dive: segments, merges and freshness</H2>
      <p>
        Posting lists are compressed and sorted, so editing them in place would be slow. Lucene-style engines never do
        that. They write new immutable segments and merge them in the background.
      </p>
      <FlowDiagram caption="Elasticsearch refreshes every second by default, for indices searched in the last 30 s" steps={[
        { label: 'Buffer', sub: 'new docs in memory', icon: Rows3 },
        { label: 'Refresh', sub: 'new searchable segment', icon: Timer },
        { label: 'Merge', sub: 'small → large segments', icon: Layers },
        { label: 'Commit', sub: 'fsync to disk', icon: HardDrive },
      ]} />
      <p>
        That is why search is{' '}
        <Term def="Written documents become searchable after a short delay (the refresh), not the instant the write returns.">near real-time</Term>.
        Updates are a delete plus a new copy, and deleted documents are only purged at merge time. Faster refresh means
        more tiny segments and more merge work.
      </p>

      <H2 id="sharding">7 · Deep dive: sharding and tail latency</H2>
      <p>Split the index by document or by term. Almost every production engine partitions by document.</p>
      <SideBySide caption="Document partitioning wins on simplicity and balance; its cost is fan-out" panels={[
        { title: 'By document', icon: Database, tone: 'good', points: ['+ Each shard is a small full index', '+ Even load, easy to add shards', '- Every query hits every shard'], verdict: 'The default' },
        { title: 'By term', icon: ListOrdered, points: ['+ Query touches only a few shards', '- Popular terms create hot shards', '- Whole posting lists cross the network'], verdict: 'Rare; research and niche uses' },
      ]} />
      <p>
        With fan-out, the slowest shard sets the query latency. If each shard is slow 1% of the time, a 100-shard query
        is slow far more often. Dean and Barroso call this{' '}
        <Term def="The effect where rare per-server delays dominate end-to-end latency once a request fans out to many servers.">tail at scale</Term>.
      </p>
      <SengShardFanoutDemo />

      <H2 id="ranking">8 · Deep dive: ranking in stages</H2>
      <p>You cannot run a large model on every matching document. Each stage keeps fewer candidates and spends more per candidate.</p>
      <LayerStack legend="Bar width = candidates kept (illustrative, not to scale)"
        caption="Cheap filters first, expensive models last"
        layers={[
          { label: 'Corpus', sub: 'every document', icon: Database, size: 1, value: 'billions' },
          { label: 'Index match', sub: 'posting lists + filters', icon: Filter, size: 0.8, value: 'thousands per shard' },
          { label: 'BM25 top-k', sub: 'per shard, then merged', icon: ListOrdered, size: 0.6, value: 'hundreds' },
          { label: 'Learning to rank', sub: 'many features', icon: BarChart3, size: 0.42, value: 'hundreds → tens' },
          { label: 'Neural rerank', sub: 'cross-encoder', icon: Brain, size: 0.28, value: 'tens', highlight: true },
          { label: 'Results page', icon: Sparkles, size: 0.18, value: '10' },
        ]} />
      <p>
        Web search adds signals from outside the text. Brin and Page’s original design combined text matching with
        link-based PageRank. Site search leans on fields, freshness and behavioural signals instead.
      </p>

      <H2 id="evaluation">9 · Deep dive: measuring relevance</H2>
      <p>
        Relevance changes silently with every ranking tweak, so measure it two ways. Offline, graders label results.
        Online, user behaviour votes.
      </p>
      <SideBySide caption="Use offline metrics to decide what to ship, online metrics to confirm it helped" panels={[
        { title: 'Offline', icon: FlaskConical, points: ['+ Judged query sets, fast to rerun', '+ NDCG rewards putting the best results first', '- Judgments go stale and cost money'], verdict: 'Gate every ranking change' },
        { title: 'Online', icon: MousePointerClick, points: ['+ Real users, real queries', '+ Clicks, reformulations, abandonment', '- Noisy, biased toward top positions'], verdict: 'A/B test before full rollout' },
      ]} />
      <CodeBlock lang="ts" title="NDCG@k (one common formulation)" code={`
// rel[i] = graded relevance of the result at rank i (0 = bad … 3 = perfect)
const dcg  = (rels: number[]) => rels.reduce((s, r, i) => s + (2 ** r - 1) / Math.log2(i + 2), 0)
const ndcg = (rels: number[], k: number) =>
  dcg(rels.slice(0, k)) / dcg([...rels].sort((a, b) => b - a).slice(0, k))   // 1.0 = ideal order`} />

      <H2 id="data-model">10 · Data model</H2>
      <p>Per shard, an index is a set of segments. Each segment holds a few structures optimized for different jobs.</p>
      <FlowDiagram caption="What one segment contains" steps={[
        { label: 'Term dictionary', sub: 'term → list offset', icon: ListOrdered },
        { label: 'Posting lists', sub: 'doc ids, tf, positions', icon: Rows3 },
        { label: 'Stored fields', sub: 'for snippets', icon: FileText },
        { label: 'Doc values', sub: 'columnar, for sort + facets', icon: BarChart3 },
      ]} />
      <CodeBlock lang="json" title="index mapping (Elasticsearch-style)" code={`
{
  "mappings": {
    "properties": {
      "title":     { "type": "text", "analyzer": "english" },
      "body":      { "type": "text", "analyzer": "english" },
      "lang":      { "type": "keyword" },
      "published": { "type": "date" },
      "acl":       { "type": "keyword" }
    }
  }
}`} />

      <H2 id="staff">11 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Tail latency is the SLO.</strong> Replicas, hedged requests, and dropping late shards (partial results) are product decisions. Say which queries may return partial results.</li>
          <li><strong>Freshness versus cost.</strong> A 1 s refresh everywhere is expensive. Split indices by update rate: hot recent data refreshes fast, the long tail slowly.</li>
          <li><strong>Relevance is a pipeline, not a formula.</strong> Own the judged query set, the offline gate and the A/B process, or ranking regressions ship unnoticed.</li>
          <li><strong>Permissions inside the query.</strong> For private data, filter by ACL during retrieval, never after the top-k. See the enterprise RAG case study.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Your search p99 doubled after adding shards. What happened, and what do you do?"
        senior={<p>More shards means more requests per query. Add replicas and cache popular queries.</p>}
        staff={<>
          <p>With document partitioning, a query waits for the <strong>slowest of N shards</strong>, so more shards make rare per-shard hiccups show up in far more queries. The p99 moves even if every shard's average is unchanged.</p>
          <p>Fixes, in order: check whether shards got too small, since overhead per shard adds up. Then hedge requests to a second replica after a short delay, and set a deadline that returns partial results for non-critical queries. Also isolate merges and refreshes from query threads, which are common sources of latency spikes.</p>
        </>}
        followUps={['When is partial results acceptable?', 'How do you pick the hedge delay?', 'How would you shard by customer for multi-tenant search?']}
      />
      <InterviewQuestion
        q="A product manager wants edits to be searchable instantly. How do you respond?"
        senior={<p>Lower the refresh interval so new segments are created more often.</p>}
        staff={<>
          <p>“Instantly” usually means “the editor sees their own change”. That can be served by a <strong>read-your-writes overlay</strong>: show the user's own fresh edits from the primary store, while the index catches up in about a second.</p>
          <p>Cutting refresh intervals globally creates many tiny segments and heavy merge load for everyone. I'd separate indices by update rate and set freshness SLOs per index.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'The inverted index turns search into a few posting-list lookups and intersections.',
        'Segments are immutable: refresh adds them, merges combine them, deletes are purged late.',
        'Shard by document; every query fans out, so tail latency sets the SLO. Hedge and use replicas.',
        'Rank in stages, spending expensive models only on the few surviving candidates.',
        'Measure relevance offline with NDCG and confirm online with A/B tests.',
      ]} />
    </>
  )
}
