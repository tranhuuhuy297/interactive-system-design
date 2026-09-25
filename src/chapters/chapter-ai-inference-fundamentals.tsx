import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, References,
} from '../components/ui'
import type { Reference } from '../components/ui'
import { AiInferRooflineDemo } from './demos/ai-infer-roofline-demo'

const REFS: Reference[] = [
  { title: 'Efficiently Scaling Transformer Inference', source: 'Pope et al. (Google)', year: 2022, url: 'https://arxiv.org/abs/2211.05102', kind: 'paper', note: 'Latency/throughput/cost trade-offs, memory-bound decode' },
  { title: 'Roofline: An Insightful Visual Performance Model for Multicore Architectures', source: 'Williams, Waterman & Patterson, CACM', year: 2009, url: 'https://dl.acm.org/doi/abs/10.1145/1498765.1498785', kind: 'paper', note: 'The roofline model' },
  { title: 'Efficient Memory Management for LLM Serving with PagedAttention', source: 'Kwon et al. (vLLM)', year: 2023, url: 'https://arxiv.org/abs/2309.06180', kind: 'paper' },
  { title: 'DistServe: Disaggregating Prefill and Decoding for Goodput-optimized LLM Serving', source: 'Zhong et al.', year: 2024, url: 'https://arxiv.org/abs/2401.09670', kind: 'paper', note: 'Goodput under TTFT/TPOT SLOs' },
  { title: 'Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve', source: 'Agrawal et al.', year: 2024, url: 'https://arxiv.org/abs/2403.02310', kind: 'paper' },
  { title: 'NVIDIA H100 Tensor Core GPU (specifications)', source: 'NVIDIA', url: 'https://www.nvidia.com/en-us/data-center/h100/', kind: 'docs', note: 'Bandwidth and TFLOPS used in the demo' },
  { title: 'NVIDIA A100 Tensor Core GPU (specifications)', source: 'NVIDIA', url: 'https://www.nvidia.com/en-us/data-center/a100/', kind: 'docs' },
]

