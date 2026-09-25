import type { ArchEdge, ArchNode, EpisodeStage } from '../../components/ui'

// Stage graphs are cumulative: each stage re-lists the nodes it keeps so positions stay stable.
const N = {
  client: { id: 'client', label: 'Web + apps', kind: 'client', x: 10, y: 50 },
  server: { id: 'edge', label: 'App server', sub: 'prompt in, text out', kind: 'service', x: 30, y: 50 },
  edge: { id: 'edge', label: 'API edge', sub: 'auth · limits', kind: 'lb', x: 30, y: 50 },
  gpu: { id: 'model', label: 'One GPU box', sub: 'the model', kind: 'worker', x: 88, y: 50 },
  model: { id: 'model', label: 'Inference fleet', sub: 'see LLM serving', kind: 'worker', x: 88, y: 50 },
  chat: { id: 'chat', label: 'Chat orchestrator', sub: 'streams tokens', kind: 'service', x: 50, y: 50 },
  convdb: { id: 'convdb', label: 'Conversation store', sub: 'message trees', kind: 'db', x: 70, y: 14 },
  quota: { id: 'quota', label: 'Token quotas', sub: 'per user · tier', kind: 'cache', x: 30, y: 16 },
  queue: { id: 'queue', label: 'Scheduler', sub: 'priority queue', kind: 'queue', x: 70, y: 50 },
  vector: { id: 'vector', label: 'Vector index', sub: 'retrieval', kind: 'search', x: 70, y: 84 },
  memory: { id: 'memory', label: 'User memory', sub: 'saved facts', kind: 'db', x: 50, y: 84 },
  sandbox: { id: 'sandbox', label: 'Code sandbox', sub: 'isolated runs', kind: 'worker', x: 90, y: 84 },
  files: { id: 'files', label: 'File store', sub: 'uploads', kind: 'storage', x: 30, y: 84 },
  safety: { id: 'safety', label: 'Safety checks', sub: 'in + out', kind: 'service', x: 50, y: 16 },
  region: { id: 'region', label: 'Other regions', sub: 'GPU pools', kind: 'external', x: 90, y: 16 },
} satisfies Record<string, ArchNode>

const e = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })

const CORE = [e('client', 'edge'), e('edge', 'chat'), e('chat', 'convdb')]
const WITH_QUEUE = [...CORE, e('edge', 'quota'), e('chat', 'queue'), e('queue', 'model')]
const WITH_CONTEXT = [...WITH_QUEUE, e('chat', 'vector'), e('chat', 'memory')]
const WITH_TOOLS = [...WITH_CONTEXT, e('chat', 'sandbox', { label: 'tool call' }), e('edge', 'files')]

