import {
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, H2, InterviewQuestion, KeyTakeaways, References, Term, TLDR,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { AiRagAnnTradeoffDemo } from './demos/ai-rag-ann-tradeoff-demo'
import { AiRagRetrievalPlaygroundDemo } from './demos/ai-rag-retrieval-playground-demo'

const REFS: Reference[] = [
  { title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks', source: 'Lewis et al.', year: 2020, url: 'https://arxiv.org/abs/2005.11401', kind: 'paper', note: 'The original RAG formulation' },
  { title: 'The Probabilistic Relevance Framework: BM25 and Beyond', source: 'Robertson & Zaragoza', year: 2009, url: 'https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf', kind: 'paper' },
  { title: 'Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods', source: 'Cormack, Clarke & Büttcher (SIGIR)', year: 2009, url: 'https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf', kind: 'paper', note: 'The k = 60 constant' },
  { title: 'Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs', source: 'Malkov & Yashunin', year: 2016, url: 'https://arxiv.org/abs/1603.09320', kind: 'paper' },
  { title: 'Product Quantization for Nearest Neighbor Search', source: 'Jégou, Douze & Schmid (IEEE TPAMI)', year: 2011, url: 'https://doi.org/10.1109/TPAMI.2010.57', kind: 'paper' },
  { title: 'Passage Re-ranking with BERT', source: 'Nogueira & Cho', year: 2019, url: 'https://arxiv.org/abs/1901.04085', kind: 'paper', note: 'Cross-encoder reranking' },
  { title: 'Precise Zero-Shot Dense Retrieval without Relevance Labels (HyDE)', source: 'Gao et al.', year: 2022, url: 'https://arxiv.org/abs/2212.10496', kind: 'paper' },
  { title: 'Lost in the Middle: How Language Models Use Long Contexts', source: 'Liu et al.', year: 2023, url: 'https://arxiv.org/abs/2307.03172', kind: 'paper' },
  { title: 'Introducing Contextual Retrieval', source: 'Anthropic', year: 2024, url: 'https://www.anthropic.com/research/contextual-retrieval', kind: 'blog', note: 'Prepending chunk context before indexing' },
]

const NODES: ArchNode[] = [
  { id: 'src', label: 'Sources', sub: 'wiki · tickets · PDFs', kind: 'external', x: 10, y: 20 },
  { id: 'ingest', label: 'Ingest workers', sub: 'parse · chunk', kind: 'worker', x: 32, y: 20,
    detail: 'Extracts text and structure (headings, tables), splits into chunks, attaches metadata such as source, ACLs, and timestamps.' },
  { id: 'embed', label: 'Embedding model', kind: 'service', x: 54, y: 20, detail: 'Versioned. Changing the model means re-embedding the corpus, because vectors from different models are not comparable.' },
  { id: 'vec', label: 'Vector index', sub: 'HNSW / IVF-PQ', kind: 'search', x: 78, y: 20 },
  { id: 'kw', label: 'Keyword index', sub: 'BM25', kind: 'search', x: 78, y: 50 },
  { id: 'client', label: 'User', kind: 'client', x: 10, y: 80 },
  { id: 'api', label: 'RAG service', sub: 'rewrite · retrieve', kind: 'service', x: 32, y: 80,
    detail: 'Rewrites the query, runs lexical and vector search in parallel with ACL filters, fuses results, reranks, and builds the prompt with citations.' },
  { id: 'rerank', label: 'Reranker', sub: 'cross-encoder', kind: 'service', x: 56, y: 60, detail: 'Scores (query, chunk) pairs jointly. Slower but far more precise than embeddings, so run it on the top ~50 candidates only.' },
  { id: 'llm', label: 'LLM', kind: 'external', x: 78, y: 82 },
]
const EDGES: ArchEdge[] = [
  { from: 'src', to: 'ingest', async: true }, { from: 'ingest', to: 'embed' }, { from: 'embed', to: 'vec' }, { from: 'ingest', to: 'kw' },
  { from: 'client', to: 'api' }, { from: 'api', to: 'vec' }, { from: 'api', to: 'kw' }, { from: 'api', to: 'rerank' }, { from: 'api', to: 'llm' },
]

export default function RagSystemsChapter() {
  return (
    <>
      <TLDR items={[
        'RAG = search your data, then paste the best passages into the prompt.',
        'It is a search system first. Most bad answers are retrieval misses.',
        'Chunking decides what can be found. Hybrid search (keywords + vectors) fixes exact-ID misses.',
        'Rerank a wide candidate set with a cross-encoder for precision.',
        'Enforce permissions inside the index, and propagate deletes first.',
      ]} />
      <p>
        Retrieval-augmented generation (RAG) answers questions from <strong>your</strong> data. It retrieves relevant
        passages at query time and puts them into the model’s{' '}
        <Term def="The text the model can see for this request: instructions, retrieved passages, and the conversation.">context</Term>,
        instead of hoping the facts are in the weights. Think of an open-book exam: the model is only as good as the
        pages you hand it.
      </p>
      <p>
        RAG is the default architecture for private, fresh, or citable knowledge. It is a search system first and an
        LLM feature second.
      </p>
      <Callout kind="tip">
        Most bad RAG answers are retrieval failures. If the right passage never reaches the prompt, no model can use it.
        Measure retrieval (recall@k: did the right passage appear in the top k?) separately from generation.
      </Callout>

      <H2 id="pipeline">Two pipelines: ingest and query</H2>
      <p>
        A RAG system is two pipelines. One runs offline and keeps the indexes fresh. The other runs per question and
        must be fast.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={400}
        caption="Offline ingestion keeps indexes fresh; the online path retrieves, fuses, reranks, and generates"
        flows={[
          { name: 'Ingest', path: ['src', 'ingest', 'embed', 'vec'], steps: ['A document changes at the source', 'Parse and chunk with metadata and ACLs', 'Embed each chunk with the pinned model version'] },
          { name: 'Query', path: ['client', 'api', 'vec'], steps: ['User asks a question', 'Rewrite the query, then search with the user’s permission filter'] },
          { name: 'Answer', path: ['client', 'api', 'rerank'], steps: ['After fusion, the top ~50 chunks…', '…are rescored by the cross-encoder; the top few go into the prompt'] },
        ]} />

      <H2 id="chunking">Chunking decides what can be found</H2>
      <p>
        Search returns{' '}<Term def="A passage cut from a document; the unit you embed, index, and paste into the prompt.">chunks</Term>,
        not documents. How you cut documents sets the ceiling on what retrieval can ever find.
      </p>
      <CompareTable
        columns={['Fixed-size', 'Recursive / structural', 'Semantic']}
        rows={[
          { label: 'How', cells: ['N tokens with overlap', 'Split on headings → paragraphs → sentences', 'Split where embedding similarity drops'] },
          { label: 'Strength', cells: ['Simple, predictable cost', 'Keeps sections intact', 'Topic-coherent chunks'] },
          { label: 'Weakness', cells: ['Cuts through tables and sentences', 'Needs parseable structure', 'Extra compute, harder to debug'] },
        ]}
      />
      <p>
        Small chunks match queries precisely but lose surrounding context. Large chunks carry context but dilute
        similarity and waste prompt tokens.
      </p>
      <p>
        Two practical fixes. Use <strong>overlap</strong> windows so answers aren’t split. And prepend a short{' '}
        <strong>context header</strong> to each chunk (document title, section, or an LLM-written one-line summary)
        before embedding and indexing.
      </p>

      <H2 id="embeddings">Embeddings and similarity</H2>
      <p>Embeddings turn “similar meaning” into “nearby numbers”, which is what makes semantic search possible.</p>
      <ul>
        <li>An{' '}<Term def="A model that turns text into a list of numbers (a vector) so similar texts get nearby vectors.">embedding model</Term>{' '}maps text to a vector; similar meaning should land nearby. Retrieval compares the query vector to chunk vectors.</li>
        <li><strong>Cosine vs dot product</strong>: identical when vectors are{' '}<Term def="Scaled to length 1, so only direction matters.">L2-normalized</Term>, which most pipelines do. Use whatever metric the model was trained for.</li>
        <li><strong>Queries and documents differ</strong>: short questions vs long passages. Many models expect different prefixes or encoders for each.</li>
        <li><strong>Version your vectors.</strong> A new embedding model means re-embedding everything. Plan dual indexes and a cutover like any data migration.</li>
      </ul>

      <H2 id="hybrid">Hybrid search: lexical + semantic</H2>
      <p>
        Embeddings capture meaning but blur exact tokens: error codes, SKUs, names, rare jargon.{' '}
        <Term def="A classic keyword-ranking formula that scores documents by term frequency, rarity, and length.">BM25</Term>{' '}
        is the reverse. Running both and fusing the ranked lists is cheap and robust.
      </p>
      <p>
        <strong><Term def="RRF: combine ranked lists by summing 1/(k + rank) per item. Only ranks matter, not raw scores.">Reciprocal rank fusion</Term></strong>{' '}
        needs no score calibration: each list contributes <code>1 / (k + rank)</code>. Try it on the playground below.
      </p>
      <AiRagRetrievalPlaygroundDemo />
      <CodeBlock lang="ts" title="reciprocal rank fusion" code={`
function rrf(lists: string[][], k = 60): [string, number][] {
  const score = new Map<string, number>()
  for (const list of lists)
    list.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1)))
  return [...score].sort((a, b) => b[1] - a[1])
}`} />

      <H2 id="ann">Vector indexes at scale</H2>
      <p>
        Exact nearest-neighbor search scans every vector. That is too slow for millions of chunks. Approximate indexes
        trade a little recall for orders-of-magnitude speed.
      </p>
      <ul>
        <li><strong><Term def="Hierarchical Navigable Small World: a layered graph index; search hops from coarse to fine layers toward the nearest vectors.">HNSW</Term></strong>{' '}navigates a layered proximity graph: excellent recall and latency, but RAM-hungry.</li>
        <li><strong><Term def="Inverted File + Product Quantization: cluster vectors, then compress each into a short code.">IVF-PQ</Term></strong>{' '}clusters vectors and compresses them into short codes: small and fast, at a recall cost.</li>
      </ul>
      <p>Move the slider to see how recall, latency, and memory trade off.</p>
      <AiRagAnnTradeoffDemo />

      <H2 id="rerank">Reranking and query rewriting</H2>
      <p>Fast retrieval is approximate. Two cheap steps, one before search and one after, recover most of the lost precision.</p>
      <ul>
        <li><strong>Rerank</strong>: a{' '}<Term def="A model that reads the query and a passage together and outputs one relevance score. Precise but slow.">cross-encoder</Term>{' '}reads query and passage together and scores relevance precisely. Retrieve ~50 cheaply, rerank to ~5. This is usually the single biggest quality lever after hybrid search.</li>
        <li><strong>Rewrite</strong>: turn a follow-up (“what about for annual plans?”) into a standalone query using chat history; split multi-part questions into sub-queries.</li>
        <li><strong>HyDE-style expansion</strong>: have the model draft a hypothetical answer and search with <em>its</em> embedding, which can sit closer to real answers than the question does.</li>
      </ul>

      <H2 id="acl-freshness">Permissions, freshness, and citations</H2>
      <p>
        Company data has{' '}<Term def="Access control lists: who may read each document.">ACLs</Term>. The retriever must
        respect them, stay fresh, and show its sources.
      </p>
      <CompareTable
        columns={['Filter before / during search', 'Filter after search']}
        rows={[
          { label: 'How', cells: ['ACL metadata as an index filter', 'Retrieve top-k, drop forbidden chunks'] },
          { label: 'Leak risk', cells: ['None if metadata is right', 'None, but…'] },
          { label: 'Quality', cells: ['Full top-k of allowed docs', 'Can return almost nothing for restricted users'] },
        ]}
      />
      <p>
        Treat index freshness like replication lag. Stream source changes (webhooks,{' '}
        <Term def="Change data capture: streaming row-level changes out of a database.">CDC</Term>) into incremental
        re-indexing.
      </p>
      <p>
        Propagate <strong>deletes and permission changes first</strong>. A stale answer is a bug; a leaked document is an
        incident. Return chunk IDs with every answer so the UI can cite sources and users can verify.
      </p>

      <H2 id="long-context">Long context vs RAG, and common failures</H2>
      <p>
        Million-token{' '}<Term def="The maximum number of tokens a model can read in one request.">context windows</Term>{' '}
        don’t make retrieval obsolete. Stuffing everything costs tokens and latency on every request. Models also use
        information in the middle of long contexts less reliably than at the edges.
      </p>
      <p>
        Long context shines for a <em>single</em> large document per request. RAG shines for large, changing corpora
        with access control. The usual failures:
      </p>
      <ul>
        <li>Right document, wrong chunk (answer split by chunking).</li>
        <li>Retrieved but ignored (buried mid-context, or contradicted by the model’s prior knowledge).</li>
        <li>Outdated duplicates outranking the current version: add recency and “canonical” signals.</li>
        <li>Confident answers with no support: require citations and let the model say “not found”.</li>
      </ul>

      <Callout kind="staff">
        <p>Staff-level RAG answers talk about <strong>evaluation and operations</strong>, not just the diagram:</p>
        <ul>
          <li>a labeled query set with recall@k per retriever</li>
          <li>groundedness checks on answers</li>
          <li>index freshness SLOs</li>
          <li>ACL correctness tests</li>
          <li>an embedding migration plan</li>
          <li>a cost model per query: embedding + search + rerank + generation tokens</li>
        </ul>
        <p>See <a href="#/ai-evals">Evaluating LLM Systems</a> and the enterprise case study at <a href="#/ai-case-rag">Design an Enterprise RAG Assistant</a>.</p>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Users say the RAG assistant “can’t find” answers that exist in the docs. How do you debug and improve it?"
        senior={<p>Check chunking and the embedding model, try a better embedding model, increase top-k, and add a reranker.</p>}
        staff={<>
          <p>First I’d separate retrieval failure from generation failure. I’d build a labeled set of real failing queries with the correct passage, then measure recall@k of each retriever.</p>
          <ul>
            <li><strong>If recall is low:</strong> inspect by failure type. Exact identifiers point to missing hybrid/BM25. Answers split across chunks point to chunking and overlap. Vocabulary mismatch points to query rewriting or a domain-tuned embedding. Missing documents point to ingestion or ACLs.</li>
            <li><strong>If recall is fine but answers are wrong:</strong> reranking, context ordering, and prompt instructions to prefer retrieved facts and cite them.</li>
          </ul>
          <p>Every change is gated on the eval set so a fix for one class doesn’t regress another.</p>
        </>}
        followUps={['How would you label 500 queries cheaply?', 'What does recall@5 vs recall@50 tell you about reranking headroom?', 'How do you detect stale documents outranking current ones?']}
      />
      <InterviewQuestion
        q="How do you enforce document permissions in a RAG system over company-wide data?"
        senior={<p>Store ACLs with each chunk and filter search results by the user’s groups before sending them to the LLM.</p>}
        staff={<>
          <p>ACLs are attached at ingestion and applied as <strong>index-time filters</strong> using the requesting user’s identity resolved server-side. Post-filtering can starve restricted users of results, and the model must never be the enforcement point.</p>
          <p>The hard parts are operational:</p>
          <ul>
            <li>permission changes and deletions propagate faster than content updates, with a freshness SLO</li>
            <li>group membership is resolved at query time or cached with short TTLs</li>
            <li>caches (semantic caches especially) are partitioned by permission scope</li>
            <li>automated tests try to retrieve documents the test user shouldn’t see</li>
          </ul>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'RAG quality is mostly retrieval quality: measure recall@k separately from answer quality.',
        'Chunking and context headers decide what is findable; overlap prevents split answers.',
        'Hybrid search (BM25 + vectors) with rank fusion is cheap and fixes the exact-identifier gap.',
        'Rerank a wide candidate set with a cross-encoder; it is the biggest precision lever.',
        'Enforce ACLs in the index with server-side identity, and propagate deletes first.',
      ]} />
    </>
  )
}
