import {
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion, KeyTakeaways, References,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { AiServeCascadeDemo } from './demos/ai-serve-cascade-demo'

const REFS: Reference[] = [
  { title: 'vLLM documentation', source: 'vLLM project', url: 'https://docs.vllm.ai/', kind: 'docs' },
  { title: 'SGLang: Efficient Execution of Structured Language Model Programs', source: 'Zheng et al.', year: 2023, url: 'https://arxiv.org/abs/2312.07104', kind: 'paper', note: 'RadixAttention; up to 6.4× throughput reported' },
  { title: 'TensorRT-LLM documentation', source: 'NVIDIA', url: 'https://nvidia.github.io/TensorRT-LLM/', kind: 'docs', note: 'In-flight batching, paged KV, FP8' },
  { title: 'Text Generation Inference (maintenance-mode notice)', source: 'Hugging Face', url: 'https://huggingface.co/docs/text-generation-inference', kind: 'docs' },
  { title: 'llama.cpp', source: 'ggml-org', url: 'https://github.com/ggml-org/llama.cpp', kind: 'docs', note: 'Local inference, GGUF, Apple silicon' },
  { title: 'S-LoRA: Serving Thousands of Concurrent LoRA Adapters', source: 'Sheng et al.', year: 2023, url: 'https://arxiv.org/abs/2311.03285', kind: 'paper' },
  { title: 'Punica: Multi-Tenant LoRA Serving', source: 'Chen et al.', year: 2023, url: 'https://arxiv.org/abs/2310.18547', kind: 'paper' },
  { title: 'FrugalGPT: How to Use LLMs While Reducing Cost and Improving Performance', source: 'Chen, Zaharia & Zou', year: 2023, url: 'https://arxiv.org/abs/2305.05176', kind: 'paper', note: 'LLM cascades' },
  { title: 'RouteLLM: Learning to Route LLMs with Preference Data', source: 'Ong et al.', year: 2024, url: 'https://arxiv.org/abs/2406.18665', kind: 'paper' },
]

const NODES: ArchNode[] = [
  { id: 'client', label: 'Client', kind: 'client', x: 10, y: 50 },
  { id: 'gw', label: 'Gateway', sub: 'auth · quotas', kind: 'lb', x: 28, y: 50 },
  { id: 'router', label: 'Model router', sub: 'rules + classifier', kind: 'service', x: 48, y: 50,
    detail: 'Picks a model per request from task type, tenant tier, prompt length, and a learned difficulty score. Escalates on low-confidence answers when cascading.' },
  { id: 'small', label: 'Small model pool', sub: '8B · many LoRAs', kind: 'worker', x: 72, y: 20,
    detail: 'One base model serves many fine-tuned adapters, swapping LoRA weights per request instead of running one deployment per customer.' },
  { id: 'large', label: 'Large model pool', sub: '70B+ · TP=8', kind: 'worker', x: 72, y: 80 },
  { id: 'check', label: 'Quality check', sub: 'verifier / rules', kind: 'service', x: 90, y: 50,
    detail: 'Cheap checks such as schema validation, a verifier model, or self-reported confidence decide whether to escalate.' },
]
const EDGES: ArchEdge[] = [
  { from: 'client', to: 'gw' }, { from: 'gw', to: 'router' }, { from: 'router', to: 'small' }, { from: 'router', to: 'large' },
  { from: 'small', to: 'check' }, { from: 'check', to: 'large', label: 'escalate' },
]

export default function AiServingStacksRoutingChapter() {
  return (
    <>
      <p>
        Nobody writes an LLM server from scratch anymore. The real decisions are which engine to run, how many models
        and adapters to host, and which model each request should go to. This chapter maps the serving landscape,
        explains multi-LoRA and model cascades, and turns GPU prices into the number finance actually asks for:
        {' '}<strong>cost per million tokens</strong>.
      </p>

      <H2 id="landscape">The serving engine landscape</H2>
      <CompareTable
        columns={['Strengths', 'Watch out for']}
        caption="Fast-moving space: this reflects the projects’ own docs as of 2026. Check current docs before choosing."
        rows={[
          { label: 'vLLM', cells: ['PagedAttention, continuous batching, prefix caching, OpenAI-compatible server, broad model and hardware support', 'Tuning knobs matter; peak performance varies by model and version'] },
          { label: 'SGLang', cells: ['RadixAttention prefix reuse, fast scheduler, structured/constrained generation', 'Newer ecosystem; validate model coverage'] },
          { label: 'TensorRT-LLM', cells: ['NVIDIA-optimized kernels, in-flight batching, paged KV, FP8 on recent GPUs', 'Tied to NVIDIA hardware; heavier build and deploy workflow'] },
          { label: 'Triton Inference Server', cells: ['General model server (multi-framework), often fronting a TensorRT-LLM backend', 'A server layer, not an LLM engine by itself'] },
          { label: 'TGI (Hugging Face)', cells: ['Mature server with streaming, metrics, tracing', 'Now in maintenance mode; Hugging Face recommends vLLM or SGLang going forward'] },
          { label: 'llama.cpp / local runners', cells: ['CPU and Apple silicon, GGUF quantized models, edge and laptop use', 'Not built for high-concurrency data-center serving'] },
        ]}
      />
      <Callout kind="tip">
        Choose on measurements, not benchmarks from blog posts. Replay a sample of <em>your</em> traffic (prompt and
        output length distribution, prefix reuse, concurrency) and compare goodput at your TTFT/TPOT SLOs.
      </Callout>

      <H2 id="multi-lora">Multi-LoRA: one base model, many fine-tunes</H2>
      <p>
        LoRA adapters are small low-rank weight deltas, often a tiny fraction of the base model. Instead of one full
        deployment per customer or task, a server keeps the base weights resident and applies the right adapter per
        request, batching requests for <em>different</em> adapters in the same forward pass. S-LoRA and Punica showed
        how to do this with custom kernels and adapter paging, and it is now supported in mainstream engines.
      </p>
      <ul>
        <li><strong>Economics:</strong> hundreds of fine-tunes share one GPU pool instead of hundreds of idle deployments.</li>
        <li><strong>Limits:</strong> adapters must share the base model, and very high adapter churn adds loading latency. Keep hot adapters resident and page cold ones from CPU memory.</li>
      </ul>

      <H2 id="routing">Model routing and cascades</H2>
      <p>
        Most traffic doesn’t need the biggest model. A <strong>router</strong> guesses difficulty up front and picks a
        model. A <strong>cascade</strong> tries a cheap model first and escalates only when a check says the answer is
        not good enough. FrugalGPT reports matching the best single model’s performance at a fraction of the cost on
        its benchmarks, and RouteLLM trains routers from preference data.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={340}
        caption="A routed, cascading serving tier"
        flows={[
          { name: 'Easy request', path: ['client', 'gw', 'router', 'small', 'check'], steps: ['Request arrives', 'Gateway authenticates and applies token quotas', 'Router predicts “easy”, sends to the small pool', 'Answer passes the check and is returned'] },
          { name: 'Escalation', path: ['client', 'gw', 'router', 'small', 'check', 'large'], steps: ['Request arrives', 'Quotas applied', 'Router tries the small model first', 'Check fails (bad JSON, low confidence)', 'Escalate to the large model'] },
        ]} />
      <AiServeCascadeDemo />
      <Callout kind="warn" title="Routing has hidden costs">
        Cascades add latency on escalated requests (they pay for both models), and streamed answers are hard to take
        back once escalation is decided. Routers drift as traffic changes. Log routing decisions, sample escalations
        for review, and re-evaluate the router like any other model.
      </Callout>

      <H2 id="unit-economics">Cost per million tokens</H2>
      <EstimationTable
        assumptions={['Illustrative GPU price: $3 per GPU-hour (varies widely by provider and commitment)', '8-GPU replica sustaining 10,000 output tokens/s at the target SLO (measure yours)']}
        rows={[
          { label: 'Replica cost', math: '8 × $3/h', result: '$24/h' },
          { label: 'Tokens per hour (fully busy)', math: '10,000 × 3,600', result: '36M' },
          { label: 'Cost per 1M tokens at 100% busy', math: '$24 ÷ 36', result: '≈ $0.67' },
          { label: 'At 40% average utilization', math: '$0.67 ÷ 0.4', result: '≈ $1.67' },
        ]}
      />
      <CodeBlock lang="ts" title="the formula" code={`
costPer1MTokens = (gpuHourlyPrice × gpusPerReplica)
                / (tokensPerSecondAtSLO × 3600 × averageUtilization)
                × 1_000_000

// Levers: tokens/s at SLO (batching, quantization, speculation, prefix caching),
// utilization (autoscaling, mixing batch + interactive traffic), and price (hardware, commitments).`} />
      <p>
        Utilization is usually the largest hidden multiplier: a fleet sized for peak but idle at night pays for the
        idle hours. Mixing interactive traffic with deferrable batch jobs (see the priority tiers in the{' '}
        <a href="#/ep-chatgpt">ChatGPT episode</a>) is how large providers keep GPUs busy.
      </p>

      <H2 id="capacity">Capacity planning in one paragraph</H2>
      <p>
        Start from demand in <em>tokens</em>: peak requests/s × (average prompt tokens for prefill, average output tokens
        for decode). Benchmark one replica’s goodput at your SLOs with a realistic length mix. Replicas needed = peak
        token demand ÷ per-replica goodput, plus headroom for failures and cold starts (see{' '}
        <a href="#/ai-parallelism">Parallelism, MoE &amp; Scaling Out</a>). Then price it with the formula above and
        decide which traffic can be routed to smaller models.
      </p>

      <Callout kind="staff">
        <ul>
          <li><strong>Engine choice is reversible; the interface isn’t.</strong> Standardize on an OpenAI-compatible internal API so engines and models can be swapped behind it.</li>
          <li><strong>Route by default:</strong> small models, multi-LoRA, and cascades are the biggest cost levers after batching. Measure quality per route with evals.</li>
          <li><strong>Report cost per 1M tokens at a stated SLO and utilization.</strong> Anything else is not comparable.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="We serve 200 enterprise customers, each with its own fine-tuned 8B model. GPU costs are exploding. What would you change?"
        senior={<p>Consolidate the models onto fewer GPUs, use autoscaling to scale idle deployments to zero, and quantize the models.</p>}
        staff={<>
          <p>If the fine-tunes are (or can be retrained as) LoRA adapters on a shared base, move to <strong>multi-LoRA serving</strong>: one pool of base-model replicas, adapters loaded per request and batched together. That turns 200 mostly idle deployments into one well-utilized fleet.</p>
          <p>Around that: keep hot adapters resident and page cold ones, route large customers to reserved capacity if they have strict SLOs, and track cost per customer by tokens. For the few customers who need a full fine-tune, keep dedicated deployments but price them accordingly.</p>
        </>}
        followUps={['How do you isolate a noisy customer?', 'What if a customer’s adapter needs a different base model?']}
      />
      <InterviewQuestion
        q="Design a routing layer that cuts LLM spend by 50% without hurting quality."
        senior={<p>Classify requests by difficulty and send simple ones to a cheaper model. Use the expensive model for complex requests.</p>}
        staff={<>
          <p>First, measure: what share of traffic does the small model already handle acceptably, per task type, according to evals? That sets the ceiling on savings.</p>
          <p>Then combine cheap rules (task type, prompt length, tenant tier) with a learned router, plus a cascade for structured tasks where a verifier is cheap (e.g. JSON schema checks). Roll out behind a shadow mode that runs both paths on a sample and compares, with per-route quality dashboards and automatic fallback if quality drops. Report savings as cost per 1M tokens at equal eval scores.</p>
        </>}
        followUps={['How do you handle streaming with a cascade?', 'How do you detect router drift?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Pick engines (vLLM, SGLang, TensorRT-LLM…) by replaying your own traffic and measuring goodput at your SLOs.',
        'Multi-LoRA serving turns many idle fine-tune deployments into one shared, well-utilized fleet.',
        'Routers and cascades send most traffic to smaller models; measure quality per route with evals.',
        'Cost per 1M tokens = GPU $/hour ÷ (tokens/s at SLO × 3600 × utilization) × 10⁶.',
        'Standardize the internal API so engines and models stay swappable.',
      ]} />
    </>
  )
}
