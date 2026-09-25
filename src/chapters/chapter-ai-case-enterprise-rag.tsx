import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, References, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { AiCaseRagAclDemo } from './demos/ai-case-rag-acl-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Chat UI / bot', sub: 'web · Slack · IDE', kind: 'client', x: 10, y: 50 },
  { id: 'gw', label: 'API gateway', sub: 'SSO · tenant', kind: 'lb', x: 28, y: 50,
    detail: 'Authenticates through the company’s identity provider (SAML/OIDC), resolves the tenant, and applies per-user and per-tenant token budgets.' },
  { id: 'answer', label: 'Answer service', sub: 'orchestrator', kind: 'service', x: 48, y: 50,
    detail: 'Rewrites the question using the conversation so far, resolves the user’s groups, runs retrieval, reranks, builds the prompt with numbered passages, and streams the answer with citations.' },
  { id: 'acl', label: 'Identity & ACL', sub: 'user → groups', kind: 'external', x: 48, y: 14,
    detail: 'Expands a user into all principals they belong to (nested groups included). It is cached for a short time only, because revoking access must take effect quickly.' },
  { id: 'retr', label: 'Hybrid retrieval', sub: 'BM25 + vectors', kind: 'search', x: 68, y: 30,
    detail: 'Runs keyword and vector search with the user’s principals as a filter inside the index, then fuses the two ranked lists.' },
  { id: 'index', label: 'Search index', sub: 'chunks + ACLs', kind: 'db', x: 88, y: 30,
    detail: 'Each chunk stores text, embedding, source metadata, and the allowed principals of its parent document. Partitioned per tenant.' },
  { id: 'rerank', label: 'Reranker', sub: 'cross-encoder', kind: 'worker', x: 68, y: 68,
    detail: 'Scores the question against each of ~50 candidates jointly. It is slower than vector similarity but much more precise, so it runs on a short list only.' },
  { id: 'llm', label: 'LLM', sub: 'via gateway', kind: 'external', x: 88, y: 68,
    detail: 'Generates the answer from the supplied passages only, citing them by number. Reached through an internal LLM gateway for quotas and failover.' },
  { id: 'conn', label: 'Connectors', sub: 'Drive · Confluence · Slack', kind: 'worker', x: 28, y: 88,
    detail: 'Pull content and permissions from each SaaS source, via webhooks where offered and polling otherwise, while respecting each API’s rate limits.' },
  { id: 'q', label: 'Change stream', kind: 'queue', x: 48, y: 88,
    detail: 'Upserts, deletes, and ACL changes as events. Deletes and permission revocations get their own high-priority lane.' },
  { id: 'embed', label: 'Chunk + embed', sub: 'workers', kind: 'worker', x: 68, y: 88,
    detail: 'Parses files, splits them on document structure, embeds each chunk, and upserts idempotently by (doc, chunk, content hash).' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'gw' }, { from: 'gw', to: 'answer' }, { from: 'answer', to: 'acl' },
  { from: 'answer', to: 'retr' }, { from: 'retr', to: 'index' }, { from: 'answer', to: 'rerank' },
  { from: 'answer', to: 'llm' }, { from: 'conn', to: 'q', async: true }, { from: 'q', to: 'embed' },
  { from: 'embed', to: 'index' },
]

