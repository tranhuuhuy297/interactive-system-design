import {
  References, TLDR, Term,
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeChatgptContextBudgetDemo } from './demos/episode-chatgpt-context-budget-demo'
import { CHATGPT_STAGES } from './demos/episode-chatgpt-stages'
import { GSRC } from './demos/episode-chatgpt-stage-nodes'

const MSG_NODES: ArchNode[] = [
  { id: 'client', label: 'Browser', sub: 'SSE stream open', kind: 'client', x: 10, y: 50 },
  { id: 'edge', label: 'API edge', sub: 'auth · token limits', kind: 'lb', x: 30, y: 50,
    detail: 'Authenticates, applies token-based rate limits per user and tier, and holds the long-lived streaming connection.' },
  { id: 'orch', label: 'Orchestrator', sub: 'prompt + tool loop', kind: 'service', x: 52, y: 50,
    detail: 'Loads the conversation branch, assembles the prompt within the context budget, runs the tool loop, and relays tokens to the client as they arrive.' },
  { id: 'safety', label: 'Safety', kind: 'service', x: 52, y: 16, detail: 'Classifies the input before generation and the output while it streams.' },
  { id: 'retrieval', label: 'Retrieval', sub: 'vector + memory', kind: 'search', x: 52, y: 84, detail: 'Fetches relevant documents and saved user memories to ground the answer.' },
  { id: 'fleet', label: 'Inference fleet', kind: 'worker', x: 88, y: 50,
    detail: 'GPU serving with continuous batching and KV caching. See the LLM Inference Platform case study for internals.' },
  { id: 'store', label: 'Conversation store', kind: 'db', x: 80, y: 16, detail: 'Message trees keyed by conversation. Writes the user turn immediately and the assistant turn when the stream completes.' },
]
const MSG_EDGES: ArchEdge[] = [
  { from: 'client', to: 'edge' }, { from: 'edge', to: 'orch' }, { from: 'orch', to: 'safety' }, { from: 'orch', to: 'retrieval' },
  { from: 'orch', to: 'fleet' }, { from: 'orch', to: 'store', async: true },
]

// Primary public sources behind the episode (per-stage sources live in the Go deeper panels).
const REFS: Reference[] = [
  GSRC.launch, GSRC.plus, GSRC.streaming, GSRC.rateLimits, GSRC.plugins, GSRC.functions, GSRC.seeHear,
  GSRC.gpt4o, GSRC.gpts, GSRC.wau, GSRC.memory, GSRC.moderation, GSRC.microsoft, GSRC.stargate,
]

const TIMELINE = [
  ['Nov 2022', 'ChatGPT launches as a free research preview'],
  ['Jan 2023', 'Microsoft extends its partnership with OpenAI'],
  ['Feb 2023', 'ChatGPT Plus: priority access at peak times'],
  ['Mar 2023', 'Plugins: web browsing, code interpreter, retrieval'],
  ['Jun 2023', 'Function calling in the API'],
  ['Sep 2023', 'Voice and image input in ChatGPT'],
  ['Nov 2023', 'Custom GPTs; 100M weekly active users'],
  ['Feb 2024', 'Memory testing begins'],
  ['May 2024', 'GPT-4o: audio replies in ~320 ms on average'],
  ['Jan 2025', 'Stargate infrastructure venture announced'],
] as const

