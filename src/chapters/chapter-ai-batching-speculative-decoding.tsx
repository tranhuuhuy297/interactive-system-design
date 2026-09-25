import {
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, H2, InterviewQuestion, KeyTakeaways, References,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { AiBatchSpeculativeDemo } from './demos/ai-batch-speculative-demo'

const REFS: Reference[] = [
  { title: 'Orca: A Distributed Serving System for Transformer-Based Generative Models', source: 'Yu et al., OSDI', year: 2022, url: 'https://www.usenix.org/conference/osdi22/presentation/yu', kind: 'paper', note: 'Iteration-level scheduling, selective batching' },
  { title: 'SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills', source: 'Agrawal et al.', year: 2023, url: 'https://arxiv.org/abs/2308.16369', kind: 'paper' },
  { title: 'Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve', source: 'Agrawal et al.', year: 2024, url: 'https://arxiv.org/abs/2403.02310', kind: 'paper' },
  { title: 'DistServe: Disaggregating Prefill and Decoding for Goodput-optimized LLM Serving', source: 'Zhong et al.', year: 2024, url: 'https://arxiv.org/abs/2401.09670', kind: 'paper' },
  { title: 'Fast Inference from Transformers via Speculative Decoding', source: 'Leviathan, Kalman & Matias', year: 2023, url: 'https://arxiv.org/abs/2211.17192', kind: 'paper', note: 'Expected-tokens and speedup formulas used in the demo' },
  { title: 'Accelerating Large Language Model Decoding with Speculative Sampling', source: 'Chen et al. (DeepMind)', year: 2023, url: 'https://arxiv.org/abs/2302.01318', kind: 'paper' },
  { title: 'Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads', source: 'Cai et al.', year: 2024, url: 'https://arxiv.org/abs/2401.10774', kind: 'paper' },
  { title: 'EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty', source: 'Li et al.', year: 2024, url: 'https://arxiv.org/abs/2401.15077', kind: 'paper' },
]

const NODES: ArchNode[] = [
  { id: 'client', label: 'Clients', kind: 'client', x: 10, y: 50 },
  { id: 'router', label: 'Router', sub: 'prefix-aware', kind: 'lb', x: 30, y: 50,
    detail: 'Sends each new request to a prefill worker, preferring one that already caches its prefix.' },
  { id: 'prefill', label: 'Prefill pool', sub: 'compute-heavy', kind: 'worker', x: 52, y: 22,
    detail: 'Runs prompts in large, compute-bound passes. Sized and batched for TTFT.' },
  { id: 'kv', label: 'KV transfer', sub: 'NVLink / RDMA', kind: 'queue', x: 70, y: 50,
    detail: 'Moves the finished KV cache from the prefill GPU to a decode GPU. Must be fast relative to TPOT, or the split costs more than it saves.' },
  { id: 'decode', label: 'Decode pool', sub: 'bandwidth-heavy', kind: 'worker', x: 52, y: 78,
    detail: 'Runs many sequences in continuous batches, sized and capped for TPOT.' },
  { id: 'out', label: 'Token stream', kind: 'service', x: 88, y: 78 },
]
const EDGES: ArchEdge[] = [
  { from: 'client', to: 'router' }, { from: 'router', to: 'prefill' }, { from: 'prefill', to: 'kv' },
  { from: 'kv', to: 'decode' }, { from: 'decode', to: 'out' },
]

export default function AiBatchingSpeculativeChapter() {
  return (
    <>
      <p>
        One LLM replica serves many users at once, and its scheduler decides, every few milliseconds, which sequences
        run in the next forward pass. That scheduler is where most of the throughput is won and most of the tail
        latency is lost. This chapter covers how batches are formed, how to stop prefill and decode from hurting each
        other, and how speculative decoding produces more than one token per expensive step.
      </p>

      <H2 id="batching-kinds">Static, dynamic, and continuous batching</H2>
      <CompareTable
        columns={['How it works', 'Problem']}
        rows={[
          { label: 'Static', cells: ['Wait for N requests, run them together until all finish', 'Short answers wait for the longest; slots sit idle'] },
          { label: 'Dynamic (request-level)', cells: ['Start a batch after N requests or a timeout', 'Still finishes the whole batch before admitting new work'] },
          { label: 'Continuous (iteration-level)', cells: ['Re-form the batch every decode step: finished sequences leave, queued ones join', 'Needs paged KV memory and a smarter scheduler'] },
        ]}
      />
      <p>
        Continuous batching was introduced by Orca as <strong>iteration-level scheduling</strong>: the engine runs a
        single model iteration on the batch, then the scheduler decides again. It is now standard in vLLM, SGLang,
        TensorRT-LLM (“in-flight batching”), and others. The slot-by-slot simulation lives in the{' '}
        <a href="#/llm-serving">LLM inference platform</a> case study.
      </p>

      <H2 id="interference">Prefill–decode interference and chunked prefill</H2>
      <p>
        A new 8K-token prompt admitted into a running batch makes that iteration much longer. Every user mid-answer
        sees a stutter: a TPOT spike. The fix is <strong>chunked prefill</strong>. Split long prompts into fixed-size
        chunks and mix one chunk with the ongoing decodes each iteration, so every step has a bounded amount of work.
        Sarathi calls this piggybacking decodes onto prefill chunks.
      </p>
      <CodeBlock lang="ts" title="one scheduler iteration (simplified)" code={`
const TOKEN_BUDGET = 2048                   // max tokens processed per forward pass

function nextBatch(running: Seq[], waiting: Seq[]): Work[] {
  const work: Work[] = running.map((s) => ({ seq: s, tokens: 1 }))  // decodes first: protect TPOT
  let budget = TOKEN_BUDGET - work.length

  for (const s of waiting) {                // then admit prefill chunks
    if (!kvPool.canFit(s) || budget <= 0) break
    const chunk = Math.min(budget, s.remainingPrompt)
    work.push({ seq: s, tokens: chunk })    // a long prompt spans several iterations
    budget -= chunk
  }
  return work
}`} />

      <H2 id="disaggregation">Disaggregation: separate prefill and decode pools</H2>
      <p>
        At larger scale you can go further and run prefill and decode on <strong>different GPUs</strong>. Each pool gets its
        own batch sizes, parallelism, even hardware type. DistServe frames the goal as <em>goodput</em>: requests per second
        that meet both the TTFT and TPOT SLOs. The price is moving the KV cache between pools, which needs a fast
        interconnect.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={340}
        caption="Disaggregated serving: prefill and decode scale independently"
        flows={[{ name: 'Request', path: ['client', 'router', 'prefill', 'kv', 'decode', 'out'], steps: [
          'Client sends a prompt', 'Router picks a prefill worker (prefix-cache aware)', 'Prefill computes the KV cache',
          'KV cache is shipped to a decode worker', 'Decode streams tokens back'] }]} />

      <H2 id="scheduling">Scheduling policy: who runs next?</H2>
      <ul>
        <li><strong>FCFS</strong> is simple and fair in arrival order, but one huge prompt blocks everyone behind it (head-of-line blocking).</li>
        <li><strong>Priority tiers</strong>: interactive before batch, paid before free. Pair them with admission caps so low tiers still make progress.</li>
        <li><strong>Fairness per tenant</strong>: budget tokens per tenant per window so one customer can’t monopolize a replica.</li>
        <li><strong>Preemption</strong>: when KV memory runs out, pause the lowest-priority sequence (swap its KV to CPU or recompute later). Preempting too often wastes more than it saves.</li>
      </ul>

      <H2 id="speculative">Speculative decoding: more than one token per step</H2>
      <p>
        Decode is memory-bound, so the target model has spare compute during each step. Speculative decoding spends it:
        a cheap <strong>draft</strong> proposes γ tokens, and the target model <strong>verifies</strong> all of them in one
        forward pass. Accepted tokens come for free, and at the first rejection the target supplies the right token
        itself. The accept/reject rule preserves the target model’s output distribution, so quality is unchanged. Chen et
        al. report 2–2.5× on a 70B model in a distributed setup.
      </p>
      <AiBatchSpeculativeDemo />
      <CodeBlock lang="ts" title="the two formulas to know (i.i.d. acceptance)" code={`
// α = per-token acceptance rate, γ = draft length, c = draft cost ÷ target cost
expectedTokensPerTargetCall = (1 - α ** (γ + 1)) / (1 - α)
expectedSpeedup = expectedTokensPerTargetCall / (γ * c + 1)

// α = 0.8, γ = 4, c = 0.05  →  3.36 tokens per call, ≈ 2.8× faster`} />
      <CompareTable
        columns={['Draft source', 'Trade-off']}
        rows={[
          { label: 'Separate small model', cells: ['Same family, e.g. a 1B drafting for a 70B', 'Extra memory and ops; α depends on how well the two agree'] },
          { label: 'Extra heads (Medusa)', cells: ['Heads on the target predict several future tokens; tree verification', 'Needs fine-tuning heads; reported 2.2–3.6× in the paper'] },
          { label: 'Feature-level draft (EAGLE)', cells: ['Drafts from the target’s hidden features', 'Higher acceptance; model-specific training'] },
          { label: 'Prompt lookup / n-gram', cells: ['Copy spans from the prompt (great for edits, RAG)', 'Free, but only helps when output repeats input'] },
        ]}
      />
      <Callout kind="warn" title="When speculation stops paying">
        Gains are largest at small batch, where decode is most memory-bound. At high batch the GPU is busier, so
        verifying rejected drafts wastes real compute and the speedup shrinks or even reverses. Engines typically
        turn speculation down or off under heavy load. Measure α on <em>your</em> traffic: code and structured output
        often speculate well, creative text less so.
      </Callout>

      <Callout kind="staff">
        <ul>
          <li><strong>The scheduler is the product.</strong> Token budgets per iteration, chunked prefill, and priority admission shape p99 TPOT more than raw GPU speed.</li>
          <li><strong>Choose metrics that match the SLO:</strong> goodput at stated TTFT/TPOT targets, and time in queue as the autoscaling signal.</li>
          <li><strong>Treat speculation as adaptive,</strong> tuned by load and measured acceptance rate, not a static flag.</li>
          <li><strong>Disaggregate only when justified:</strong> it pays at scale with mixed prompt lengths and a fast interconnect; below that, chunked prefill gets most of the benefit with far less complexity.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Users complain answers “stutter” mid-stream whenever someone pastes a huge document. What’s happening?"
        senior={<p>The large prompt is using the GPU and slowing down other requests. We can limit prompt size or add more replicas.</p>}
        staff={<>
          <p>That is prefill–decode interference: the long prefill lands in the same iteration as everyone’s decode step, so that step takes far longer than usual and every stream pauses.</p>
          <ul>
            <li><strong>Now:</strong> enable chunked prefill with a per-iteration token budget, so no single step carries more than a bounded amount of prefill.</li>
            <li><strong>Routing:</strong> send very long prompts to a separate long-context pool.</li>
            <li><strong>At scale:</strong> disaggregate prefill and decode.</li>
          </ul>
          <p>I’d confirm with per-iteration timing and p99 inter-token latency, correlated with admitted prompt lengths.</p>
        </>}
        followUps={['How do you pick the chunk size?', 'What does disaggregation cost you?']}
      />
      <InterviewQuestion
        q="Should we turn on speculative decoding for our API?"
        senior={<p>Yes. It speeds up generation by 2–3× without changing output quality, because the target model verifies every token.</p>}
        staff={<>
          <p>Probably for some traffic, but conditionally. The expected gain is (1 − α^(γ+1)) / ((1 − α)(γc + 1)), so it depends on the acceptance rate α we actually see, the draft cost, and load.</p>
          <p>I’d measure α per workload (code vs chat vs RAG) in shadow mode, pick γ per workload, and enable it dynamically at low-to-medium load where decode is most memory-bound. The draft model’s memory also reduces KV capacity, so I’d check the net effect on goodput, not just single-stream speed.</p>
        </>}
        followUps={['Why doesn’t speculation change the output distribution?', 'What happens to speedup at batch size 256?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Continuous (iteration-level) batching re-forms the batch every step and is the modern default.',
        'Chunked prefill bounds per-step work so long prompts don’t stall everyone’s decode.',
        'Disaggregating prefill and decode optimizes goodput at scale, at the cost of moving the KV cache.',
        'Speculative decoding yields (1 − α^(γ+1))/(1 − α) tokens per target call with unchanged outputs.',
        'Speculation helps most at low load; tune γ from measured acceptance and back off under heavy batching.',
      ]} />
    </>
  )
}
