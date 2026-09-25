import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, References, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { AiCaseGwRoutingDemo } from './demos/ai-case-gw-routing-demo'

const NODES: ArchNode[] = [
  { id: 'apps', label: 'Internal apps', sub: 'SDK / HTTP', kind: 'client', x: 10, y: 50,
    detail: 'Hundreds of services call one OpenAI-compatible endpoint with a model alias like "fast" or "smart". None of them hold provider API keys.' },
  { id: 'gw', label: 'Gateway edge', sub: 'auth · quotas', kind: 'lb', x: 30, y: 50,
    detail: 'Authenticates the calling team, checks token budgets and rate limits, and assigns a request id. The overhead budget is small, on the order of milliseconds.' },
  { id: 'quota', label: 'Quota store', sub: 'Redis', kind: 'cache', x: 30, y: 16,
    detail: 'Per-team token buckets and daily or monthly budgets. Updated atomically: reserve before the call, reconcile after.' },
  { id: 'router', label: 'Router', sub: 'policy engine', kind: 'service', x: 52, y: 50,
    detail: 'Maps an alias to an ordered list of concrete deployments using capability, price, latency, and health. It owns retries, fallbacks, and circuit breakers.' },
  { id: 'cache', label: 'Response cache', sub: 'exact match', kind: 'cache', x: 52, y: 16,
    detail: 'Optional. Keyed by the full normalized request plus tenant, and only for deterministic calls (temperature 0).' },
  { id: 'pa', label: 'Provider A', kind: 'external', x: 82, y: 16, detail: 'A hosted model API. Every provider enforces its own requests-per-minute and tokens-per-minute limits.' },
  { id: 'pb', label: 'Provider B', kind: 'external', x: 88, y: 42 },
  { id: 'self', label: 'Self-hosted', sub: 'GPU pool', kind: 'worker', x: 82, y: 68, detail: 'Open-weight models on your own GPUs: cheapest per token at high utilization, slowest to scale up.' },
  { id: 'logs', label: 'Log pipeline', sub: 'PII redaction', kind: 'queue', x: 52, y: 86,
    detail: 'Requests, responses, and usage go out asynchronously, with PII redacted before storage. Payload logging is off by default for sensitive teams.' },
  { id: 'ledger', label: 'Cost ledger', sub: 'per team', kind: 'db', x: 80, y: 90, detail: 'Usage × price per model, attributed to team and project, for chargeback and budget alerts.' },
  { id: 'cfg', label: 'Route config', sub: 'versioned', kind: 'db', x: 28, y: 86, detail: 'Aliases, fallbacks, and quotas as reviewed config. Changes roll out gradually like code.' },
]

const EDGES: ArchEdge[] = [
  { from: 'apps', to: 'gw' }, { from: 'gw', to: 'quota' }, { from: 'gw', to: 'router' }, { from: 'router', to: 'cache' },
  { from: 'router', to: 'pa' }, { from: 'router', to: 'pb' }, { from: 'router', to: 'self' },
  { from: 'router', to: 'logs', async: true }, { from: 'logs', to: 'ledger' }, { from: 'cfg', to: 'router', async: true, label: 'push' },
]