export default function ChatgptEpisode() {
  return (
    <>
      <TLDR items={[
        <><strong>GPU time is the scarce resource.</strong> Limits, queues, and plans are all measured in tokens.</>,
        <><strong>Stream every answer.</strong> Time to first token decides how fast it feels.</>,
        <>The model is stateless. The <strong>orchestrator</strong> decides what goes in each prompt: history, files, memory.</>,
        <>Tools make it useful and risky. <strong>Tool output is untrusted input</strong>, and code runs in a sandbox.</>,
        <>Plan the <strong>degradation ladder</strong> before launch day: queue, spill, smaller model, shed.</>,
      ]} />
      <p>
        ChatGPT looks like a text box. The product is really an orchestration layer around a slow, expensive
        function call. Two facts drive every decision: <strong>GPU time is scarce</strong>, and
        <strong> generation is sequential</strong>, one token at a time.
      </p>
      <p>
        This episode builds the product layer, stage by stage, from launch in 2022. For what happens inside the GPU
        fleet (batching, KV cache, prefill vs decode), see the <a href="#/llm-serving">LLM Inference Platform</a>{' '}
        case study.
      </p>
      <Callout kind="info" title="How to watch this episode">
        OpenAI publishes little about its internal architecture. Dates and numbers come from OpenAI posts, API docs,
        and press coverage. The designs describe <strong>common industry practice</strong>, and stages that are
        design patterns rather than history are labelled that way.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by OpenAI; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <ol className="gpt-timeline">
        {TIMELINE.map(([when, what]) => <li key={when}><strong>{when}</strong> {what}</li>)}
      </ol>

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={CHATGPT_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <EstimationTable
        assumptions={[
          'Illustrative: 100M daily users × 10 messages each',
          'Average prompt ≈ 1,500 tokens (history + context), answer ≈ 400 tokens',
          'Average generation ≈ 15 s; peak ≈ 3× average',
        ]}
        rows={[
          { label: 'Messages / day', math: '100M × 10', result: '≈ 1B' },
          { label: 'Average message rate', math: '1B / 86,400 s', result: '≈ 12K/s' },
          { label: 'Peak message rate', math: '12K × 3', result: '≈ 35K/s' },
          { label: 'Concurrent streams (avg)', math: '12K/s × 15 s (Little’s law)', result: '≈ 180K' },
          { label: 'Output tokens / day', math: '1B × 400', result: '≈ 400B' },
          { label: 'Prompt tokens / day', math: '1B × 1,500', result: '≈ 1.5T' },
          { label: 'Conversation storage', math: '1B × ~2 KB', result: '≈ 2 TB/day' },
        ]}
      />
      <p>
        Prompt tokens outnumber output tokens several times over. Every history turn and retrieved chunk is
        processed again on <em>every</em> message. So context management is a cost problem, not just a quality
        problem.
      </p>
      <p>
        Concurrency is high too. By{' '}
        <Term def="Little’s law: items in a system = arrival rate × time each item spends there.">Little’s law</Term>,
        12K messages per second lasting 15 seconds each means about 180K open streams at once.
      </p>

      <H2 id="life-of-a-message">Life of a message</H2>
      <ArchitectureDiagram nodes={MSG_NODES} edges={MSG_EDGES} height={380}
        caption="The orchestrator is the product: it decides what the model sees and what the user gets back"
        flows={[
          { name: 'Send + stream', path: ['client', 'edge', 'orch', 'fleet'], steps: ['User sends a message; the browser keeps the stream open', 'Edge checks auth and token budget', 'Orchestrator assembles the prompt, then relays tokens back as the fleet produces them'] },
          { name: 'Ground', path: ['client', 'edge', 'orch', 'retrieval'], steps: ['Question needs facts', 'Routed', 'Orchestrator pulls relevant documents and memories into the prompt'] },
          { name: 'Check', path: ['client', 'edge', 'orch', 'safety'], steps: ['Message arrives', 'Routed', 'Input and streaming output are classified'] },
          { name: 'Persist', path: ['client', 'edge', 'orch', 'store'], steps: ['Message arrives', 'Routed', 'Both turns are saved on the conversation’s current branch'] },
        ]} />

      <H2 id="context">Deep dive: the context window is a budget</H2>
      <p>
        The model is stateless. “Memory” is whatever the orchestrator puts in the prompt this time.
      </p>
      <p>
        Fixed costs come off the top: system prompt, tool definitions, retrieved documents, and room for the answer.
        History competes for what is left in the{' '}
        <Term def="The maximum number of tokens the model can read and write in one request.">context window</Term>.
        Compare strategies as the conversation grows:
      </p>
      <EpisodeChatgptContextBudgetDemo />
      <Callout kind="tip">
        Retrieval keeps prompts small and cheap but can miss the turn that mattered. Summaries preserve the gist but
        lose exact wording. Production systems usually combine them: recent turns verbatim, a rolling summary, and
        retrieval over the long tail.
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Response delivery', cells: ['Stream tokens over SSE', 'Return the full answer', 'Time to first token matters more to users than total time'] },
          { label: 'Transport', cells: ['SSE (one-way HTTP stream)', 'WebSockets', 'Simple, works through proxies, fits request-then-stream; WebSockets only for truly bidirectional features'] },
          { label: 'Conversation model', cells: ['Message tree (branches)', 'Linear message list', 'Edit and regenerate create siblings without destroying history'] },
          { label: 'Rate limiting', cells: ['Tokens per minute + tiers', 'Requests per minute', 'Request cost varies ~100×; tokens track real GPU cost'] },
          { label: 'Overload', cells: ['Queue → spill → smaller model → shed', 'Fail requests randomly', 'Protects paid and interactive traffic, degrades predictably'] },
          { label: 'Grounding', cells: ['Retrieval + short memory', 'Stuff everything into context', 'Cheaper per request; quality depends on retrieval recall'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Meter the scarce resource.</strong> Admission, quotas, and billing are all denominated in tokens (GPU-seconds), not requests.</li>
          <li><strong>Design the degradation ladder up front.</strong> Queue, spill across regions, fall back to a smaller model, shed free traffic, each with honest UX. A capacity crunch is a normal day, not an incident.</li>
          <li><strong>Treat tool output as untrusted input.</strong> Prompt injection via web pages or files is a security boundary; sandbox execution and scope credentials per tool.</li>
          <li><strong>Ship models like risky deploys.</strong> Offline evals, canaries on TTFT, refusal rate, and quality signals, then fast rollback.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="How would you rate-limit an LLM chat product fairly when requests vary wildly in cost?"
        senior={<p>Use a token bucket per user in Redis, with higher limits for paid users. Return 429 with Retry-After when exceeded.</p>}
        staff={<>
          <p>Limit <strong>tokens</strong>, not requests. At admission, estimate prompt plus expected output and reserve it from the budget. Settle to actual usage when the stream ends.</p>
          <p>Enforce at two layers. Per-user and per-org budgets at the edge give fairness. A priority scheduler in front of the fleet protects capacity, putting paid and interactive traffic first.</p>
          <p>When saturated, queue briefly with a visible wait, then fall back to a smaller model for low tiers. Watch time to first token per tier and rejection rate. Let the budget store fail open for paid users.</p>
        </>}
        followUps={['How do you handle a request whose output is much longer than estimated?', 'Where does the rate-limit state live across regions?', 'How do you stop one enterprise tenant starving others?']}
      />
      <InterviewQuestion
        q="A user edits their third message in a 40-turn conversation. How does your data model handle it?"
        senior={<p>Update the third message and delete everything after it, then regenerate the answer.</p>}
        staff={<>
          <p>Model the conversation as a <strong>tree</strong>: each message has a parent id. An edit creates a new sibling of message three, with a fresh branch below it.</p>
          <p>The conversation tracks its “current” leaf. Nothing is destroyed, so users can flip between branches. Regenerate is just another sibling.</p>
          <p>Reads load the path from root to the current leaf, which bounds work per request. Stable message ids also help caching, abuse review, and deletion requests.</p>
        </>}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'GPU time is the scarce resource: meter, limit, and schedule in tokens, not requests.',
        'Stream tokens (SSE) so time to first token, not total time, defines perceived speed.',
        'The model is stateless; the orchestrator owns context: budgets, summaries, retrieval, memory.',
        'Tools turn a chatbot into an agent, and turn tool output into an untrusted security boundary.',
        'Plan the degradation ladder: queue → spill → smaller model → shed, with honest UX.',
        'Voice raises the latency bar to hundreds of milliseconds: stream every stage and remove hops.',
      ]} />
    </>
  )
}
