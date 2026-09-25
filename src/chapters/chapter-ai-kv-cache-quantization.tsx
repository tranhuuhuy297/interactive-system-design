import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, References,
} from '../components/ui'
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
      <p>
        During decode, attention needs the key and value vectors of <em>every</em> earlier token. Recomputing them each
        step would be quadratic work, so servers keep them in GPU memory as the <strong>KV cache</strong>. It is the
        largest dynamic memory consumer in LLM serving. How many users fit on a GPU, how long a context you can offer,
        and how fast decode runs all come down to how you size, share, allocate, and compress it.
      </p>

      <H2 id="formula">The KV cache formula</H2>
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
      <p>
        The KV cache grows linearly with <strong>context × concurrency</strong>, while the weights stay fixed. That is why
        a GPU that holds a model comfortably can still run out of memory with a handful of long conversations. The{' '}
        <a href="#/llm-serving">LLM inference platform</a> case study has a full GPU memory calculator. This chapter
        covers the techniques that bend the curve.
      </p>

      <H2 id="attention-variants">MHA vs MQA vs GQA</H2>
      <p>
        Multi-head attention (MHA) keeps separate K/V for every head. Multi-query attention (MQA) shares one K/V head
        across all query heads. Grouped-query attention (GQA) sits between them: query heads are split into groups
        that share K/V. The GQA paper reports quality close to MHA at speed comparable to MQA, which is why most recent
        open models use it.
      </p>
      <CompareTable
        columns={['KV heads', 'KV per token', '32K context, 1 sequence']}
        caption="Same 70B-class shape (80 layers, head dim 128, BF16); only the KV head count changes."
        rows={[
          { label: 'MHA', cells: ['64', '2.5 MiB', '80 GiB — the whole GPU'] },
          { label: 'GQA (8 groups)', cells: ['8', '320 KiB', '10 GiB'] },
          { label: 'MQA', cells: ['1', '40 KiB', '1.25 GiB'] },
        ]}
      />
      <Callout kind="info">
        The attention variant is fixed at training time. As a serving engineer you don’t pick it, but you should read it
        off the model config, because it can change capacity planning by 8× between two models of the same size.
      </Callout>

      <H2 id="paging">PagedAttention: allocate KV like virtual memory</H2>
      <p>
        Early servers reserved one contiguous slab per request, sized for the <em>maximum</em> possible length. Most
        requests finish far shorter, so most of each slab sat empty, and fewer requests fit at once. PagedAttention
        splits the cache into fixed-size blocks and keeps a per-sequence block table, just like OS page tables. Waste
        drops to the unfilled tail of the last block, and blocks can be shared between sequences.
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
        Many requests start the same way: a long system prompt, a tool schema, few-shot examples, a shared document.
        Once the KV cache is paged, identical prefixes can map to the <strong>same physical blocks</strong>, so their
        prefill is skipped entirely. vLLM hashes blocks by content (automatic prefix caching). SGLang keeps a radix tree
        of cached prefixes (RadixAttention) and schedules requests to maximize reuse.
      </p>
      <ul>
        <li><strong>Win:</strong> lower TTFT and prefill compute for repeated context. Agents and RAG with fixed instructions benefit most.</li>
        <li><strong>Design for it:</strong> put stable content first (system prompt, tools, documents) and volatile content last (user turn, timestamps). One changed token early in the prompt invalidates everything after it.</li>
        <li><strong>Route for it:</strong> cache hits only happen on the replica that holds the prefix, so prefix-aware routing (hash the prefix to a replica) matters at fleet scale.</li>
      </ul>

      <H2 id="offload">When the cache doesn’t fit: evict, offload, recompute</H2>
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
        Decode is bandwidth-bound (<a href="#/ai-inference">see fundamentals</a>), so every byte removed from the per-step
        stream turns directly into speed and capacity. Quantization comes in three flavors that are often mixed:
      </p>
      <CompareTable
        columns={['What shrinks', '70B weights', 'Typical quality impact*']}
        caption="*Model- and task-dependent; always re-run your own evals."
        rows={[
          { label: 'BF16 / FP16', cells: ['Baseline', '≈ 140 GB', 'Reference'] },
          { label: 'FP8 / INT8 (W8A8)', cells: ['Weights + activations', '≈ 70 GB', 'Usually small; FP8 has hardware support on recent GPUs'] },
          { label: 'INT4 weight-only (GPTQ, AWQ)', cells: ['Weights only', '≈ 35 GB + scales', 'Noticeable on some tasks; strong on others'] },
          { label: 'FP8 KV cache', cells: ['KV values', 'KV halves', 'Usually small; matters most at long context'] },
        ]}
      />
      <ul>
        <li><strong>Outliers</strong> are the core difficulty: a few activation channels have huge magnitudes. LLM.int8() handles them in higher precision. AWQ protects the weights that matter most to activations. GPTQ uses second-order information to minimize layer-wise error.</li>
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
