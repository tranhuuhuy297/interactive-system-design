import {
  Callout, Chips, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, LayerStack, MentalModel,
  References, SideBySide, StatRow, Term, TLDR,
} from '../components/ui'
import { CheckCircle2, Cpu, HardDrive, MemoryStick, XCircle } from 'lucide-react'
import type { Reference } from '../components/ui'
import { AiKvPagingDemo } from './demos/ai-kv-paging-demo'

const REFS: Reference[] = [
  { title: 'Efficient Memory Management for LLM Serving with PagedAttention', source: 'Kwon et al. (vLLM)', year: 2023, url: 'https://arxiv.org/abs/2309.06180', kind: 'paper', note: 'Paged KV cache; 2–4× throughput vs prior systems' },
  { title: 'Fast Transformer Decoding: One Write-Head is All You Need', source: 'N. Shazeer', year: 2019, url: 'https://arxiv.org/abs/1911.02150', kind: 'paper', note: 'Multi-query attention' },
  { title: 'GQA: Training Generalized Multi-Query Transformer Models', source: 'Ainslie et al.', year: 2023, url: 'https://arxiv.org/abs/2305.13245', kind: 'paper' },
  { title: 'SGLang: Efficient Execution of Structured Language Model Programs', source: 'Zheng et al.', year: 2023, url: 'https://arxiv.org/abs/2312.07104', kind: 'paper', note: 'RadixAttention prefix reuse' },
  { title: 'Automatic Prefix Caching', source: 'vLLM documentation', url: 'https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html', kind: 'docs' },
  { title: 'LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale', source: 'Dettmers et al.', year: 2022, url: 'https://arxiv.org/abs/2208.07339', kind: 'paper' },
  { title: 'GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers', source: 'Frantar et al.', year: 2022, url: 'https://arxiv.org/abs/2210.17323', kind: 'paper' },
  { title: 'AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration', source: 'Lin et al.', year: 2023, url: 'https://arxiv.org/abs/2306.00978', kind: 'paper' },
  { title: 'FP8 Formats for Deep Learning', source: 'Micikevicius et al.', year: 2022, url: 'https://arxiv.org/abs/2209.05433', kind: 'paper' },
]

