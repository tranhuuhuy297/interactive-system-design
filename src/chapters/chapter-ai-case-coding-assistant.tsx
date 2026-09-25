import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, References, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { AiCaseCodeLatencyDemo } from './demos/ai-case-code-latency-demo'

const NODES: ArchNode[] = [
  { id: 'ide', label: 'IDE plugin', sub: 'context + UI', kind: 'client', x: 10, y: 50,
    detail: 'Owns debouncing, cancellation, and most context gathering: cursor prefix and suffix, open tabs, and symbols from the language server. Sending the right 2K tokens beats sending 50K.' },
  { id: 'edge', label: 'Edge gateway', sub: 'auth · policy', kind: 'lb', x: 28, y: 50,
    detail: 'Terminates auth, enforces org policy (content exclusions, allowed models), and routes to the nearest region with capacity.' },
  { id: 'comp', label: 'Completion svc', sub: 'latency-critical', kind: 'service', x: 48, y: 28,
    detail: 'Builds the fill-in-the-middle prompt, adds repo snippets if they are ready in time, and streams the first line as soon as it is decoded.' },
  { id: 'fim', label: 'Small FIM model', sub: 'GPU pool', kind: 'worker', x: 70, y: 12,
    detail: 'A small, fast model trained on the fill-in-the-middle objective. Sessions are routed sticky to the same replica so the file prefix stays in its KV cache.' },
  { id: 'rcache', label: 'Suggestion cache', kind: 'cache', x: 90, y: 30,
    detail: 'Caches recent suggestions per session and prefix. Backspacing and retyping should not cost another model call.' },
  { id: 'index', label: 'Repo index', sub: 'embeddings + symbols', kind: 'search', x: 70, y: 50,
    detail: 'Per-repository index of code chunks and a symbol graph (definitions and references), kept fresh from commits and local edits.' },
  { id: 'chat', label: 'Chat / agent svc', sub: 'multi-step', kind: 'service', x: 48, y: 72,
    detail: 'Runs longer interactions: answers questions, plans multi-file edits, calls tools, and loops until tests pass or a step budget is hit.' },
  { id: 'llm', label: 'Large model', sub: 'reasoning', kind: 'external', x: 90, y: 72,
    detail: 'A larger model for chat and agent work, where a few seconds of latency are acceptable.' },
  { id: 'sbx', label: 'Sandbox', sub: 'ephemeral VM', kind: 'worker', x: 70, y: 90,
    detail: 'Isolated, resource-limited environment to build and run tests on proposed edits. Network egress is off or allow-listed.' },
  { id: 'tel', label: 'Telemetry', sub: 'accept / reject', kind: 'queue', x: 28, y: 88,
    detail: 'Shown, accepted, and rejected events plus how much accepted code survives later edits. This is the ground truth for online quality.' },
]

const EDGES: ArchEdge[] = [
  { from: 'ide', to: 'edge' }, { from: 'edge', to: 'comp' }, { from: 'comp', to: 'fim' }, { from: 'comp', to: 'rcache' },
  { from: 'comp', to: 'index' }, { from: 'edge', to: 'chat' }, { from: 'chat', to: 'index' }, { from: 'chat', to: 'llm' },
  { from: 'chat', to: 'sbx' }, { from: 'edge', to: 'tel', async: true },
]

const REFS: Reference[] = [
  { title: 'Efficient Training of Language Models to Fill in the Middle', source: 'M. Bavarian et al.', year: 2022, url: 'https://arxiv.org/abs/2207.14255', kind: 'paper', note: 'The FIM objective used for inline completion' },
  { title: 'Evaluating Large Language Models Trained on Code', source: 'M. Chen et al.', year: 2021, url: 'https://arxiv.org/abs/2107.03374', kind: 'paper', note: 'Codex, HumanEval, and pass@k' },
  { title: 'Productivity Assessment of Neural Code Completion', source: 'A. Ziegler et al.', year: 2022, url: 'https://arxiv.org/abs/2205.06537', kind: 'paper', note: 'Acceptance rate as an online signal' },
  { title: 'SWE-bench: Can Language Models Resolve Real-World GitHub Issues?', source: 'C. Jimenez et al.', year: 2023, url: 'https://arxiv.org/abs/2310.06770', kind: 'paper', note: 'Repository-level agent evaluation' },
  { title: 'Fast Inference from Transformers via Speculative Decoding', source: 'Y. Leviathan, M. Kalman, Y. Matias', year: 2022, url: 'https://arxiv.org/abs/2211.17192', kind: 'paper' },
  { title: 'Language Server Protocol Specification', source: 'Microsoft', url: 'https://microsoft.github.io/language-server-protocol/', kind: 'docs', note: 'Symbols and definitions for context' },
  { title: 'OWASP Top 10 for Large Language Model Applications', source: 'OWASP Gen AI Security Project', url: 'https://genai.owasp.org/llm-top-10/', kind: 'docs', note: 'Prompt injection and excessive agency' },
]