export const CHATGPT_STAGES: EpisodeStage[] = [
  {
    title: 'v0 · A prompt box',
    scale: 'Internal demo · a few users',
    nodes: [N.client, N.server, N.gpu],
    edges: [e('client', 'edge'), e('edge', 'model')],
    flows: [{ name: 'Ask', path: ['client', 'edge', 'model'], steps: ['User submits a prompt', 'Server calls the model and waits for the whole answer'] }],
    problem: <p>Show that a chat interface to a large model is useful. Nothing else matters yet.</p>,
    decision: <p>One server takes the prompt, calls one GPU machine running the model, and returns the full answer as a single HTTP response.</p>,
    tradeoff: <p>Users stare at a spinner for many seconds, because generation is token by token and the response waits for the last one. One box means one queue and one failure.</p>,
    realWorld: <p>ChatGPT launched publicly as a “research preview” on 30 November 2022. Growth far outran capacity, and early users often saw “at capacity” messages.</p>,
  },
  {
    title: 'v1 · Streaming + conversations',
    scale: '~1M users in days',
    added: ['chat', 'convdb'],
    nodes: [N.client, N.edge, N.chat, N.convdb, N.model],
    edges: [...CORE, e('chat', 'model')],
    flows: [
      { name: 'Send', path: ['client', 'edge', 'chat', 'model'], steps: ['Message goes out over an HTTP stream', 'Edge authenticates', 'Orchestrator builds the prompt from the conversation and streams tokens back as they are generated'] },
      { name: 'Save', path: ['client', 'edge', 'chat', 'convdb'], steps: ['User message arrives', 'Routed to orchestrator', 'Both the message and the finished reply are persisted'] },
    ],
    problem: <p>Waiting for the full answer feels slow even when the total time is fine. People also want to come back to conversations, edit an earlier message, and regenerate a reply.</p>,
    decision: (
      <ul>
        <li><strong>Stream tokens</strong> to the client as they are produced (server-sent events over one HTTP response), so the first words appear quickly.</li>
        <li>Store conversations as <strong>trees of messages</strong>. An edit or regenerate creates a sibling branch instead of overwriting history.</li>
      </ul>
    ),
    tradeoff: <p>Long-lived streaming connections change load balancing and timeouts. A dropped connection mid-answer must be resumable or cleanly retried.</p>,
    realWorld: <p>OpenAI’s public API streams responses as <strong>server-sent events</strong> when you set <code>stream: true</code>. That is the same pattern users see as text appearing word by word.</p>,
  },
  {
    title: 'v2 · Limits + a queue',
    scale: '~100M users · GPUs are the bottleneck',
    added: ['quota', 'queue'],
    nodes: [N.client, N.edge, N.chat, N.convdb, N.model, N.quota, N.queue],
    edges: WITH_QUEUE,
    flows: [{ name: 'Admit', path: ['client', 'edge', 'quota'], steps: ['Request arrives', 'Edge debits the user’s token budget; if it’s empty, reject with a retry hint'] },
      { name: 'Schedule', path: ['client', 'edge', 'chat', 'queue', 'model'], steps: ['Admitted request', 'Routed to orchestrator', 'Queued by priority tier', 'Dispatched to a GPU replica with free capacity'] }],
    problem: <p>Demand is many times the GPU supply, and a request’s cost varies by 100× depending on prompt and answer length. Counting <em>requests</em> is meaningless for fairness or capacity.</p>,
    decision: <p>Rate-limit and meter by <strong>tokens</strong>, not requests, with per-user and per-tier budgets. Put a priority queue in front of the fleet, so paid and interactive traffic go first and overload turns into waiting or fast rejection instead of timeouts.</p>,
    tradeoff: <p>Output length isn’t known up front, so you admit on an estimate and settle afterwards. Priority tiers need guardrails so free users aren’t starved forever.</p>,
    realWorld: <p>OpenAI’s API documentation publishes limits in both <strong>requests per minute and tokens per minute</strong>, grouped into usage tiers. Consumer ChatGPT plans have also applied usage caps on some models.</p>,
  },
  {
    title: 'v3 · Context: memory + retrieval',
    scale: 'Long conversations · personal context',
    added: ['vector', 'memory'],
    nodes: [N.client, N.edge, N.chat, N.convdb, N.model, N.quota, N.queue, N.vector, N.memory],
    edges: WITH_CONTEXT,
    flows: [{ name: 'Build prompt', path: ['client', 'edge', 'chat', 'vector'], steps: ['User asks a follow-up', 'Routed', 'Orchestrator assembles system prompt + saved memories + recent turns + retrieved passages within the context budget'] }],
    problem: <p>The model only sees what fits in its context window, and every token in the prompt costs compute on every request. Long chats overflow, and users expect the assistant to remember preferences across chats.</p>,
    decision: <p>Treat the prompt as a <strong>budget</strong>: keep recent turns verbatim, summarize or retrieve older ones, pull relevant documents from a vector index, and inject a small set of saved user memories. Always reserve room for the answer.</p>,
    tradeoff: <p>Summaries lose detail and retrieval can miss. Memory raises privacy questions, so users need to see, edit, and delete what is remembered.</p>,
    realWorld: <p>ChatGPT added a user-visible <strong>memory</strong> feature in 2024 that can be reviewed and turned off. Retrieval-augmented generation is standard industry practice for grounding answers in documents.</p>,
  },
  {
    title: 'v4 · Tools + files',
    scale: 'Agents that act, not just talk',
    added: ['sandbox', 'files'],
    nodes: [N.client, N.edge, N.chat, N.convdb, N.model, N.quota, N.queue, N.vector, N.memory, N.sandbox, N.files],
    edges: WITH_TOOLS,
    flows: [{ name: 'Tool loop', path: ['client', 'edge', 'chat', 'sandbox'], steps: ['User uploads a CSV and asks for a chart', 'Routed; the file is stored', 'Model emits a tool call, the orchestrator runs the code in an isolated sandbox, then feeds results back to the model'] }],
    problem: <p>Users want the assistant to run code, read their files, and call external services. The model can only produce text, so something has to execute actions safely.</p>,
    decision: <p>The orchestrator runs a <strong>tool loop</strong>: the model outputs a structured tool call, the platform executes it (sandboxed code, search, file reads), and appends the result to the context for the next model step. Untrusted code runs in isolated, resource-limited sandboxes with no access to other users’ data.</p>,
    tradeoff: <p>Each tool step is another model call, which adds latency and cost. Tool outputs are untrusted input, so prompt injection becomes a security concern.</p>,
    realWorld: <p>OpenAI added <strong>function calling</strong> to its API in June 2023 and launched Code Interpreter (later Advanced Data Analysis) in ChatGPT in 2023. It runs Python in a sandbox.</p>,
  },
  {
    title: 'v5 · Safety + observability',
    scale: 'Hundreds of millions of weekly users',
    added: ['safety'],
    nodes: [N.client, N.edge, N.chat, N.convdb, N.model, N.quota, N.queue, N.vector, N.memory, N.sandbox, N.files, N.safety],
    edges: [...WITH_TOOLS, e('chat', 'safety')],
    flows: [{ name: 'Check', path: ['client', 'edge', 'chat', 'safety'], steps: ['Message arrives', 'Routed', 'Input and streamed output are classified; violations stop the stream or change the response'] }],
    problem: <p>At this scale every kind of misuse happens daily, and a regression in model behavior or latency affects millions within minutes.</p>,
    decision: <p>Add a <strong>safety layer</strong> around the model: classify inputs and streamed outputs, detect abuse patterns per account, and keep enforcement separate from the model so it can be updated independently. Instrument the product end to end: time to first token, tokens per second, error and refusal rates, plus offline eval suites before every model rollout.</p>,
    tradeoff: <p>Checking streamed output adds latency or forces you to withdraw text already shown. False positives frustrate legitimate users.</p>,
    realWorld: <p>OpenAI documents a public <strong>moderation</strong> endpoint that classifies text for policy categories. Layered classifiers around generation are common industry practice.</p>,
  },
  {
    title: 'v6 · Global capacity',
    scale: 'Multi-region · many models',
    added: ['region'],
    nodes: [N.client, N.edge, N.chat, N.convdb, { ...N.model, label: 'GPU pools', sub: 'many models' }, N.quota,
      { ...N.queue, label: 'Router', sub: 'model · region · tier' }, N.vector, N.memory, N.sandbox, N.files, N.safety, N.region],
    edges: [...WITH_TOOLS, e('chat', 'safety'), e('queue', 'region', { label: 'overflow' })],
    flows: [{ name: 'Degrade', path: ['client', 'edge', 'chat', 'queue', 'region'], steps: ['Launch-day spike hits', 'Admitted by tier', 'Router finds the home pool full', 'Spills to another region, or falls back to a smaller model for low-priority traffic'] }],
    problem: <p>GPU capacity is scarce, expensive, and uneven across regions. A viral launch can multiply traffic overnight.</p>,
    decision: <p>Route each request by model, region, and priority across pooled GPU capacity. Under pressure, degrade in order: queue briefly, spill to other regions, serve a smaller or cheaper model for low-priority traffic, and finally shed load for free tiers with honest messaging.</p>,
    tradeoff: <p>Cross-region routing adds latency and data-residency complexity. Silently swapping models changes answer quality, so it must be visible or policy-driven.</p>,
    realWorld: <p>OpenAI is widely reported to have run primarily on Microsoft Azure and later added other compute providers. Its leaders have publicly said at times that launches were limited by GPU availability.</p>,
  },
]