export default function AiKvCacheQuantizationChapter() {
  return (
    <>
      <TLDR items={[
        'The KV cache stores attention state for every token so far. It is the biggest moving part of GPU memory.',
        'Its size grows with context length × concurrent users. Weights stay fixed.',
        'GQA/MQA models share KV heads and need up to 8× less cache.',
        'Paged allocation and prefix caching fit more users and skip repeated work.',
        'Quantizing weights and KV cuts bytes per step, but gate it on your own evals.',
      ]} />
      <MentalModel id="ai-kv-cache" />
      <p>
        During decode, attention needs the key and value vectors of <em>every</em> earlier token. Recomputing them each
        step would be quadratic work. So servers keep them in GPU memory as the <strong>KV cache</strong>, like notes
        you take once so you never re-read the whole book.
      </p>
      <p>
        The KV cache is the largest dynamic memory consumer in LLM serving. It decides how many users fit on a GPU,
        how long a context you can offer, and how fast decode runs. This chapter is about how to size, share, allocate,
        and compress it.
      </p>

      <H2 id="formula">The KV cache formula</H2>
      <p>Start with the arithmetic. One formula tells you how much memory each token of context costs.</p>
      <CodeBlock lang="ts" title="KV bytes per token" code={`
kvBytesPerToken = 2              // one K and one V vector
                × layers
                × kvHeads        // not query heads: GQA/MQA shrink this
                × headDim
                × bytesPerValue  // 2 for BF16, 1 for FP8

totalKV = kvBytesPerToken × contextTokens × concurrentSequences

// 70B-class shape (80 layers, head dim 128, 8 KV heads, BF16):
// 2 × 80 × 8 × 128 × 2 = 327,680 B ≈ 320 KiB per token
// one 32K-token conversation ≈ 10 GiB of KV cache`} />
      <StatRow caption="70B-class model with GQA (8 KV heads), BF16"
        stats={[
          { value: '≈ 140 GB', label: 'weights', note: 'fixed, loaded once' },
          { value: '320 KiB', label: 'KV cache per token' },
          { value: '≈ 10 GiB', label: 'KV for one 32K-token conversation', note: 'grows with every user' },
        ]} />
      <p>
        The KV cache grows linearly with <strong>context × concurrency</strong>, while the weights stay fixed. So a GPU
        that holds a model comfortably can still run out of memory with a handful of long conversations. The{' '}
        <a href="#/llm-serving">LLM inference platform</a> case study has a full GPU memory calculator. This chapter
        covers the techniques that bend the curve.
      </p>

      <H2 id="attention-variants">MHA vs MQA vs GQA</H2>
      <p>
        The model’s attention design sets how much KV each token needs. An{' '}
        <Term def="A parallel slice of the attention computation. Models run many heads side by side.">attention head</Term>{' '}
        is one of many parallel attention computations.
      </p>
      <ul>
        <li><strong>Multi-head attention (MHA)</strong> keeps separate K/V for every head.</li>
        <li><strong>Multi-query attention (MQA)</strong> shares one K/V head across all query heads.</li>
        <li><strong>Grouped-query attention (GQA)</strong> sits between them: query heads split into groups that share K/V.</li>
      </ul>
      <p>
        The GQA paper reports quality close to MHA at speed comparable to MQA. That is why most recent open models use it.
      </p>
      <LayerStack legend="Bar = KV cache per token · same 70B-class shape (80 layers, head dim 128, BF16); only the KV head count changes"
        layers={[
          { label: 'MHA', sub: '64 KV heads', size: 1, value: '2.5 MiB/token · 80 GiB at 32K (the whole GPU)' },
          { label: 'GQA (8 groups)', sub: '8 KV heads', size: 8 / 64, value: '320 KiB/token · 10 GiB at 32K', highlight: true },
          { label: 'MQA', sub: '1 KV head', size: 1 / 64, value: '40 KiB/token · 1.25 GiB at 32K' },
        ]} />
      <Callout kind="info">
        The attention variant is fixed at training time. As a serving engineer you don’t pick it, but you should read it
        off the model config, because it can change capacity planning by 8× between two models of the same size.
      </Callout>

      <H2 id="paging">PagedAttention: allocate KV like virtual memory</H2>
      <p>
        Early servers reserved one contiguous slab per request, sized for the <em>maximum</em> possible length. Most
        requests finish far shorter. So most of each slab sat empty, and fewer requests fit at once.
      </p>
      <p>
        <Term def="vLLM’s technique of storing the KV cache in small fixed-size blocks, tracked by a per-sequence table, like OS virtual memory pages.">PagedAttention</Term>{' '}
        splits the cache into fixed-size blocks and keeps a per-sequence block table, just like OS page tables. Waste
        drops to the unfilled tail of the last block, and sequences can share blocks.
      </p>
      <AiKvPagingDemo />
      <FlowDiagram steps={[
        { label: 'Block pool', sub: 'fixed-size KV pages' },
        { label: 'Block table', sub: 'logical → physical per sequence' },
        { label: 'Attention kernel', sub: 'gathers pages on the fly' },
        { label: 'Copy-on-write', sub: 'share prefixes, beams, samples' },
      ]} />

      <H2 id="prefix-caching">Prefix and prompt caching</H2>
      <p>
        Many requests start the same way: a long system prompt, a tool schema,{' '}
        <Term def="Worked examples placed in the prompt to show the model the expected format.">few-shot examples</Term>,
        a shared document. Once the KV cache is paged, identical prefixes can map to the <strong>same physical
        blocks</strong>. Their{' '}<Term def="The first pass over the prompt that builds its KV cache; compute-heavy.">prefill</Term>{' '}
        is skipped entirely.
      </p>
      <p>
        vLLM hashes blocks by content (automatic prefix caching). SGLang keeps a{' '}
        <Term def="A tree that stores strings by shared prefixes, so common beginnings are stored once.">radix tree</Term>{' '}
        of cached prefixes (RadixAttention) and schedules requests to maximize reuse.
      </p>
      <SideBySide caption="Prompt order decides whether the cache can help"
        panels={[
          { title: 'Cache-friendly', icon: CheckCircle2, tone: 'good',
            picture: <Chips items={['System prompt', '→', 'Tools', '→', 'Documents', '→', 'User turn']} />,
            points: ['+ Stable content first', '+ Identical prefix → same KV blocks', '+ Prefill only the new tail'] },
          { title: 'Cache-hostile', icon: XCircle, tone: 'bad',
            picture: <Chips items={['Timestamp', '→', 'System prompt', '→', 'Tools', '→', 'User turn']} />,
            points: ['- One changed early token', '- Invalidates everything after it', '- Full prefill every request'] },
        ]} />
      <ul>
        <li><strong>Win:</strong> lower TTFT and prefill compute for repeated context. Agents and RAG with fixed instructions benefit most.</li>
        <li><strong>Design for it:</strong> put stable content first (system prompt, tools, documents) and volatile content last (user turn, timestamps). One changed token early in the prompt invalidates everything after it.</li>
        <li><strong>Route for it:</strong> cache hits only happen on the replica that holds the prefix, so prefix-aware routing (hash the prefix to a replica) matters at fleet scale.</li>
      </ul>

      <H2 id="offload">When the cache doesn’t fit: evict, offload, recompute</H2>
      <p>Sooner or later memory runs out. You have four ways to respond, and each moves the pain somewhere else.</p>
      <LayerStack legend="Where KV blocks can live: faster at the top, bigger at the bottom"
        layers={[
          { label: 'GPU HBM', sub: 'where decode reads from', icon: MemoryStick, size: 0.3, value: '80 GB on an H100 · 3.35 TB/s', highlight: true },
          { label: 'CPU memory', sub: 'swap target over PCIe', icon: Cpu, size: 0.65, value: 'PCIe ≪ HBM bandwidth' },
          { label: 'SSD tier', sub: 'popular prefixes kept for reuse', icon: HardDrive, size: 1, value: 'largest, slowest' },
        ]} />
      <CompareTable
        columns={['How it works', 'Cost']}
        rows={[
          { label: 'Preempt & recompute', cells: ['Drop a sequence’s KV; redo prefill when it resumes', 'Wasted compute; TTFT-like stall for that user'] },
          { label: 'Swap to CPU memory', cells: ['Copy blocks over PCIe, bring back later', 'PCIe bandwidth ≪ HBM; stalls on swap-in'] },
          { label: 'Tiered cache (CPU/SSD)', cells: ['Keep popular prefixes outside HBM for reuse', 'Complexity; hit rate must justify it'] },
          { label: 'Cap context / concurrency', cells: ['Admission control keeps KV within budget', 'Queueing; users wait instead of stalling'] },
        ]}
      />

      <H2 id="quantization">Quantization: fewer bytes per weight and per KV value</H2>
      <p>
        Decode is bandwidth-bound (<a href="#/ai-inference">see fundamentals</a>). Every byte removed from the per-step
        stream turns directly into speed and capacity.{' '}
        <Term def="Storing numbers in fewer bits (e.g. 8 or 4 instead of 16), trading a little accuracy for memory and speed.">Quantization</Term>{' '}
        comes in three flavors that are often mixed:
      </p>
      <LayerStack legend="Bar = memory for 70B weights"
        caption="Quality impact is model- and task-dependent; always re-run your own evals. An FP8 KV cache separately halves KV memory, usually with small impact that matters most at long context."
        layers={[
          { label: 'BF16 / FP16', sub: 'baseline · reference quality', size: 1, value: '≈ 140 GB' },
          { label: 'FP8 / INT8 (W8A8)', sub: 'weights + activations · usually small impact', size: 0.5, value: '≈ 70 GB', highlight: true },
          { label: 'INT4 weight-only (GPTQ, AWQ)', sub: 'noticeable on some tasks, strong on others', size: 0.25, value: '≈ 35 GB + scales' },
        ]} />
      <ul>
        <li><strong>Outliers</strong> are the core difficulty: a few{' '}<Term def="The intermediate values flowing between layers while the model runs, as opposed to the stored weights.">activation</Term>{' '}channels have huge magnitudes. LLM.int8() handles them in higher precision. AWQ protects the weights that matter most to activations. GPTQ uses second-order information to minimize layer-wise error.</li>
        <li><strong>Weight-only 4-bit</strong> helps the memory-bound decode phase most. Compute-bound prefill gains less unless kernels also run low-precision math.</li>
        <li><strong>Evaluate, don’t assume:</strong> quantization errors hide in long-tail tasks (math, code, non-English). Gate rollouts on task evals, not perplexity alone.</li>
      </ul>

      <Callout kind="staff">
        <ul>
          <li><strong>Plan capacity in KV tokens, not requests.</strong> Budget = (GPU memory − weights − activations) ÷ KV bytes per token. Admission control and autoscaling should read KV utilization directly.</li>
          <li><strong>Make prompts cache-friendly.</strong> Stable prefix first, then prefix-aware routing. This is often the cheapest TTFT and cost win on the table.</li>
          <li><strong>Treat quantization as a product decision.</strong> Offer it per tier (fast/cheap vs max-quality) with eval gates, instead of a silent fleet-wide switch.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Your GPUs show 40% compute utilization but the server rejects new requests with “KV cache full”. Explain and fix."
        senior={<p>The KV cache is taking all the memory. Add GPUs, reduce max context length, or enable paged attention to reduce fragmentation.</p>}
        staff={<>
          <p>That is expected for decode: the binding resource is KV memory, not FLOPs, so compute utilization is the wrong health metric. Steps:</p>
          <ul>
            <li>Measure the actual context-length distribution vs the reservation. If the engine over-reserves, paging reclaims most of it.</li>
            <li>Shrink per-token KV: FP8 KV cache, and prefer GQA models for new deployments.</li>
            <li>Reuse shared prefixes (system prompts, tools) with prefix caching plus prefix-aware routing.</li>
            <li>Separate long-context traffic into its own pool so a few 100K-token sessions don’t starve chat.</li>
          </ul>
          <p>Finally, autoscale and alert on KV utilization and queue time, not GPU utilization.</p>
        </>}
        followUps={['How would you choose the page (block) size?', 'What breaks prefix caching in practice?']}
      />
      <InterviewQuestion
        q="Should we serve our 70B model in INT4 to cut cost in half?"
        senior={<p>INT4 uses a quarter of the memory of BF16, so we can use fewer GPUs. Quality might drop a bit, so we should test it.</p>}
        staff={<>
          <p>Maybe, but measure three things first. <strong>Quality</strong>: run our task evals (not just perplexity), with extra weight on long-tail tasks. <strong>Speed</strong>: weight-only INT4 mainly helps decode; if our traffic is prefill-heavy (long RAG prompts), the gain is smaller. <strong>Cost</strong>: fewer GPUs per replica also changes the tensor-parallel layout and communication.</p>
          <p>A common outcome is FP8 as the default tier (near-lossless on supported hardware) and INT4 for a cheaper tier or smaller distilled models, each gated by evals.</p>
        </>}
        followUps={['How would you detect a quality regression after rollout?', 'Does quantizing the KV cache interact with prefix caching?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'KV bytes per token = 2 × layers × KV heads × head dim × bytes; total grows with context × concurrency.',
        'GQA/MQA shrink KV by sharing heads; the choice is baked into the model, so read it from the config.',
        'Paged KV allocation removes over-reservation waste and enables sharing, fitting far more sequences.',
        'Prefix caching skips prefill for shared prompts; design prompts and routing to hit it.',
        'Quantize weights and KV to cut bytes per step, gated by task evals rather than perplexity.',
      ]} />
    </>
  )
}
