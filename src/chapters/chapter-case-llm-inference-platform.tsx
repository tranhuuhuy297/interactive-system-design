import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode } from '../components/ui'
import { LlmBatchingSimulatorDemo } from './demos/llm-batching-simulator-demo'
import { LlmGpuMemoryCalculatorDemo } from './demos/llm-gpu-memory-calculator-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Apps / SDK', kind: 'client', x: 7, y: 50 },
  { id: 'gw', label: 'API gateway', sub: 'auth · quotas · SSE', kind: 'lb', x: 24, y: 50,
    detail: 'Authenticates the API key and enforces limits in tokens per minute as well as requests per minute, since one request can cost 100× another. It holds the streaming connection open and never retries a request that has already streamed tokens.' },
  { id: 'meter', label: 'Usage metering', sub: 'Kafka', kind: 'queue', x: 24, y: 86,
    detail: 'Every request emits final input and output token counts asynchronously for billing, quotas and capacity planning.' },
  { id: 'router', label: 'Scheduler', sub: 'model · tier · prefix', kind: 'service', x: 45, y: 50,
    detail: 'Chooses a replica by model or LoRA adapter, priority tier, queue depth, free KV-cache memory, and prefix affinity (route shared system prompts to where their KV is already cached).' },
  { id: 'queue', label: 'Priority queues', kind: 'queue', x: 45, y: 14,
    detail: 'Separate queues per model and tier (interactive, standard, batch). Admission control rejects early with 429 instead of letting TTFT explode.' },
  { id: 'prefill', label: 'Prefill pool', sub: 'compute-bound', kind: 'worker', x: 67, y: 30,
    detail: 'Processes the whole prompt in parallel and builds its KV cache. Dominates time-to-first-token. Can be a separate GPU pool (disaggregated) or share GPUs with decode.' },
  { id: 'decode', label: 'Decode pool', sub: 'memory-bound', kind: 'worker', x: 67, y: 72,
    detail: 'Generates one token per sequence per iteration with continuous batching. Limited by HBM bandwidth and KV-cache capacity, not FLOPs.' },
  { id: 'prefix', label: 'Prefix cache', sub: 'KV blocks', kind: 'cache', x: 89, y: 14,
    detail: 'KV blocks for common prefixes (system prompts, few-shot examples, long documents) are reused across requests, which skips most of the prefill work.' },
  { id: 'registry', label: 'Model registry', sub: 'weights', kind: 'storage', x: 89, y: 86,
    detail: 'Versioned weights and adapters. Loading tens to hundreds of GB takes minutes, so keep warm pools and pre-pull images and weights onto nodes.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'gw' }, { from: 'gw', to: 'router' }, { from: 'gw', to: 'meter', async: true },
  { from: 'router', to: 'queue' }, { from: 'router', to: 'prefill' }, { from: 'prefill', to: 'decode', label: 'KV' },
  { from: 'decode', to: 'gw', label: 'tokens' }, { from: 'prefill', to: 'prefix' },
  { from: 'registry', to: 'prefill' }, { from: 'registry', to: 'decode' },
]