export default function CodingAssistantChapter() {
  return (
    <>
      <p>
        An AI coding assistant is really <strong>two products with opposite latency budgets</strong>. Inline
        completions must appear in the fraction of a second a developer pauses, or they are useless. Chat and
        agentic edits can take seconds or minutes, but they must be correct, safe to execute, and reviewable. A
        strong answer separates the two paths early and then goes deep on context assembly, which decides quality
        on both.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Inline completions as you type (single and multi-line)', 'Chat about the codebase with file references', 'Agent mode: multi-file edits, run tests, propose a diff', 'Org policies: excluded files, allowed models']}
        nonFunctional={['Completion p50 well under the typing pause (~a few hundred ms)', 'Chat first token < 1–2 s', 'Customer code never used for training by default; configurable retention', 'Graceful degradation: the IDE works normally if the service is down']}
        outOfScope={['Training the base models', 'Code review bots in the CI system']}
      />
      <Callout kind="tip">
        Ask what “fast enough” means. For inline completion, a suggestion that arrives after the user resumes typing
        is thrown away, so <strong>p90 latency matters more than average quality</strong>. Say this out loud and the
        rest of the design follows.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['500K daily active developers', '~200 completion requests per developer per day after debouncing', '~2K prompt tokens and ~30 output tokens per completion', '~10 chat or agent turns per developer per day at ~20K tokens each', 'Peak ≈ 3× average (working hours across time zones)']}
        rows={[
          { label: 'Completion requests', math: '500K × 200', result: '100M / day' },
          { label: 'Completion QPS', math: '100M / 86,400 × 3', result: '≈ 3.5K peak' },
          { label: 'Completion prompt tokens', math: '100M × 2K', result: '≈ 200B / day' },
          { label: 'Chat / agent tokens', math: '5M × 20K', result: '≈ 100B / day' },
          { label: 'Share of requests cancelled', math: 'typing continues', result: 'large (design for it)' },
        ]}
      />
      <p>
        Hundreds of billions of prompt tokens per day make <strong>prefill the dominant cost</strong>. Reusing the
        already-processed file prefix between keystrokes (a KV/prefix cache on a sticky replica) is the single
        biggest efficiency lever.
      </p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/completions', desc: 'Inline completion. Cancellable; streams the first line early.', body: '{ prefix, suffix, path, language, snippets[] }', returns: 'stream { id, text }' },
        { method: 'POST', path: '/v1/chat', desc: 'Chat turn with file and symbol references, streamed as server-sent events.', body: '{ messages, references[] }', returns: 'text/event-stream' },
        { method: 'POST', path: '/v1/agent/tasks', desc: 'Start an agent task; progress and the final diff arrive as events.', body: '{ goal, repo, branch }', returns: '202 { taskId }' },
        { method: 'POST', path: '/v1/telemetry', desc: 'Shown, accepted, and rejected events plus how much of an accepted suggestion survives.', body: '{ completionId, event, retainedChars? }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={430}
        caption="Latency-critical completion path on top, slower chat/agent path below"
        flows={[
          { name: 'Inline completion', path: ['ide', 'edge', 'comp', 'fim'], steps: ['Plugin debounces, gathers local context, and sends prefix + suffix', 'Gateway applies policy and routes to the nearest region', 'Completion service calls the small FIM model on a sticky replica and streams the first line'] },
          { name: 'Repo context', path: ['ide', 'edge', 'comp', 'index'], steps: ['Same request', 'Routed to the completion service', 'Relevant snippets and symbol definitions are fetched, only if they fit the latency budget'] },
          { name: 'Agent edit', path: ['ide', 'edge', 'chat', 'sbx'], steps: ['Developer asks for a multi-file change', 'Routed to the agent service', 'The agent edits files and runs the tests in a sandbox before proposing a diff'] },
        ]} />

      <H2 id="latency">5 · Deep dive: the completion latency budget</H2>
      <AiCaseCodeLatencyDemo />
      <ul>
        <li><strong>Fill-in-the-middle.</strong> The model sees code before <em>and after</em> the cursor, so suggestions close brackets and match the next line instead of rewriting it.</li>
        <li><strong>Small model, sticky sessions.</strong> A few-billion-parameter model decodes several times faster than a large one. Routing a session to the same replica lets the unchanged file prefix stay cached.</li>
        <li><strong>Cancel aggressively.</strong> Most requests are obsolete before they finish. Cancelling them in the plugin <em>and</em> on the server frees GPU time for the request that matters.</li>
        <li><strong>Stream the first line.</strong> Show a single-line suggestion as soon as it is decoded; keep generating a multi-line block only if the user keeps waiting.</li>
      </ul>

      <H2 id="context">6 · Deep dive: context assembly</H2>
      <p>Quality depends less on the model than on what goes into its limited prompt. Rank context sources and pack them into a token budget:</p>
      <CompareTable
        columns={['Source', 'Cost to fetch', 'Value']}
        rows={[
          { label: 'Prefix / suffix around cursor', cells: ['Free (local)', 'Highest; always included'] },
          { label: 'Open tabs, recently edited files', cells: ['Free (local)', 'High; similarity-matched snippets'] },
          { label: 'Symbol definitions (language server)', cells: ['Low (local)', 'High; correct signatures and types'] },
          { label: 'Repo-wide retrieval (embeddings)', cells: ['Network + search', 'Medium for completions, high for chat'] },
          { label: 'Docs / tickets', cells: ['Network', 'Mostly for chat and agents'] },
        ]}
      />
      <CodeBlock lang="ts" title="packing context into a token budget" code={`
function buildPrompt(ctx: Context, budget = 2048) {
  const parts: Part[] = [
    { text: ctx.prefixNearCursor, priority: 0, required: true },
    { text: ctx.suffixNearCursor, priority: 0, required: true },
    ...ctx.symbolDefs.map((d) => ({ text: d, priority: 1 })),
    ...ctx.similarSnippets.map((s) => ({ text: s, priority: 2 })),
  ]
  const chosen: Part[] = []
  let used = 0
  for (const p of parts.sort((a, b) => a.priority - b.priority)) {
    const t = countTokens(p.text)
    if (p.required || used + t <= budget) { chosen.push(p); used += t }
  }
  return toFillInTheMiddle(chosen) // <prefix> … <suffix> … <middle>
}`} />
      <Callout kind="warn">
        Respect exclusions <em>before</em> anything leaves the machine: <code>.env</code> files, secrets, and paths
        the organization has excluded must never be sent as context, even as a “similar snippet”.
      </Callout>

      <H2 id="agents">7 · Deep dive: agentic edits and the sandbox</H2>
      <ul>
        <li><strong>Loop with limits.</strong> Plan, search the repo, edit, build and run tests, read failures, repeat. Cap the steps, tokens, and wall time, and stop with a report instead of flailing.</li>
        <li><strong>Execute only in a sandbox.</strong> Use an ephemeral VM or container with no production credentials, CPU and memory limits, and network egress off or allow-listed. The developer’s laptop is not the sandbox.</li>
        <li><strong>Humans approve diffs.</strong> Changes land as a reviewable diff or pull request, never as silent commits to protected branches.</li>
        <li><strong>Repository text is untrusted.</strong> A README or issue can carry instructions aimed at the agent. Tools that touch the outside world (git push, HTTP) need explicit confirmation.</li>
      </ul>

      <H2 id="evaluation">8 · Evaluation and telemetry</H2>
      <CompareTable
        columns={['Offline', 'Online']}
        rows={[
          { label: 'Completions', cells: ['pass@k on held-out function tasks; exact and edit-distance match on real repos', 'Acceptance rate, retained characters after N minutes, latency percentiles'] },
          { label: 'Agents', cells: ['Repository-level task suites (issue → passing tests)', 'Task success, diff acceptance, number of review round-trips'] },
          { label: 'Watch out for', cells: ['Benchmark contamination (tasks seen in training)', 'Acceptance of code that is later deleted; bias toward short suggestions'] },
        ]}
      />

      <H2 id="data-model">9 · Data model</H2>
      <CodeBlock lang="ts" title="completion event (telemetry)" code={`
type CompletionEvent = {
  completionId: string
  orgId: string
  userHash: string        // pseudonymous; no raw code stored by default
  model: string
  language: string
  latencyMs: number
  promptTokens: number
  outputTokens: number
  outcome: 'shown' | 'accepted' | 'rejected' | 'cancelled'
  retainedChars30s?: number
  retainedChars5m?: number
}`} />

      <H2 id="staff">10 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Privacy is the product.</strong> Offer no training on customer code by default, configurable or zero retention, regional processing, and a self-hosted or VPC option for regulated customers. Enterprise sales depend on it.</li>
          <li><strong>Cost per active developer.</strong> Put a number on it, then pull the levers: model tiering (small for inline, large for agents), prefix reuse, cancellation, and not sending repo context when it will not arrive in time.</li>
          <li><strong>Graceful degradation.</strong> Under load, shorten suggestions, drop repo retrieval, then pause completions. The editor must never block on the service.</li>
          <li><strong>Ship behind evals.</strong> Every model or prompt change runs offline suites, then an A/B test on acceptance and retention, with latency guardrails.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How would you keep inline completions under a few hundred milliseconds at thousands of requests per second?"
        senior={<p>Use a smaller model, deploy close to users, cache results, and debounce requests in the client so we don’t send one per keystroke.</p>}
        staff={<>
          <p>I’d start from the budget: debounce, network, queue, prefill, decode, render. Then attack the biggest segments:</p>
          <ul>
            <li><strong>Prefill:</strong> sticky routing so the file prefix stays in the replica’s KV cache.</li>
            <li><strong>Decode:</strong> a small fill-in-the-middle model, speculative decoding, and streaming the first line.</li>
            <li><strong>Queue:</strong> cancel superseded requests end to end, so stale work does not delay the live request.</li>
          </ul>
          <p>Capacity planning uses p90/p99 at peak, not averages. The degradation ladder (shorter output, no repo retrieval, then off) keeps the editor responsive when GPUs are short.</p>
        </>}
        followUps={['How would you route sessions to keep cache locality without hot-spotting replicas?', 'What would you cut first during a GPU shortage?']}
      />
      <InterviewQuestion
        q="How do you know whether a new completion model is actually better?"
        senior={<p>Run it on a benchmark like HumanEval and compare pass rates, then roll it out if it scores higher.</p>}
        staff={<>
          <p>Offline benchmarks are a gate, not the verdict. Function-level suites are likely contaminated and do not reflect real repositories. I’d use three layers:</p>
          <ul>
            <li>Offline suites built from our own repos (held-out, recent code).</li>
            <li>Shadow latency tests at production load.</li>
            <li>An online A/B test on acceptance rate <em>and</em> retained characters after a few minutes, which shows whether accepted code stayed.</li>
          </ul>
          <p>Guardrails: p90 latency, cancellation rate, cost per request. A model that is slightly smarter but misses the typing pause is worse.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Two products: a latency-critical completion path and a slower, correctness-critical chat and agent path.',
        'The completion budget is debounce + network + queue + prefill + decode + render; attack the biggest segment.',
        'Prefix reuse on sticky replicas, cancellation, and a small FIM model are the key latency levers.',
        'Context assembly decides quality: pack the best sources into a fixed token budget and respect exclusions.',
        'Agents execute only in sandboxes, stop on limits, and hand humans a reviewable diff.',
        'Judge models on real-repo evals plus online acceptance and retention, not a single benchmark.',
      ]} />
    </>
  )
}