const REFS: Reference[] = [
  { title: 'Rate limits', source: 'OpenAI API documentation', url: 'https://platform.openai.com/docs/guides/rate-limits', kind: 'docs', note: 'RPM/TPM limits and 429 handling' },
  { title: 'Rate limits', source: 'Anthropic API documentation', url: 'https://docs.anthropic.com/en/api/rate-limits', kind: 'docs' },
  { title: 'Streaming Messages', source: 'Anthropic API documentation', url: 'https://docs.anthropic.com/en/docs/build-with-claude/streaming', kind: 'docs', note: 'Server-sent event streaming' },
  { title: 'RFC 6585: Additional HTTP Status Codes (429 Too Many Requests)', source: 'IETF', year: 2012, url: 'https://www.rfc-editor.org/rfc/rfc6585', kind: 'rfc' },
  { title: 'Timeouts, retries, and backoff with jitter', source: 'Amazon Builders’ Library', url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/', kind: 'docs' },
  { title: 'CircuitBreaker', source: 'Martin Fowler', year: 2014, url: 'https://martinfowler.com/bliki/CircuitBreaker.html', kind: 'blog' },
  { title: 'Envoy AI Gateway', source: 'Envoy Proxy project', url: 'https://aigateway.envoyproxy.io/', kind: 'docs', note: 'An open-source example of this pattern' },
  { title: 'OWASP Top 10 for Large Language Model Applications', source: 'OWASP Gen AI Security Project', url: 'https://genai.owasp.org/llm-top-10/', kind: 'docs' },
]

export default function LlmGatewayChapter() {
  return (
    <>
      <p>
        Once a company has more than a handful of teams calling LLMs, the same problems show up everywhere. Provider
        keys get pasted into repos, one team’s batch job exhausts the org-wide rate limit, nobody knows who spent
        $80K last month, and a provider outage takes down every AI feature at once. An <strong>LLM gateway</strong>
        solves these in one place. The interview is about routing and failover under rate limits, token-based
        quotas, and billing correctness with streaming.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['One API (OpenAI-compatible) over several providers and self-hosted models', 'Model aliases with routing and fallback rules', 'Per-team quotas, budgets, and priority tiers', 'Usage and cost attribution; request logs with redaction']}
        nonFunctional={['Gateway overhead < ~10–20 ms at p99', 'Availability above any single provider', 'Streaming passthrough with no buffering', 'Never double-bill or double-execute a request']}
        outOfScope={['Training models', 'Application-level prompt management']}
      />

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['300 internal applications', '50M LLM calls per day', '~3K input + ~500 output tokens per call', 'Average stream lasts ~8 s; peak ≈ 3× average']}
        rows={[
          { label: 'Peak QPS', math: '50M / 86,400 × 3', result: '≈ 1.7K' },
          { label: 'Concurrent streams', math: '1.7K × 8 s', result: '≈ 14K open' },
          { label: 'Tokens / day', math: '50M × 3.5K', result: '≈ 175B' },
          { label: 'Raw log volume', math: '50M × ~14 KB', result: '≈ 700 GB / day' },
        ]}
      />
      <p>
        QPS is modest; <strong>long-lived streaming connections</strong> and <strong>payload logs</strong> are what
        size the fleet and the storage bill. The gateway must be fully async, non-buffering I/O.
      </p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/chat/completions', desc: 'Provider-agnostic chat call. The model field takes an alias ("fast", "smart", "cheap-batch"). Supports stream: true.', body: '{ model, messages, max_tokens, stream }', returns: 'JSON | text/event-stream' },
        { method: 'GET', path: '/v1/models', desc: 'Aliases this team may use, with their current backing models.', returns: '{ data: [{ id, capabilities }] }' },
        { method: 'GET', path: '/v1/usage', desc: 'Tokens and cost by team, project, and model for a time range.', returns: '{ rows[] }' },
        { method: 'PUT', path: '/admin/routes/{alias}', desc: 'Update routing: ordered deployments, weights, fallbacks. Versioned and rolled out gradually.', body: '{ targets[], fallbacks[] }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Thin, stateless data plane; quotas in a fast store; everything else async"
        flows={[
          { name: 'Chat call', path: ['apps', 'gw', 'router', 'pa'], steps: ['App calls the gateway with alias "smart"', 'Edge authenticates the team and reserves tokens from its budget', 'Router picks the healthy, cheapest deployment and streams the response back'] },
          { name: 'Failover', path: ['apps', 'gw', 'router', 'pb'], steps: ['Same call', 'Budget check passes', 'Provider A’s breaker is open after repeated 5xx, so the router uses the next target in the alias'] },
          { name: 'Metering', path: ['router', 'logs', 'ledger'], steps: ['Usage from the provider response is emitted after the stream ends', 'Redacted and attributed to team and project in the cost ledger'] },
        ]} />

      <H2 id="routing">5 · Deep dive: routing, retries, and failover</H2>
      <AiCaseGwRoutingDemo />
      <ul>
        <li><strong>Aliases, not model names.</strong> Apps ask for a capability tier; the router maps it to concrete deployments. Swapping a model then means changing config, not redeploying 300 apps.</li>
        <li><strong>Retry only when it is safe.</strong> Retry or fail over <em>before the first token is sent</em>. After streaming starts, a silent retry would duplicate or splice output, so surface the error instead.</li>
        <li><strong>Respect 429s.</strong> Honor <code>Retry-After</code>, use backoff with jitter, and shift traffic rather than hammering a provider that is shedding load.</li>
        <li><strong>Circuit breakers per deployment.</strong> Stop sending to a deployment that keeps failing and probe it periodically. This matters most for <em>timeouts</em>, where every failed attempt burns seconds.</li>
      </ul>

      <H2 id="quotas">6 · Deep dive: token-based quotas</H2>
      <p>
        Requests per second is the wrong unit: one request can be 100 tokens or 100K. Providers limit tokens per
        minute, so the gateway should too. The catch is that output length is unknown until the stream ends. The
        answer is <strong>reserve, then reconcile</strong>:
      </p>
      <CodeBlock lang="ts" title="reserve-then-reconcile token budget" code={`
async function admit(team: string, req: ChatRequest) {
  const estimate = countTokens(req.messages) + (req.max_tokens ?? DEFAULT_MAX_OUTPUT)
  // Atomic in Redis (Lua): refill the bucket, then take the estimate if available.
  const ok = await quota.tryReserve(team, estimate)
  if (!ok) throw new HttpError(429, { retryAfter: quota.retryAfter(team) })
  return estimate
}

async function settle(team: string, reserved: number, usage: Usage) {
  const actual = usage.input_tokens + usage.output_tokens // as reported by the provider
  await quota.refund(team, reserved - actual)            // return the unused reservation
  await ledger.record(team, usage)                       // bill actual usage only
}`} />
      <CompareTable
        columns={['Requests/sec limit', 'Token bucket (reserve + reconcile)', 'Monthly budget']}
        rows={[
          { label: 'Protects', cells: ['Gateway CPU', 'Provider TPM limits and fairness between teams', 'Spend'] },
          { label: 'Granularity', cells: ['Per call', 'Per token', 'Per dollar'] },
          { label: 'Use it for', cells: ['Abuse protection', 'Day-to-day admission control', 'Alerts and hard caps'] },
        ]}
      />

      <H2 id="caching">7 · Deep dive: caching and logging</H2>
      <CompareTable
        columns={['Exact-match cache', 'Semantic cache']}
        rows={[
          { label: 'Key', cells: ['Hash of full request + model + params + tenant', 'Embedding similarity of the prompt'] },
          { label: 'Correctness', cells: ['Safe for deterministic calls', 'Can return an answer to a different question'] },
          { label: 'Leak risk', cells: ['None if tenant-scoped', 'High if shared across users or tenants'] },
          { label: 'Use', cells: ['Batch jobs, evals, repeated tool calls', 'Only for narrow, public, FAQ-style flows'] },
        ]}
      />
      <ul>
        <li><strong>Logs are sensitive data.</strong> Prompts contain customer data. Redact PII before storage, allow per-team payload logging opt-out, set short retention, and restrict access. Always keep usage metadata, even when payloads are dropped.</li>
        <li><strong>Bill from provider-reported usage.</strong> Use the usage block in the final response or stream event, not your own estimate. Keep a request id end to end so retries never create a second charge.</li>
      </ul>

      <H2 id="data-model">8 · Data model</H2>
      <CodeBlock lang="ts" title="route config and usage record" code={`
type Route = {
  alias: 'fast' | 'smart' | 'cheap-batch'
  version: number
  targets: { deployment: string; weight: number }[]   // e.g. provider-a/model-x, self/llama
  fallbacks: string[]                                  // tried in order when targets fail
  maxOutputTokens: number
}

type UsageRecord = {
  requestId: string        // idempotency: one record per request, whatever the retries
  team: string
  project: string
  alias: string
  deployment: string
  inputTokens: number
  outputTokens: number
  costMicros: number
  latencyMs: number
  status: 'ok' | 'error' | 'rejected'
  ts: number
}`} />

      <H2 id="staff">9 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Build vs adopt.</strong> Open-source and commercial gateways already cover routing, keys, and quotas. Build only the parts that encode your policies (budgets, data rules, eval-driven routing).</li>
          <li><strong>Data governance.</strong> Enforce per-team rules on which data may go to which provider or region (for example, regulated data only to self-hosted models). The gateway is the natural enforcement point.</li>
          <li><strong>Capacity contracts.</strong> Provider limits are shared org-wide. Allocate reserved throughput to priority tiers so an offline batch job can never starve user-facing traffic.</li>
          <li><strong>Evaluation-aware routing.</strong> Routing to a cheaper model is a quality change. Gate alias changes on each consuming team’s eval suite, and roll out gradually.</li>
          <li><strong>Not a single point of failure.</strong> Run the gateway as a stateless multi-region fleet. If the quota store is down, fail open with local limits rather than blocking every AI feature.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="During peak hours your main provider starts returning 429s. What should the gateway do?"
        senior={<p>Retry with exponential backoff, and if that doesn’t work, fall back to a secondary provider.</p>}
        staff={<>
          <p>429 means “shed load”, so blind retries make it worse. I’d:</p>
          <ul>
            <li>Honor <code>Retry-After</code> and add jitter.</li>
            <li>Shift the overflow to the next target in the alias <em>before</em> any tokens stream, with circuit breakers per deployment.</li>
            <li>Protect priority: interactive traffic keeps its reserved share, and batch jobs get queued or rejected first.</li>
          </ul>
          <p>Longer term, it is a capacity problem: forecast token demand per tier, buy reserved throughput, and alert on sustained TPM saturation. I’d also check that the fallback model passes each alias’s evals, because failover must not quietly lower quality for a feature that depends on it.</p>
        </>}
        followUps={['What if the stream fails halfway through?', 'How do you prevent one team’s batch job from causing this?']}
      />
      <InterviewQuestion
        q="How do you enforce per-team token budgets accurately when responses are streamed?"
        senior={<p>Count input tokens before the call and output tokens as they stream, then update the team’s usage in Redis.</p>}
        staff={<>
          <p>Reserve, then reconcile. At admission, atomically reserve input tokens plus <code>max_tokens</code> from the team’s bucket. That bounds the worst case and makes 429 decisions instant. When the stream ends, refund the difference using the provider-reported usage, and write one usage record keyed by request id so retries never double-count.</p>
          <p>For monthly dollar budgets I’d accept slight overshoot (reconciled asynchronously) with soft alerts at 80% and hard caps enforced at admission. Cancelled or abandoned streams are the edge case: providers may still bill tokens generated before the disconnect, so settle from their usage data, not from what reached the client.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'A gateway centralizes keys, routing, quotas, and cost attribution for every LLM-using team.',
        'Apps call aliases; the router maps them to deployments with fallbacks and circuit breakers.',
        'Retry or fail over only before the first streamed token; honor 429 Retry-After with jittered backoff.',
        'Rate-limit in tokens: reserve input + max_tokens, then reconcile from provider-reported usage.',
        'Exact-match caching is safe when tenant-scoped; semantic caching risks wrong answers and leaks.',
        'Logs are sensitive data: redact, minimize, and bill from usage metadata with idempotent request ids.',
      ]} />
    </>
  )
}