export default function AiInferenceFundamentalsChapter() {
  return (
    <>
      <p>
        Every LLM request runs in two very different phases, and almost every serving decision follows from that split.
        {' '}<strong>Prefill</strong> reads the whole prompt in one parallel pass. <strong>Decode</strong> then produces one
        token at a time, and each step has to stream the model’s weights and the conversation’s KV cache from GPU memory.
        If you know which phase is the bottleneck and why, you can reason about latency, batching, cost, and hardware
        without memorizing any benchmark.
      </p>

      <H2 id="two-phases">Two phases, two bottlenecks</H2>
      <FlowDiagram steps={[
        { label: 'Tokenize', sub: 'text → token ids' },
        { label: 'Prefill', sub: 'all prompt tokens in parallel · compute-bound' },
        { label: 'First token', sub: 'TTFT ends here' },
        { label: 'Decode loop', sub: '1 token/step · memory-bound' },
        { label: 'Stream out', sub: 'SSE / gRPC chunks' },
      ]} caption="Prefill turns the prompt into a KV cache; decode extends it one token per step" />
      <CompareTable
        columns={['Prefill', 'Decode']}
        rows={[
          { label: 'Work per pass', cells: ['All L prompt tokens at once', 'One new token per sequence'] },
          { label: 'FLOPs per weight byte', cells: ['High (≈ 2·L per 2-byte weight)', 'Tiny (≈ 1 per 2-byte weight at batch 1)'] },
          { label: 'Bottleneck', cells: ['Tensor-core compute', 'HBM bandwidth (weights + KV cache)'] },
          { label: 'User-visible metric', cells: ['Time to first token (TTFT)', 'Time per output token (TPOT)'] },
          { label: 'Helped by', cells: ['More FLOPs, prefix caching, chunking', 'Batching, quantization, more bandwidth, speculative decoding'] },
        ]}
      />

      <H2 id="metrics">The metrics that matter</H2>
      <ul>
        <li><strong>TTFT</strong> (time to first token): queueing + prefill + first decode step. It dominates how fast chat <em>feels</em>.</li>
        <li><strong>TPOT</strong> (time per output token), also measured as <strong>ITL</strong> (inter-token latency, the gap between streamed tokens). It sets reading speed. Humans read roughly 4–8 tokens/s, so beyond some point faster decode stops improving perceived UX.</li>
        <li><strong>End-to-end latency</strong> ≈ TTFT + TPOT × (output tokens − 1). Long answers are decode-dominated.</li>
        <li><strong>Throughput</strong>: total tokens/s across all users. This is what drives cost per token.</li>
        <li><strong>Goodput</strong>: requests/s that <em>meet</em> both the TTFT and TPOT SLOs. Raw throughput that blows the SLO is worthless for interactive products.</li>
      </ul>

      <H2 id="memory-bound">Why decode is memory-bound</H2>
      <p>
        In one decode step, each weight is read once and used for about one multiply-add <em>per sequence in the batch</em>.
        At batch 1 with 16-bit weights, that is ~2 FLOPs per 2 bytes read. An H100 can do roughly 300 FLOPs in the time
        it reads one byte, so the tensor cores sit idle waiting on memory. That gives a simple lower bound:
      </p>
      <CodeBlock lang="ts" title="decode step: back-of-the-envelope" code={`
// bytes streamed per decode step
bytes = params × bytesPerWeight          // weights, read once per step
      + batch × context × kvBytesPerToken // every sequence's KV cache

flops = 2 × params × batch               // matmuls (ignoring attention FLOPs)

stepTime ≥ max(bytes / memBandwidth, flops / peakFlops)
perUserTokensPerSec ≈ 1 / stepTime
aggregateTokensPerSec ≈ batch / stepTime

// 8B model, BF16 (16 GB), H100 at 3.35 TB/s, batch 1:
// 16e9 / 3.35e12 ≈ 4.8 ms per token → ≈ 200 tokens/s ceiling`} />
      <Callout kind="tip">
        This is why memory bandwidth (TB/s), not TFLOPS, is the first spec to check for interactive inference. It is
        also why 8-bit weights roughly double decode speed: half the bytes to stream per step.
      </Callout>

      <H2 id="roofline">The roofline, live</H2>
      <p>
        The roofline model plots attainable performance against <strong>arithmetic intensity</strong> (FLOPs per byte
        moved). Left of the ridge point you are limited by bandwidth; right of it, by compute. Grow the batch and watch the
        point slide right. Then grow the context and watch the KV cache drag it back left.
      </p>
      <AiInferRooflineDemo />

      <H2 id="batching">Batching buys throughput with latency</H2>
      <p>
        Batching reuses each weight read across many sequences, so aggregate throughput climbs almost for free at first.
        Each step still gets slower, though, and it also has to read every sequence’s KV cache. With the demo’s
        assumptions (8B, BF16, one H100, 4K context), the bound moves like this:
      </p>
      <CompareTable
        columns={['Step time', 'Per-user tok/s', 'Aggregate tok/s']}
        caption="Roofline lower bounds from the demo model; real systems land below these."
        rows={[
          { label: 'Batch 1', cells: ['≈ 4.9 ms', '≈ 200', '≈ 200'] },
          { label: 'Batch 8', cells: ['≈ 6.1 ms', '≈ 165', '≈ 1,300'] },
          { label: 'Batch 64', cells: ['≈ 15 ms', '≈ 67', '≈ 4,300'] },
          { label: 'Batch 256', cells: ['≈ 46 ms (KV no longer fits)', '≈ 22', '≈ 5,600'] },
        ]}
      />
      <p>
        Two lessons follow. First, there is a <strong>knee</strong>: past it, extra batch adds little throughput but
        keeps hurting every user’s TPOT. Second, at long contexts the KV cache, not the weights, dominates bytes per step.
        That is why KV-cache techniques (<a href="#/ai-kv-cache">next chapter</a>) matter as much as weight tricks. How
        batches are formed each step is covered in <a href="#/ai-batching">Batching &amp; Speculative Decoding</a>.
      </p>

      <H2 id="slos">Designing SLOs for LLM endpoints</H2>
      <CompareTable
        columns={['Interactive chat', 'Agent / tool loop', 'Offline batch']}
        rows={[
          { label: 'Primary SLO', cells: ['p95 TTFT (e.g. < 1 s)', 'End-to-end per call', 'Cost per 1M tokens'] },
          { label: 'Secondary', cells: ['p95 TPOT ≈ reading speed', 'TTFT (many sequential calls)', 'Job completion time'] },
          { label: 'Batching', cells: ['Moderate, capped by TPOT', 'Moderate', 'As large as memory allows'] },
          { label: 'Good lever', cells: ['Prefix caching, chunked prefill', 'Prefix caching of shared context', 'Big batches, cheaper GPUs, spot capacity'] },
        ]}
      />
      <p>
        Separate SLO classes let one fleet serve both kinds of traffic: interactive requests get priority and tight
        batch caps, while batch jobs soak up leftover capacity. This is the same idea as the priority tiers in the{' '}
        <a href="#/ep-chatgpt">ChatGPT episode</a> and the platform view in the <a href="#/llm-serving">LLM inference platform</a> case study.
      </p>

      <Callout kind="staff">
        <ul>
          <li><strong>Lead with the bottleneck, not the hardware.</strong> “Decode streams ~all weights plus the KV cache per step, so per-user speed is bandwidth ÷ bytes-per-step.” That one sentence frames every later trade-off.</li>
          <li><strong>Optimize goodput under SLOs</strong>, not peak tokens/s. Quote throughput only at a stated p95 TTFT and TPOT.</li>
          <li><strong>Name the knee.</strong> Pick the batch or concurrency cap from the latency–throughput curve and enforce it in the scheduler; don’t let autoscaling hide it.</li>
          <li><strong>Watch context growth.</strong> Agents and RAG push contexts up, which moves the bottleneck from weights to KV cache and silently halves capacity.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Your 70B chat model streams at 25 tokens/s per user on 4 GPUs. Product wants 2× faster. What are your options?"
        senior={<p>Use faster GPUs, quantize the model to 8-bit, reduce the batch size, or add speculative decoding. We could also try a smaller model.</p>}
        staff={<>
          <p>First, check the bound. At that speed decode is almost certainly bandwidth-bound, so the levers are fewer bytes per step, more bandwidth per sequence, or more tokens per step:</p>
          <ul>
            <li><strong>Fewer bytes:</strong> FP8 weights (about 2× on the weight term), FP8 KV cache, shorter effective context via prompt trimming or prefix reuse.</li>
            <li><strong>More bandwidth per user:</strong> lower the batch cap for this tier (costs throughput, i.e. money), or move to higher-bandwidth parts such as H200.</li>
            <li><strong>More tokens per step:</strong> speculative decoding. Its gain depends on the acceptance rate for our traffic, so measure it.</li>
          </ul>
          <p>Then I’d price each option in cost per 1M tokens against the SLO. Often the answer is a premium low-latency tier rather than making everyone faster.</p>
        </>}
        followUps={['Which of these hurt quality, and how would you detect it?', 'What changes if the median context grows from 2K to 32K tokens?']}
      />
      <InterviewQuestion
        q="Why does TTFT spike under load even though prefill is fast on an idle GPU?"
        senior={<p>Requests queue up waiting for GPU capacity. We should autoscale and add more replicas.</p>}
        staff={<>
          <p>Three effects stack. <strong>Queueing</strong>: new requests wait for an admission slot. <strong>Interference</strong>: a long prefill running in the same iteration stalls everyone’s decode, and long decodes delay new prefills. <strong>Memory pressure</strong>: when the KV cache is full, the scheduler can’t admit, or it preempts and recomputes.</p>
          <p>Mitigations: chunked prefill to cap per-step prefill work, priority admission for interactive traffic, KV headroom targets as an autoscaling signal (not just GPU utilization), and prefix caching so repeated system prompts skip prefill. At larger scale, split prefill and decode onto separate pools.</p>
        </>}
        followUps={['What metric would you autoscale on?', 'How do you keep one 100K-token prompt from hurting everyone else?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Prefill is compute-bound and sets TTFT; decode is memory-bandwidth-bound and sets TPOT.',
        'Per-user decode speed ≈ memory bandwidth ÷ bytes read per step (weights + KV cache).',
        'Batching raises throughput nearly for free until the knee, then trades each user’s latency for cost.',
        'Long contexts make the KV cache the dominant byte stream, keeping decode memory-bound even at large batch.',
        'Optimize goodput under TTFT and TPOT SLOs, not raw tokens per second.',
      ]} />
    </>
  )
}
