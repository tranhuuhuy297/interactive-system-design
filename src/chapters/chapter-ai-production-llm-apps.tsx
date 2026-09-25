import {
  ArchitectureDiagram, Callout, CodeBlock, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, LayerStack, MentalModel,
  References, SideBySide, Term, TLDR,
} from '../components/ui'
import {
  Archive, Braces, Calculator, Clock, Copy, EyeOff, FlaskConical, Ghost, Globe2, Rocket, Scale, Search, Send, ShieldCheck,
  Tag, Wallet, XCircle, Zap,
} from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { AiProdCostDemo } from './demos/ai-prod-cost-demo'

const REFS: Reference[] = [
  { title: 'Prompt caching', source: 'OpenAI API docs', url: 'https://platform.openai.com/docs/guides/prompt-caching', kind: 'docs' },
  { title: 'Prompt caching', source: 'Anthropic docs', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching', kind: 'docs' },
  { title: 'Rate limits', source: 'OpenAI API docs', url: 'https://platform.openai.com/docs/guides/rate-limits', kind: 'docs', note: 'RPM/TPM limits and usage tiers' },
  { title: 'Server-sent events', source: 'WHATWG HTML Living Standard', url: 'https://html.spec.whatwg.org/multipage/server-sent-events.html', kind: 'docs' },
  { title: 'GPT Semantic Cache: Reducing LLM Costs and Latency via Semantic Embedding Caching', source: 'Regmi & Pun', year: 2024, url: 'https://arxiv.org/abs/2411.05276', kind: 'paper' },
  { title: 'GPTCache', source: 'Zilliz (open source)', url: 'https://github.com/zilliztech/GPTCache', kind: 'docs', note: 'Semantic cache library' },
  { title: 'Semantic conventions for generative AI', source: 'OpenTelemetry', url: 'https://opentelemetry.io/docs/specs/semconv/gen-ai/', kind: 'docs' },
  { title: 'Timeouts, retries, and backoff with jitter', source: 'Amazon Builders’ Library', url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/', kind: 'blog' },
]

const NODES: ArchNode[] = [
  { id: 'client', label: 'Client', sub: 'streams tokens', kind: 'client', x: 10, y: 50 },
  { id: 'api', label: 'App API', sub: 'auth · business logic', kind: 'service', x: 28, y: 50 },
  { id: 'gw', label: 'LLM gateway', sub: 'route · limit · log', kind: 'lb', x: 48, y: 50,
    detail: 'One internal API in front of every model: per-tenant token quotas, retries and fallbacks, caching, redaction, and cost attribution. See the LLM Gateway case study.' },
  { id: 'exact', label: 'Exact cache', sub: 'hash(prompt, params)', kind: 'cache', x: 48, y: 15,
    detail: 'Safe and cheap: only identical requests (same prompt, model, and parameters) hit. Typical for repeated system prompts plus common queries.' },
  { id: 'sem', label: 'Semantic cache', sub: 'embedding similarity', kind: 'search', x: 70, y: 15,
    detail: 'Matches “similar enough” questions. Saves more, but a false hit returns an answer to a different question. Scope per tenant and set the threshold with labeled data.' },
  { id: 'provA', label: 'Provider A', sub: 'primary model', kind: 'external', x: 72, y: 42 },
  { id: 'provB', label: 'Provider B', sub: 'fallback model', kind: 'external', x: 72, y: 66,
    detail: 'Fallbacks must be evaluated like the primary. A “working” fallback that silently halves quality is an incident nobody notices.' },
  { id: 'self', label: 'Self-hosted pool', sub: 'open-weight models', kind: 'worker', x: 72, y: 88 },
  { id: 'obs', label: 'Traces & metrics', sub: 'tokens · cost · latency', kind: 'db', x: 26, y: 85 },
  { id: 'prompts', label: 'Prompt registry', sub: 'versioned templates', kind: 'storage', x: 48, y: 85 },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'api', label: 'SSE' }, { from: 'api', to: 'gw' }, { from: 'gw', to: 'exact' }, { from: 'gw', to: 'sem' },
  { from: 'gw', to: 'provA' }, { from: 'gw', to: 'provB' }, { from: 'gw', to: 'self' },
  { from: 'gw', to: 'obs', async: true }, { from: 'gw', to: 'prompts' },
]

export default function ProductionLlmAppsChapter() {
  return (
    <>
      <TLDR items={[
        'Put a gateway between product code and models. Quotas, fallbacks, caching, and logging live there.',
        'Stream tokens and measure time to first token. Cancel upstream when the user leaves.',
        'Exact, semantic, and provider prompt caching save very different amounts at very different risk.',
        'Budget and rate-limit in tokens, per tenant and per feature.',
        'Fail over on slow first tokens, only to fallbacks you have evaluated.',
      ]} />
      <MentalModel id="ai-production" />
      <p>
        Calling a model API takes one line of code. Running an LLM feature for millions of users is a systems
        problem:
      </p>
      <ul>
        <li>latency varies and is measured in seconds;</li>
        <li>costs scale with{' '}<Term def="Chunks of text, roughly ¾ of a word each in English. Providers bill per token in and out.">tokens</Term>, not requests;</li>
        <li>providers have rate limits and outages;</li>
        <li>outputs can’t be unit-tested with <code>assertEquals</code>.</li>
      </ul>
      <p>
        This chapter is the production checklist. The GPU side is covered in{' '}
        <a href="#/llm-serving">LLM Inference Platform</a> and the <a href="#/ai-inference">inference chapters</a>.
      </p>

      <H2 id="architecture">Reference architecture</H2>
      <p>
        The key move is an{' '}<Term def="An internal proxy service that every LLM call goes through, owning cross-cutting concerns.">LLM gateway</Term>{' '}
        between product code and models. Trace the three flows to see what it does.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={400}
        caption="Put a gateway between product code and models; everything cross-cutting lives there"
        flows={[
          { name: 'Cache hit', path: ['client', 'api', 'gw', 'exact'], steps: ['User asks a question', 'API renders the versioned prompt', 'Gateway finds an identical cached response and returns it in milliseconds'] },
          { name: 'Model call', path: ['client', 'api', 'gw', 'provA'], steps: ['User asks a question', 'API calls the gateway with tenant and feature tags', 'Gateway checks quota and streams from the primary model'] },
          { name: 'Failover', path: ['client', 'api', 'gw', 'provB'], steps: ['Request arrives', 'API calls the gateway', 'Primary times out on first token, so the gateway retries on the evaluated fallback model'] },
        ]} />

      <H2 id="streaming">Streaming UX</H2>
      <p>A full answer can take many seconds. Streaming makes the wait feel short, but it changes how you handle errors.</p>
      <FlowDiagram caption="Two timeouts, one cancel, one final check"
        steps={[
          { label: 'Send request', icon: Send },
          { label: 'First token', sub: 'short timeout · fail over here', icon: Clock },
          { label: 'Stream tokens', sub: 'SSE or WebSocket', icon: Zap },
          { label: 'User leaves?', sub: 'cancel upstream', icon: XCircle },
          { label: 'Finish', sub: 'validate JSON at the end', icon: Braces },
        ]} />
      <ul>
        <li><strong>Stream tokens</strong> over{' '}<Term def="SSE: a simple HTTP mechanism where the server keeps the response open and pushes events.">server-sent events</Term>{' '}or WebSockets. Users judge speed by <em>time to first token</em>, not total time.</li>
        <li><strong>Separate timeouts</strong> for first token (e.g. a few seconds) and for the whole response. A slow first token is the best signal to fail over.</li>
        <li><strong>Propagate cancel.</strong> When the user closes the tab, abort the upstream request so you stop paying for tokens nobody reads.</li>
        <li><strong>Stream structured output carefully.</strong> Partial JSON is not valid JSON, so validate at the end or use a streaming parser.</li>
      </ul>

      <H2 id="caching">Three kinds of caching</H2>
      <p>
        Caching is the cheapest cost lever, but “similar” is not “identical.” A{' '}
        <Term def="A cache that returns a stored answer when a new question’s embedding is close enough to an old one.">semantic cache</Term>{' '}
        can serve the wrong answer. Compare the three kinds, then play with the calculator.
      </p>
      <SideBySide caption="Same goal, very different risk"
        panels={[
          { title: 'Exact response cache', icon: Copy, tone: 'good', points: ['Match: identical prompt + model + params', '+ Full call avoided', '- Stale if data changes: put data versions in the key'] },
          { title: 'Semantic cache', icon: Search, tone: 'bad', points: ['Match: embedding similarity above a threshold', '+ Also catches paraphrases', '- False hits serve the wrong answer', '- Must be tenant-scoped and evaluated'] },
          { title: 'Provider prompt caching', icon: Archive, points: ['Match: shared prompt prefix', '+ Cheaper, faster input tokens', '- Output still generated', '- Stable part must come first'] },
        ]} />
      <AiProdCostDemo />

      <H2 id="limits">Rate limits and token budgets</H2>
      <p>
        Providers limit <strong>requests per minute</strong> (RPM) and <strong>tokens per minute</strong> (TPM). So your
        own limits should count tokens too.
      </p>
      <FlowDiagram caption="Reserve before, reconcile after"
        steps={[
          { label: 'Budget', sub: 'per tenant and per feature', icon: Wallet },
          { label: 'Estimate', sub: 'input known + max_tokens cap', icon: Calculator },
          { label: 'Call the model', icon: Send },
          { label: 'Reconcile', sub: 'charge actual usage', icon: Scale },
        ]} />
      <p>
        Reserve capacity for interactive traffic. Push batch jobs to off-peak hours or discounted batch APIs. The
        algorithms are the same as in <a href="#/rate-limiting">Rate Limiting</a>, with tokens as the unit.
      </p>

      <H2 id="reliability">Timeouts, retries, and fallbacks</H2>
      <p>
        Providers fail, often by getting slow rather than returning errors. A fallback chain with a{' '}
        <Term def="A switch that stops sending traffic to a failing dependency for a while, then tests it again.">circuit breaker</Term>{' '}
        keeps the feature up.
      </p>
      <LayerStack legend="The fallback chain from the sketch below: try top to bottom, skip any with an open breaker"
        layers={[
          { label: 'primary-large', sub: 'normal traffic', size: 1, value: 'first token ≤ 4 s', highlight: true },
          { label: 'fallback-large', sub: 'evaluated to parity', size: 1, value: 'first token ≤ 4 s' },
          { label: 'small-fast', sub: 'degraded mode: UI says “limited”', size: 0.6, value: 'first token ≤ 2 s' },
        ]} />
      <CodeBlock lang="ts" title="gateway call with fallback (sketch)" code={`
const CHAIN = [
  { model: 'primary-large',  firstTokenTimeoutMs: 4_000 },
  { model: 'fallback-large', firstTokenTimeoutMs: 4_000 }, // evaluated to parity
  { model: 'small-fast',     firstTokenTimeoutMs: 2_000, degraded: true },
]

async function complete(req: LlmRequest): Promise<LlmStream> {
  await quota.reserve(req.tenant, estimateTokens(req))       // token-aware limit
  for (const step of CHAIN) {
    if (breaker.isOpen(step.model)) continue                 // skip unhealthy providers
    try {
      const stream = await callModel(step.model, req, step.firstTokenTimeoutMs)
      return tagDegraded(stream, step.degraded)              // UI can say "limited mode"
    } catch (err) {
      breaker.record(step.model, err)
      if (!isRetryable(err)) throw err                       // 400s won't fix themselves
    }
  }
  throw new AllModelsUnavailable()
}`} />
      <Callout kind="pitfall">
        Retrying after tokens have already streamed to the user produces duplicated or spliced answers. Retry only
        before the first token, or restart the answer visibly.
      </Callout>

      <H2 id="observability">Observability and cost attribution</H2>
      <p>When the bill doubles or quality dips, you need to find the cause in minutes. That takes rich, tagged traces.</p>
      <ul>
        <li><strong>Trace every call:</strong> model and version, prompt template version, input and output tokens, time to first token, total latency, cache status, finish reason, and cost.</li>
        <li><strong>Tag with tenant and feature</strong> so cost rolls up to whoever caused it. “The AI bill doubled” must be answerable in minutes.</li>
        <li><strong>Sample and store prompts and responses</strong> (after redaction) for debugging and evals, with a retention policy.</li>
        <li>Use a standard schema. The OpenTelemetry generative-AI semantic conventions keep traces portable across vendors.</li>
      </ul>

      <H2 id="versioning">Prompts and models are deployable artifacts</H2>
      <p>
        Version prompts like code. Pin model versions explicitly. Never let a provider’s silent model update or an
        edited prompt reach 100% of traffic untested.
      </p>
      <p>
        Roll out with offline eval gates, then{' '}
        <Term def="Shadow: run the new version on real traffic without showing users. Canary: show it to a small slice first.">shadow or canary</Term>{' '}
        traffic with online quality metrics. See <a href="#/ai-evals">Evaluating LLM Systems</a>.
      </p>
      <FlowDiagram
        steps={[
          { label: 'Version + pin', sub: 'prompt version, model version', icon: Tag },
          { label: 'Offline evals', sub: 'gate', icon: FlaskConical },
          { label: 'Shadow / canary', sub: 'online quality metrics', icon: Ghost },
          { label: 'Full rollout', icon: Rocket },
        ]} />

      <H2 id="privacy">Privacy and data handling</H2>
      <p>Every prompt is data leaving your system. Treat it with the same care as any other data flow.</p>
      <FlowDiagram caption="Check the data at the boundary, then apply the same retention everywhere it lands"
        steps={[
          { label: 'Prompt built', icon: Braces },
          { label: 'Redact PII', sub: 'if the model doesn’t need it', icon: EyeOff },
          { label: 'Approved endpoint', sub: 'provider policy, region', icon: Globe2 },
          { label: 'Logs, traces, caches', sub: 'same retention + deletion', icon: ShieldCheck },
        ]} />
      <ul>
        <li>Redact or tokenize{' '}<Term def="Personally identifiable information: names, emails, phone numbers, IDs, and similar.">PII</Term>{' '}before it leaves your boundary when the model doesn’t need it.</li>
        <li>Know each provider’s data retention and training policies, and route regulated data only to approved endpoints or regions.</li>
        <li>Apply the same retention and deletion rules to logs, traces, and caches as to the source data. Semantic caches are easy to forget.</li>
      </ul>

      <Callout kind="staff">
        <ul>
          <li><strong>Unit economics first:</strong> know cost per request, per successful task, and per user, and how they scale with context length.</li>
          <li><strong>The gateway is leverage:</strong> one place for quotas, fallbacks, caching, redaction, and attribution instead of every team re-solving them.</li>
          <li><strong>Degrade deliberately:</strong> decide ahead of time which features switch to a smaller model, go cached-only, or turn off during a capacity crunch.</li>
          <li><strong>Every cache and fallback is a quality decision</strong>, and needs an eval, not just an uptime check.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Your LLM feature’s monthly bill is growing faster than usage. How do you bring cost down without hurting quality?"
        senior={<p>Add caching, use a cheaper model for simple requests, shorten prompts, and limit output tokens.</p>}
        staff={<>
          <p>First, <strong>attribute</strong>: break cost down by feature, tenant, and token type (input vs output, cached vs not). Growth faster than usage usually means context growth (longer histories, bigger retrieved chunks) or a model change.</p>
          <p>Then fix it in order of safety. Reorder prompts so the stable prefix gets provider prompt caching. Trim retrieval to fewer, better chunks. Use an exact cache for repeated requests. Route by difficulty to a smaller model, gated by eval parity on a labeled set.</p>
          <p>Add a semantic cache only with a measured false-hit rate. Each change ships behind an eval gate, and cost per <em>successful</em> task is the metric, so we don’t save money by quietly failing users.</p>
        </>}
        followUps={['How would you decide which requests are “easy”?', 'What goes into the cache key?', 'How do you detect quality regressions from routing?']}
      />
      <InterviewQuestion
        q="Your primary model provider has a partial outage: time to first token jumps from 500 ms to 20 s. What should the system do?"
        senior={<p>Retry with backoff and fail over to another provider. Add a circuit breaker so we stop sending traffic to the failing one.</p>}
        staff={<>
          <p>Detect it on <strong>time to first token</strong>, not errors, because partial outages often look like slowness. A first-token timeout of a few seconds triggers per-request failover, and a circuit breaker on first-token latency percentiles moves traffic proactively.</p>
          <p>The fallback must already be evaluated and have quota reserved. Otherwise failover just moves the outage (or a rate-limit storm) to provider B.</p>
          <p>Degrade by tier: interactive traffic gets the fallback, batch jobs pause, and the UI can show a limited-mode notice. Retries only happen before any tokens have streamed. Afterwards, compare quality metrics between the two windows.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Stream responses, measure time to first token, and propagate cancellation upstream.',
        'Exact, semantic, and provider prompt caching have very different savings and risks.',
        'Rate-limit and budget in tokens, per tenant and per feature.',
        'Fail over on first-token latency, only to evaluated fallbacks with reserved quota.',
        'Trace tokens, cost, and versions for every call; prompts and models are deployable artifacts.',
      ]} />
    </>
  )
}
