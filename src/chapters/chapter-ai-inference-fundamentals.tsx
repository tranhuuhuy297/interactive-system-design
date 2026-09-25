import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, References, Term, TLDR,
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
      <TLDR items={[
        'Every request has two phases: prefill reads the prompt, decode writes the answer one token at a time.',
        'Prefill is limited by GPU compute. Decode is limited by memory bandwidth.',
        'Per-user speed ≈ memory bandwidth ÷ bytes read per step (weights + KV cache).',
        'Batching raises total throughput cheaply, until a knee where every user gets slower.',
        'Set targets on time-to-first-token and time-per-token, then maximize throughput within them.',
      ]} />
      <p>
        Every LLM request runs in two very different phases. Almost every serving decision follows from that split.
      </p>
      <p>
        <strong><Term def="The first pass over the prompt. All prompt tokens are processed in parallel and their attention state is stored.">Prefill</Term></strong>{' '}
        reads the whole prompt in one parallel pass.{' '}
        <strong><Term def="The generation loop. Each step produces one new token per sequence, reusing stored state from earlier tokens.">Decode</Term></strong>{' '}
        then produces one token at a time. Each decode step streams the model’s weights and the conversation’s{' '}
        <Term def="Key/value cache: the attention keys and values for every token so far, kept in GPU memory so they are not recomputed each step.">KV cache</Term>{' '}
        from GPU memory.
      </p>
      <p>
        Know which phase is the bottleneck, and why. Then you can reason about latency, batching, cost, and hardware
        without memorizing any benchmark.
      </p>

      <H2 id="two-phases">Two phases, two bottlenecks</H2>
      <p>
        The two phases stress different parts of the GPU, so they need different fixes. Think of the KV cache as
        notes the model keeps so it never re-reads the whole conversation.
      </p>
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
      <p>You can’t tune what you don’t measure. These five numbers describe how an LLM endpoint feels and what it costs.</p>
      <ul>
        <li><strong>TTFT</strong> (time to first token): queueing + prefill + first decode step. It dominates how fast chat <em>feels</em>.</li>
        <li><strong>TPOT</strong> (time per output token), also measured as <strong>ITL</strong> (inter-token latency, the gap between streamed tokens). It sets reading speed. Humans read roughly 4–8 tokens/s. Past that point, faster decode stops improving how the product feels.</li>
        <li><strong>End-to-end latency</strong> ≈ TTFT + TPOT × (output tokens − 1). Long answers are decode-dominated.</li>
        <li><strong>Throughput</strong>: total tokens/s across all users. This is what drives cost per token.</li>
        <li><strong>Goodput</strong>: requests/s that <em>meet</em> both the TTFT and TPOT{' '}<Term def="Service level objective: a target such as “95% of requests get a first token within 1 second”.">SLOs</Term>. Throughput that misses the SLO is worthless for interactive products.</li>
      </ul>

      <H2 id="memory-bound">Why decode is memory-bound</H2>
      <p>
        This is the single most useful fact about LLM serving. In one decode step, each weight is read once. It is used
        for about one multiply-add <em>per sequence in the batch</em>.
      </p>
      <p>
        At batch 1 with 16-bit weights, that is ~2{' '}<Term def="Floating-point operations: multiplies and adds.">FLOPs</Term>{' '}
        per 2 bytes read. An H100 can do roughly 300 FLOPs in the time it reads one byte. So the{' '}
        <Term def="The GPU units that do matrix multiplication; most of a GPU’s compute lives here.">tensor cores</Term>{' '}
        sit idle, waiting on{' '}<Term def="High-bandwidth memory: the GPU’s main memory, where weights and the KV cache live.">HBM</Term>.
        That gives a simple lower bound:
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
        The roofline model plots attainable performance against{' '}
        <strong><Term def="How much math you do per byte moved from memory. Low intensity means memory is the bottleneck.">arithmetic intensity</Term></strong>{' '}
        (FLOPs per byte moved). Left of the ridge point, bandwidth limits you. Right of it, compute does.
      </p>
      <p>
        Grow the batch and watch the point slide right. Then grow the context and watch the KV cache drag it back left.
      </p>
      <AiInferRooflineDemo />

      <H2 id="batching">Batching buys throughput with latency</H2>
      <p>
        Batching reuses each weight read across many sequences. Aggregate throughput climbs almost for free at first.
        But each step gets slower, because it must also read every sequence’s KV cache. With the demo’s assumptions
        (8B,{' '}<Term def="A 16-bit number format common for model weights: 2 bytes per parameter.">BF16</Term>, one H100, 4K context),
        the bound moves like this:
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
        Two lessons follow. First, there is a <strong>knee</strong>. Past it, extra batch adds little throughput but
        keeps hurting every user’s TPOT.
      </p>
      <p>
        Second, at long contexts the KV cache dominates bytes per step, not the weights. That is why KV-cache
        techniques (<a href="#/ai-kv-cache">next chapter</a>) matter as much as weight tricks. How batches are formed
        each step is covered in <a href="#/ai-batching">Batching &amp; Speculative Decoding</a>.
      </p>

      <H2 id="slos">Designing SLOs for LLM endpoints</H2>
      <p>Different traffic needs different targets. Chat cares about the first token; offline jobs care about cost.</p>
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
        Separate SLO classes let one fleet serve both kinds of traffic. Interactive requests get priority and tight
        batch caps. Batch jobs soak up leftover capacity. This is the same idea as the priority tiers in the{' '}
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