export default function LlmInferencePlatformChapter() {
  return (
    <>
      <p>
        An LLM inference platform is a request/response API on the outside and a <strong>GPU scheduling problem</strong> on
        the inside. Everything classic still applies: gateways, rate limits, queues, autoscaling. But the scarce resource
        is GPU memory, requests vary in cost by orders of magnitude, and the response is a stream that cannot simply be
        retried. Interviewers use this prompt to see whether you can reason from the hardware up.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Chat/completions API with token streaming', 'Multiple models and sizes; fine-tuned adapters', 'Per-key quotas and usage-based billing', 'Batch (offline) API at a discount']}
        nonFunctional={['TTFT (time to first token) p95 < ~1 s for interactive traffic', 'TPOT (time per output token) fast enough to out-read humans', '99.9% availability', 'Cost per million tokens as low as possible']}
        outOfScope={['Model training', 'Safety classifiers (mention as a pluggable stage)', 'Retrieval / tools orchestration']}
      />
      <Callout kind="tip">
        Name the two latency metrics explicitly. <strong>TTFT</strong> is dominated by queueing plus prefill (prompt length).
        <strong> TPOT</strong> is dominated by decode batch size and memory bandwidth. They trade off against each other and
        against throughput, and naming both is an immediate seniority signal.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['50M requests/day, peak 3× average', 'Avg 1,000 input + 300 output tokens', 'One 70B-class model in fp16 (Llama-3-70B-like shape)', 'Illustrative: ~2,500 output tokens/s per 8-GPU replica; ~$3 per GPU-hour. Both vary widely by hardware, engine and batch size.']}
        rows={[
          { label: 'Requests / s', math: '50M / 86,400', result: '≈ 580 avg, 1.7K peak' },
          { label: 'Output tokens / s', math: '580 × 300', result: '≈ 175K avg, 520K peak' },
          { label: 'Prompt tokens / s', math: '580 × 1,000', result: '≈ 580K avg' },
          { label: 'Weights', math: '70B × 2 bytes', result: '140 GB → ≥ 2 × 80 GB' },
          { label: 'KV per token', math: '2 × 80 × 8 × 128 × 2 B', result: '320 KiB' },
          { label: 'KV per request', math: '1,300 tok × 320 KiB', result: '≈ 0.43 GB' },
          { label: 'Decode replicas at peak', math: '520K / 2,500', result: '≈ 210 × 8 GPUs' },
          { label: 'Cost / 1M output tokens', math: '$24/h ÷ 9M tok/h', result: '≈ $2.7 (illustrative)' },
        ]}
      />
      <p>
        The punchline: the fleet is <strong>thousands of GPUs</strong>, so a 20% utilization gain from batching or
        caching is worth more than any other optimization in the design.
      </p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/chat/completions', desc: 'Generate a response. With stream=true, returns Server-Sent Events carrying token deltas, then a final usage event.', body: '{ model, messages[], max_tokens, temperature, stream }', returns: 'text/event-stream · data: { delta } … data: { usage }' },
        { method: 'POST', path: '/v1/batches', desc: 'Submit many requests for asynchronous processing within a window, at lower priority and price.', body: '{ input_file_id, completion_window }', returns: '202 { batch_id }' },
        { method: 'GET', path: '/v1/models', desc: 'List available models and adapters with context limits.', returns: '{ data: [{ id, context_window }] }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Classic front door, GPU-aware scheduling behind it. Prefill and decode may run on separate pools."
        flows={[
          { name: 'Streaming completion', path: ['client', 'gw', 'router', 'prefill', 'decode', 'gw', 'client'], steps: [
            'Client POSTs with stream: true', 'Gateway authenticates, reserves token budget, forwards to the scheduler',
            'Scheduler picks a replica with free KV memory; prefill builds the prompt’s KV cache', 'KV handed to a decode worker (same GPU if not disaggregated)',
            'Each decode iteration emits a token, streamed as an SSE event', 'Client renders tokens as they arrive; the final event carries usage'] },
          { name: 'Prefix-cache hit', path: ['client', 'gw', 'router', 'prefill', 'prefix'], steps: [
            'Request shares a long system prompt with earlier traffic', 'Gateway forwards as usual', 'Scheduler routes by prefix hash to a replica that has it cached', 'Cached KV blocks are reused; only the new suffix is prefilled'] },
          { name: 'Metering', path: ['gw', 'meter'], steps: ['On completion, input/output token counts are emitted asynchronously for billing and quotas'] },
        ]} />

      <H2 id="phases">5 · Deep dive: prefill vs decode</H2>
      <CompareTable
        columns={['Prefill', 'Decode']}
        rows={[
          { label: 'Work', cells: ['All prompt tokens at once, in parallel', 'One new token per sequence per step'] },
          { label: 'Bottleneck', cells: ['Compute (FLOPs)', 'Memory bandwidth: weights + KV read every step'] },
          { label: 'Drives', cells: ['TTFT', 'TPOT and throughput'] },
          { label: 'Scales with', cells: ['Prompt length', 'Output length × batch size'] },
        ]}
      />
      <p>
        Because the two phases stress different hardware limits, large deployments increasingly
        <strong> disaggregate</strong> them onto separate GPU pools and ship the KV cache between them. A long prompt then
        no longer stalls everyone’s decode loop. The cost is KV transfer bandwidth and a more complex scheduler.
      </p>

      <H2 id="batching">6 · Deep dive: continuous batching</H2>
      <p>
        Decode is memory-bound. Reading the weights once and producing tokens for 32 sequences costs roughly the same as
        doing it for one, so <strong>batching is where throughput comes from</strong>. Static batching wastes slots:
        short answers finish and sit idle until the longest one ends. Iteration-level (“continuous”) scheduling, introduced
        by the Orca paper (OSDI ’22) and now standard in engines like vLLM, admits new requests into freed slots
        every step.
      </p>
      <LlmBatchingSimulatorDemo />

      <H2 id="kv-cache">7 · Deep dive: the KV cache is the real capacity limit</H2>
      <p>
        Every in-flight token keeps its attention keys and values in GPU memory. Once the weights are loaded, the
        remaining HBM decides how many sequences, and how much context, you can serve at once.
      </p>
      <LlmGpuMemoryCalculatorDemo />
      <ul>
        <li><strong>Paged KV cache</strong> (PagedAttention, vLLM): store KV in fixed-size blocks like OS pages. This cuts fragmentation from reserving max_tokens up front and allows prefix blocks to be shared.</li>
        <li><strong>Grouped-query attention</strong> in the model (8 KV heads instead of 64) is why modern 70B models need about 8× less KV than older ones.</li>
        <li><strong>When memory runs out</strong>: preempt the lowest-priority sequences, then swap their KV to CPU memory or drop it and recompute later. Never OOM the whole batch.</li>
        <li><strong>Quantization</strong> (fp8/int8 weights, fp8 KV) trades a small quality risk for roughly 2× capacity. Validate it with evals, not vibes.</li>
      </ul>

      <H2 id="scheduling">8 · Scheduling, scaling and cost</H2>
      <CompareTable
        columns={['Lever', 'Effect', 'Trade-off']}
        rows={[
          { label: 'Prefix caching + affinity', cells: ['Skip prefill for shared prompts', 'Affinity fights load balance; use bounded-load consistent hashing'] },
          { label: 'Speculative decoding', cells: ['Draft model proposes, big model verifies several tokens per step', 'Wins at low batch; extra GPU work at high batch'] },
          { label: 'Multi-LoRA serving', cells: ['Many fine-tunes share one base model on the same GPUs', 'Adapter swapping and batching heterogeneity'] },
          { label: 'Priority tiers', cells: ['Interactive traffic protected; batch fills troughs', 'Needs preemption and fair-share accounting'] },
          { label: 'Autoscale on queue + KV use', cells: ['Tracks real saturation (CPU% is meaningless here)', 'Cold start = minutes to load weights → keep warm headroom'] },
        ]}
      />
      <CodeBlock lang="ts" title="token-aware admission (sketch)" code={`
// Reserve the worst case up front so one request can't blow the quota mid-stream.
function admit(key: ApiKey, req: CompletionRequest): Admission {
  const promptTokens = countTokens(req.messages)
  const reserve = promptTokens + req.max_tokens
  if (!tokenBucket(key).tryTake(reserve)) return { reject: 429, retryAfter: tokenBucket(key).refillIn(reserve) }
  if (queueDepth(req.model, key.tier) > limits[key.tier].maxQueue) return { reject: 503 }  // shed early, protect TTFT
  return { accept: true, onComplete: (used) => tokenBucket(key).refund(reserve - used) }
}`} />

      <H2 id="data-model">9 · Data model</H2>
      <CodeBlock lang="ts" title="records" code={`
type UsageEvent = {       // Kafka → billing & quota aggregates (idempotent on requestId)
  requestId: string; apiKeyId: string; model: string; adapter?: string
  inputTokens: number; cachedInputTokens: number; outputTokens: number
  ttftMs: number; totalMs: number; status: 'ok' | 'cancelled' | 'error'; ts: number
}

type Replica = { id: string; model: string; gpus: number; kvFreeBlocks: number; queue: number; warmPrefixes: string[] }`} />

      <H2 id="staff">10 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Unit economics first</strong>: frame every decision in cost per million tokens at a target TTFT/TPOT SLO. Batching, caching and quantization are all levers on the same curve.</li>
          <li><strong>Streaming breaks retries</strong>: a failure mid-stream cannot be transparently retried. Surface it to the client, make requests idempotent by id, and use fallback models only before the first token.</li>
          <li><strong>Capacity is regional and lumpy</strong>: GPUs come in fixed-size nodes, often in specific regions. Plan with reservations plus spot capacity for batch, and route overflow across regions when latency allows.</li>
          <li><strong>Observability</strong>: TTFT and TPOT percentiles per model and tier, queue time, KV utilization, preemptions, prefix-cache hit rate, and tokens/s per GPU. Alert on SLO burn, not GPU utilization.</li>
          <li><strong>Safety & abuse</strong>: input and output classifiers are extra pipeline stages with their own latency budget. Token-based limits also blunt denial-of-wallet attacks.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="TTFT p99 jumped from 800 ms to 6 s after launch, but GPU utilization looks fine. Where do you look?"
        senior={<p>Probably not enough GPUs, so add replicas. Check whether some requests have very long prompts and cap the context length.</p>}
        staff={<>
          <p>TTFT = queue time + prefill time. “GPU utilization fine” says nothing about <strong>KV-cache headroom</strong>, which is the real admission limit. I would break TTFT down per stage:</p>
          <ul>
            <li><strong>Queueing</strong>: if requests wait for free KV blocks, the fleet is memory-bound. Look at max_tokens reservations, long-context users, and preemption rates.</li>
            <li><strong>Prefill interference</strong>: long prompts in mixed prefill/decode batches stall everyone. Fix with chunked prefill or disaggregated pools.</li>
            <li><strong>Routing</strong>: a prefix-affinity hot spot overloads a few replicas. Check per-replica queue skew and switch to bounded-load hashing.</li>
          </ul>
          <p>Then fix structurally: autoscale on queue depth and KV use, separate interactive from batch tiers, and shed early with 429s rather than silently queueing.</p>
        </>}
        followUps={['How would you set per-tier SLOs and enforce them?', 'When is disaggregating prefill and decode worth the complexity?', 'How do you price cached input tokens?']}
      />
      <InterviewQuestion
        q="How do you serve 500 customer fine-tunes of the same 8B model without 500 GPU pools?"
        senior={<p>Deploy each fine-tune on shared GPUs and load them on demand, evicting unused ones.</p>}
        staff={<>
          <p>Use <strong>parameter-efficient adapters (LoRA)</strong> over one shared base model. Adapter weights are small, so many fit in GPU memory next to the base, and requests for different adapters can be batched together with kernels designed for mixed-adapter batches.</p>
          <p>The system work: an adapter registry with versioning, LRU caching of adapters in HBM and host memory, routing affinity (the same adapter goes to replicas where it is already warm), and per-adapter quotas so one noisy customer can’t evict everyone else’s adapters. Full fine-tunes that change base weights need their own replicas; price them accordingly.</p>
        </>}
      />

      <KeyTakeaways items={[
        'Two metrics: TTFT (queue + prefill) and TPOT (decode). Design and alert on both.',
        'Decode is memory-bandwidth-bound, so continuous batching is where throughput comes from.',
        'The KV cache, not FLOPs, limits concurrency: 2 × layers × kv_heads × head_dim × bytes per token.',
        'Schedule on queue depth, KV headroom and prefix affinity; autoscale ahead of multi-minute cold starts.',
        'Frame everything as cost per million tokens at a latency SLO; streaming makes retries a product decision.',
      ]} />
    </>
  )
}