const REFS: Reference[] = [
  { title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks', source: 'P. Lewis et al.', year: 2020, url: 'https://arxiv.org/abs/2005.11401', kind: 'paper', note: 'The RAG formulation' },
  { title: 'Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs', source: 'Y. Malkov & D. Yashunin', year: 2016, url: 'https://arxiv.org/abs/1603.09320', kind: 'paper', note: 'HNSW vector index' },
  { title: 'Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods', source: 'G. Cormack, C. Clarke, S. Büttcher (SIGIR)', year: 2009, url: 'https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf', kind: 'paper', note: 'Fusing keyword and vector results' },
  { title: 'Passage Re-ranking with BERT', source: 'R. Nogueira & K. Cho', year: 2019, url: 'https://arxiv.org/abs/1901.04085', kind: 'paper', note: 'Cross-encoder reranking' },
  { title: 'Lost in the Middle: How Language Models Use Long Contexts', source: 'N. Liu et al.', year: 2023, url: 'https://arxiv.org/abs/2307.03172', kind: 'paper', note: 'Why passage order and count matter' },
  { title: 'Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection', source: 'K. Greshake et al.', year: 2023, url: 'https://arxiv.org/abs/2302.12173', kind: 'paper' },
  { title: 'OWASP Top 10 for Large Language Model Applications', source: 'OWASP Gen AI Security Project', url: 'https://genai.owasp.org/llm-top-10/', kind: 'docs' },
]

export default function EnterpriseRagChapter() {
  return (
    <>
      <p>
        “Ask anything about the company” sounds like a vector database plus an LLM. The hard parts are elsewhere.
        The assistant must <strong>never reveal a document the asker cannot open</strong>. It must forget a file
        minutes after it is deleted, and it must stay grounded enough that people trust its citations. Interviewers
        use this prompt to see whether you treat permissions, freshness, and evaluation as first-class requirements
        or as afterthoughts.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Answer natural-language questions over company content', 'Cite the source passages for every claim', 'Connect Drive, Confluence, Slack, Jira, and similar sources', 'Multi-turn conversations with follow-ups']}
        nonFunctional={['Zero permission leaks (hard requirement)', 'Deletes and revocations reflected within minutes', 'First token < 2 s, full answer < 10 s', 'Tenant isolation, with data residency per customer']}
        outOfScope={['Taking actions in source systems (agents)', 'Training or fine-tuning on customer data']}
      />
      <Callout kind="tip">
        Ask early: <strong>how fast must a permission change or delete take effect?</strong> The answer decides
        whether connectors can poll nightly or need webhooks plus a priority lane. It is the most common reason
        these systems fail security reviews.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['Largest tenant: 50K employees, 100M source documents', '~8 chunks per document, 768-dim embeddings', '20 questions per employee per day; peak 5× average', '~6K prompt tokens + 500 output tokens per answer', '2% of documents change per day']}
        rows={[
          { label: 'Chunks', math: '100M × 8', result: '≈ 800M' },
          { label: 'Vectors (fp16)', math: '800M × 768 × 2 B', result: '≈ 1.2 TB' },
          { label: 'Vectors (int8 / PQ)', math: '÷ 2 to ÷ 8', result: '≈ 150–600 GB' },
          { label: 'Question QPS', math: '50K × 20 / 86,400 × 5', result: '≈ 60 peak' },
          { label: 'LLM tokens / day', math: '1M answers × 6.5K', result: '≈ 6.5B' },
          { label: 'Re-embedding load', math: '2M docs × 8 / 86,400', result: '≈ 190 chunks/s' },
        ]}
      />
      <p>
        Query traffic is modest. The costs are <strong>LLM tokens</strong> (context size dominates) and
        <strong> keeping a billion-chunk index fresh and permission-correct</strong>. Design effort should go where
        the cost and risk are.
      </p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/ask', desc: 'Ask a question. The answer streams as server-sent events: tokens, then a citations event.', body: '{ question, conversationId? }', returns: 'text/event-stream' },
        { method: 'GET', path: '/v1/answers/{id}', desc: 'Stored answer with citations, for sharing and audit (re-checks the viewer’s access).', returns: '{ text, citations[] }' },
        { method: 'POST', path: '/v1/feedback', desc: 'Thumbs up/down with an optional comment; feeds the evaluation set.', body: '{ answerId, rating, comment? }' },
        { method: 'POST', path: '/v1/connectors', desc: 'Admin: connect a source with a scoped OAuth grant.', body: '{ type, scopes }', returns: '201 { connectorId }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={430}
        caption="Query path on top, ingestion path along the bottom; the ACL travels with every chunk"
        flows={[
          { name: 'Retrieve', path: ['client', 'gw', 'answer', 'retr', 'index'], steps: ['User asks in chat', 'Gateway authenticates and resolves the tenant', 'Answer service expands the user’s groups and rewrites the question', 'Hybrid search runs with the user’s principals as an index filter'] },
          { name: 'Generate', path: ['client', 'gw', 'answer', 'llm'], steps: ['Same request', 'Routed to the orchestrator', 'The top reranked passages go into a numbered prompt; the answer streams back with citations'] },
          { name: 'Sync', path: ['conn', 'q', 'embed', 'index'], steps: ['A connector sees a new version, a delete, or an ACL change', 'Workers chunk and embed; deletes skip straight to the index', 'Idempotent upsert or tombstone in the tenant’s index'] },
        ]} />

      <H2 id="permissions">5 · Deep dive: permissions-aware retrieval</H2>
      <p>
        The index cannot call Google Drive on every query to ask “may Dana read this?”. Instead it keeps a
        <strong> mirror of each document’s allowed principals</strong> (users and groups) on every chunk. At query
        time the service expands the user into their principals and passes them as a <em>filter inside the
        search</em>. Where that filter runs is the whole game:
      </p>
      <AiCaseRagAclDemo />
      <CompareTable
        columns={['Filter inside the index', 'Post-filter the top-k', 'Check at render only']}
        rows={[
          { label: 'Leaks', cells: ['None', 'None', 'The model already read it'] },
          { label: 'Recall', cells: ['Full', 'Drops when restricted docs rank high', 'Full, but unsafe'] },
          { label: 'Cost', cells: ['Needs a filter-aware vector index', 'Cheap; over-fetch hides the problem', 'Cheapest'] },
          { label: 'Verdict', cells: ['Default', 'Only with heavy over-fetch as a stopgap', 'Never'] },
        ]}
      />
      <CodeBlock lang="ts" title="query with principal filter (pseudo-code)" code={`
const principals = await acl.expand(user.id) // user id + all (nested) group ids, TTL ~60 s

const [keyword, vector] = await Promise.all([
  index.bm25(tenant, rewrittenQuestion, { filter: { allowed: { anyOf: principals } }, k: 50 }),
  index.knn(tenant, embed(rewrittenQuestion), { filter: { allowed: { anyOf: principals } }, k: 50 }),
])

const candidates = reciprocalRankFusion([keyword, vector]).slice(0, 50)
const passages = (await reranker.score(rewrittenQuestion, candidates)).slice(0, 8)`} />
      <Callout kind="pitfall">
        Caching answers by question text alone will eventually show an executive’s answer to an intern. Key any
        answer or retrieval cache by the <strong>user’s principal set</strong> (or a hash of it), never by
        question alone.
      </Callout>

      <H2 id="ingestion">6 · Deep dive: ingestion, freshness, and deletes</H2>
      <ul>
        <li><strong>Structure-aware chunking.</strong> Split on headings, slides, and table boundaries into chunks of a few hundred tokens, with a little overlap. Keep the document title and section path on every chunk so a passage makes sense on its own.</li>
        <li><strong>Idempotent upserts.</strong> Key chunks by <code>(docId, chunkIndex)</code> and store a content hash. An unchanged chunk is not re-embedded, which saves most of the daily embedding cost.</li>
        <li><strong>Two lanes.</strong> Content updates can lag, but deletes and ACL revocations take a priority lane with its own freshness SLO. Sources without change notifications get a periodic full ACL re-crawl as a safety net.</li>
        <li><strong>Group expansion at query time.</strong> Store group ids on chunks, not expanded user lists. Otherwise one change to an “all-engineering” group would rewrite millions of chunks.</li>
      </ul>

      <H2 id="retrieval-quality">7 · Deep dive: retrieval quality and grounded answers</H2>
      <CompareTable
        columns={['Keyword (BM25)', 'Dense vectors', 'Hybrid + rerank']}
        rows={[
          { label: 'Strength', cells: ['Exact names, error codes, IDs', 'Paraphrases and concepts', 'Both'] },
          { label: 'Weakness', cells: ['Misses synonyms', 'Misses rare exact tokens', 'Extra latency (~100–300 ms for rerank)'] },
          { label: 'Use', cells: ['Always keep it', 'Always keep it', 'Default for enterprise search'] },
        ]}
      />
      <ul>
        <li><strong>Few, strong passages.</strong> Models use information at the start and end of a long context better than in the middle, so send ~5–10 reranked passages rather than 50.</li>
        <li><strong>Citations as a contract.</strong> Number the passages, require a citation per claim, and check after generation that every cited number exists. If nothing relevant was retrieved, say so rather than guessing.</li>
        <li><strong>Documents are untrusted input.</strong> A shared doc can contain “ignore previous instructions…”. Treat retrieved text as data, keep tool access away from this path, and never let document text change the system prompt.</li>
      </ul>

      <H2 id="data-model">8 · Data model</H2>
      <CodeBlock lang="ts" title="chunk record (per-tenant index)" code={`
type Chunk = {
  tenantId: string          // partition / separate index per tenant
  docId: string             // source-system id
  chunkIndex: number
  contentHash: string       // skip re-embedding unchanged chunks
  text: string
  embedding: Int8Array      // quantized vector
  title: string
  sectionPath: string[]     // ["Runbooks", "Payments", "Restart"]
  sourceUrl: string         // for citations and deep links
  allowed: string[]         // principal ids (users + groups) from the source ACL
  updatedAt: number
  deleted?: boolean         // tombstone until compaction
}`} />

      <H2 id="staff">9 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Tenant isolation.</strong> Use a separate index (or at least a hard partition) per tenant, and keep tenant id outside anything the model can influence. Cross-tenant leakage ends the company.</li>
          <li><strong>Embedding model upgrades.</strong> A new model means re-embedding ~800M chunks. Build a shadow index, backfill with spare capacity, compare retrieval evals, then flip per tenant. Never mix vectors from two models in one index.</li>
          <li><strong>Evals before launches.</strong> Keep golden question sets per tenant built from feedback, and track recall@k, citation accuracy, and answer faithfulness. Gate prompt, model, and chunking changes on them. Calibrate any LLM-as-judge against human labels.</li>
          <li><strong>Residency and retention.</strong> Deploy per region, keep prompts and outputs in-region, and set a strict retention policy for conversation logs.</li>
          <li><strong>Cost levers.</strong> Shorter contexts, a small model for query rewriting, prompt caching of the static system prompt, and not re-embedding unchanged chunks.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How do you guarantee the assistant never reveals content from a document the user cannot access?"
        senior={<p>Store document permissions alongside chunks in the vector database and filter search results by the user’s groups before sending them to the LLM.</p>}
        staff={<>
          <p>I’d make it a property of the retrieval layer, not the prompt:</p>
          <ul>
            <li>Mirror source ACLs as principal ids on every chunk.</li>
            <li>Expand the user’s groups at query time with a short cache TTL.</li>
            <li>Filter <em>inside</em> both keyword and vector search, so there are no post-filter recall holes.</li>
            <li>Key every cache by principal set.</li>
          </ul>
          <p>Then close the time gaps: revocations and deletes go through a priority lane with an SLO, a periodic full ACL re-crawl catches missed webhooks, and a shared-answer link re-checks the viewer’s access. Finally, test it: a canary suite of restricted documents plus test users that must never see them, run continuously in production.</p>
        </>}
        followUps={['A source API only exposes permissions via a slow per-file call. What now?', 'How do you handle “anyone with the link” sharing?']}
      />
      <InterviewQuestion
        q="Answers got worse after you switched to a new embedding model. How should that migration have worked?"
        senior={<p>We should have compared results before switching and kept the old index to roll back.</p>}
        staff={<>
          <p>Treat it like a database migration with an evaluation gate. Build a <strong>shadow index</strong> with the new model and backfill it at low priority, dual-writing new changes. Run the retrieval eval suite (recall@k and MRR on golden questions per tenant) and a small online interleaving test. Then cut over tenant by tenant, keeping the old index warm for a fast rollback.</p>
          <p>Also check that the query side uses the same model version as the documents; mixed versions produce silent garbage. And budget the backfill cost explicitly, because at 800M chunks it is a real line item.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Permissions are the hard requirement: mirror ACLs onto chunks and filter inside the search, never after.',
        'Caches must be keyed by the user’s principal set, not the question text.',
        'Deletes and revocations need their own fast lane and SLO; content updates can lag.',
        'Hybrid retrieval plus a reranker beats either keyword or vectors alone; send few, strong passages.',
        'Retrieved documents are untrusted input; citations are a contract you verify.',
        'Model and chunking changes ship behind retrieval evals, with shadow indexes for migrations.',
      ]} />
    </>
  )
}
