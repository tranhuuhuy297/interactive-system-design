import {
  ArchitectureDiagram, Callout, CompareTable, EstimationTable, H2, InterviewQuestion, KeyTakeaways, LayerStack, MentalModel,
  References, SideBySide, StatRow, Term, TLDR,
} from '../components/ui'
import { Copy, Cpu, Network, Rows3, Server, SplitSquareHorizontal } from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { AiParPlannerDemo } from './demos/ai-par-planner-demo'

const REFS: Reference[] = [
  { title: 'Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism', source: 'Shoeybi et al. (NVIDIA)', year: 2019, url: 'https://arxiv.org/abs/1909.08053', kind: 'paper', note: 'Tensor parallelism for transformer layers' },
  { title: 'GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism', source: 'Huang et al. (Google)', year: 2019, url: 'https://arxiv.org/abs/1811.06965', kind: 'paper' },
  { title: 'Efficiently Scaling Transformer Inference', source: 'Pope et al. (Google)', year: 2022, url: 'https://arxiv.org/abs/2211.05102', kind: 'paper', note: 'Partitioning strategies for inference' },
  { title: 'Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity', source: 'Fedus, Zoph & Shazeer', year: 2021, url: 'https://arxiv.org/abs/2101.03961', kind: 'paper' },
  { title: 'Mixtral of Experts', source: 'Jiang et al. (Mistral AI)', year: 2024, url: 'https://arxiv.org/abs/2401.04088', kind: 'paper', note: '47B total, 13B active parameters' },
  { title: 'DeepSeek-V3 Technical Report', source: 'DeepSeek-AI', year: 2024, url: 'https://arxiv.org/abs/2412.19437', kind: 'paper', note: '671B total, 37B activated per token' },
  { title: 'DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training', source: 'Rajbhandari et al. (Microsoft)', year: 2022, url: 'https://arxiv.org/abs/2201.05596', kind: 'paper' },
  { title: 'NVIDIA H100 Tensor Core GPU (specifications)', source: 'NVIDIA', url: 'https://www.nvidia.com/en-us/data-center/h100/', kind: 'docs', note: '900 GB/s NVLink' },
]

const NODES: ArchNode[] = [
  { id: 'lb', label: 'Router', sub: 'least-loaded', kind: 'lb', x: 12, y: 50 },
  { id: 'r1', label: 'Replica 1', sub: 'TP=8 · 1 node', kind: 'worker', x: 42, y: 20,
    detail: 'One full copy of the model, split with tensor parallelism across 8 NVLink-connected GPUs.' },
  { id: 'r2', label: 'Replica 2', sub: 'TP=8 · 1 node', kind: 'worker', x: 42, y: 50 },
  { id: 'r3', label: 'Replica N', sub: 'added on demand', kind: 'worker', x: 42, y: 80,
    detail: 'Autoscaled on queue time and KV utilization. Cold start is dominated by loading hundreds of GB of weights.' },
  { id: 'weights', label: 'Weight cache', sub: 'local NVMe / object store', kind: 'storage', x: 76, y: 80,
    detail: 'Keeping weights on local NVMe (or pre-staged) cuts cold start from minutes to seconds.' },
  { id: 'metrics', label: 'Autoscaler', sub: 'queue · KV util · TTFT', kind: 'service', x: 76, y: 22 },
]
const EDGES: ArchEdge[] = [
  { from: 'lb', to: 'r1' }, { from: 'lb', to: 'r2' }, { from: 'lb', to: 'r3' },
  { from: 'weights', to: 'r3', async: true }, { from: 'metrics', to: 'r3', label: 'scale out' },
]

export default function AiParallelismMoeChapter() {
  return (
    <>
      <TLDR items={[
        'Big models don’t fit on one GPU, so one “replica” is a group of GPUs splitting the work.',
        'Tensor parallelism talks inside every layer: keep it on fast NVLink within a node.',
        'Pipeline parallelism spans nodes; replicas add throughput beyond that.',
        'MoE models need memory for all experts but compute for only a few per token.',
        'Autoscale on queue time and KV usage, and plan for slow cold starts.',
      ]} />
      <MentalModel id="ai-parallelism" />
      <p>
        A 70B model in 16-bit weights is about 140 GB. The largest open models are several times that. None fit on a
        single 80 GB GPU with room left for{' '}<Term def="Per-conversation attention state kept in GPU memory during generation.">KV cache</Term>.
      </p>
      <p>
        So a serving{' '}<Term def="One complete, independently serving copy of the model, which may span several GPUs.">replica</Term>{' '}
        is really a small distributed system: a group of GPUs that split each forward pass and talk constantly. The
        split you choose sets latency, cost, and how you scale.
      </p>

      <H2 id="menu">The parallelism menu</H2>
      <p>There are five ways to split the work. Each cuts along a different axis and pays a different communication bill.</p>
      <SideBySide caption="The three splits you will use most. Expert parallelism is covered in the MoE section below."
        panels={[
          { title: 'Data (replicas)', icon: Copy, points: ['Split: nothing, full copies', 'Talk: none between replicas'], verdict: 'Scale throughput behind a router' },
          { title: 'Tensor (TP)', icon: SplitSquareHorizontal, points: ['Split: each layer’s matrices', 'Talk: all-reduce inside every layer'], verdict: 'Fit + speed up one replica, within a node' },
          { title: 'Pipeline (PP)', icon: Rows3, points: ['Split: consecutive layers into stages', 'Talk: activations passed stage to stage'], verdict: 'Fit very large models across nodes' },
        ]} />
      <p>
        Two more splits exist. <strong>Expert parallelism</strong> places MoE experts on different GPUs and routes tokens
        with an all-to-all per MoE layer. <strong>Sequence (context) parallelism</strong> splits the tokens of a very long
        prompt (100K+) across GPUs and exchanges attention blocks.
      </p>

      <H2 id="comms">Why communication decides the layout</H2>
      <p>
        Tensor parallelism splits every matrix multiply. So GPUs must combine partial results inside every transformer
        layer. Megatron-LM’s layout needs two{' '}
        <Term def="A collective operation where every GPU contributes a partial result and every GPU receives the combined sum.">all-reduces</Term>{' '}
        per layer in the forward pass.
      </p>
      <p>
        That is fine over{' '}<Term def="NVIDIA’s high-speed GPU-to-GPU link inside one server.">NVLink</Term>{' '}
        (900 GB/s per H100). It is painful over the data-center network, which is roughly an order of magnitude slower
        per GPU. Hence the rule of thumb: <strong>tensor parallel within a node, pipeline across nodes, replicas beyond
        that.</strong>
      </p>
      <LayerStack legend="Put the chattiest split on the fastest link"
        layers={[
          { label: 'Inside one node: NVLink', sub: 'tensor parallel · all-reduce every layer', icon: Cpu, size: 1, value: '900 GB/s per H100', highlight: true },
          { label: 'Across nodes: data-center network', sub: 'pipeline parallel · activations per stage', icon: Network, size: 0.4, value: '~an order of magnitude slower' },
          { label: 'Across replicas', sub: 'data parallel · no traffic between copies', icon: Server, size: 0.18, value: 'none' },
        ]} />
      <EstimationTable
        assumptions={['70B dense model, 16-bit weights (≈ 140 GB)', '8-GPU nodes, 80 GB each, ~30% kept for KV cache']}
        rows={[
          { label: 'Weights per GPU at TP=4', math: '140 GB ÷ 4', result: '35 GB' },
          { label: 'Weights per GPU at TP=8', math: '140 GB ÷ 8', result: '17.5 GB' },
          { label: 'Bandwidth pooled at TP=8 (H100)', math: '8 × 3.35 TB/s', result: '≈ 27 TB/s' },
          { label: 'Decode bound at TP=8, batch 1', math: '140 GB ÷ 27 TB/s', result: '≈ 5 ms/token (+ comms)' },
        ]}
      />
      <p>
        More GPUs per replica means more pooled bandwidth, so lower per-token latency. It also means more all-reduce
        overhead and fewer replicas for the same budget. Pick TP for the latency SLO. Then add replicas for throughput.
      </p>

      <H2 id="planner">Plan a layout</H2>
      <p>Try it: pick a model and a GPU, and see the smallest layout that fits with room for KV cache.</p>
      <AiParPlannerDemo />

      <H2 id="moe">Serving mixture-of-experts models</H2>
      <p>
        In a{' '}<Term def="A model with many specialized sub-networks (experts); a small router picks a few experts per token.">mixture-of-experts (MoE)</Term>{' '}
        model, each token goes to a few “expert”{' '}
        <Term def="The dense multi-layer block after attention in each transformer layer; most of a model’s parameters live here.">feed-forward blocks</Term>{' '}
        out of many. Think of a hospital: every patient sees two specialists, but all specialists must be on staff.
      </p>
      <p>
        Mixtral 8×7B holds 47B parameters but uses 13B per token. DeepSeek-V3 holds 671B but activates 37B per token.
        For serving: <strong>memory scales with total parameters, compute scales with active ones.</strong>
      </p>
      <StatRow caption="Memory pays for the total, compute pays only for the active parameters"
        stats={[
          { value: '47B', label: 'Mixtral 8×7B total', note: 'must sit in memory' },
          { value: '13B', label: 'Mixtral active per token', note: 'what each token computes' },
          { value: '671B', label: 'DeepSeek-V3 total' },
          { value: '37B', label: 'DeepSeek-V3 active per token' },
        ]} />
      <ul>
        <li><strong>Expert parallelism</strong> places different experts on different GPUs. Every MoE layer then does an{' '}<Term def="A collective where every GPU sends a different slice of data to every other GPU.">all-to-all</Term>: send each token to its experts’ GPUs, compute, send results back.</li>
        <li><strong>Load imbalance</strong> is the core problem. Popular experts become hot spots while others idle. Training-time balancing losses and capacity limits (as in Switch Transformers) help, but serving still sees skew by traffic type.</li>
        <li><strong>Batch size matters more:</strong> with many experts, each one sees only a slice of the batch, so small batches leave expert matmuls memory-bound and inefficient.</li>
      </ul>

      <H2 id="fleet">From one replica to a fleet</H2>
      <p>Once one replica works, throughput comes from running many and scaling them on the right signals.</p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={330}
        caption="Replicas scale throughput; each replica is itself a tensor-parallel group"
        flows={[
          { name: 'Serve', path: ['lb', 'r2'], steps: ['Router sends the request to the least-loaded replica (or the one holding its prefix cache)'] },
          { name: 'Scale out', path: ['metrics', 'r3', 'weights'], steps: ['Autoscaler sees queue time rising and starts a replica', 'The new replica loads weights before it can serve'] },
        ]} />
      <CompareTable
        columns={['Signal', 'Why']}
        rows={[
          { label: 'Queue time / TTFT', cells: ['Leading indicator of SLO breach', 'Directly tied to user experience'] },
          { label: 'KV cache utilization', cells: ['Admission stops when KV is full', 'Better than GPU util for decode-heavy traffic'] },
          { label: 'GPU utilization', cells: ['Often misleading for decode', 'Memory-bound work looks “idle”'] },
        ]}
      />
      <Callout kind="warn" title="Cold starts are slow">
        A new replica must load its weights before serving: roughly 140 GB for a 16-bit 70B model. Even at several GB/s
        from local NVMe that is tens of seconds, and far longer from remote storage. Keep warm headroom, pre-stage weights
        on local disks, and scale on leading signals instead of waiting for p99 to break.
      </Callout>

      <Callout kind="staff">
        <ul>
          <li><strong>Choose TP from the latency SLO, replicas from the throughput target.</strong> Say both numbers out loud.</li>
          <li><strong>Keep the chatty dimension on the fastest link:</strong> TP inside NVLink, PP or EP across the network only when forced.</li>
          <li><strong>MoE flips the economics:</strong> cheap per-token compute but a huge memory footprint and all-to-all traffic. It pays off at high, steady load.</li>
          <li><strong>Plan for cold start</strong> as a capacity constraint: warm pools and weight caching are part of the design, not an afterthought.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How would you deploy a 405B dense model on H100 nodes (8 × 80 GB)?"
        senior={<p>405B in 16-bit is about 810 GB, so it needs more than one node. Use tensor parallelism across 8 GPUs and pipeline parallelism across nodes, or quantize to FP8 to fit on one node.</p>}
        staff={<>
          <p>At 16-bit, weights alone (~810 GB) exceed a node’s 640 GB, so it needs TP=8 inside each node and at least 2–3 pipeline stages across nodes. Every token then crosses the network between stages, and the pipeline needs several micro-batches in flight to avoid idle stages. That is acceptable for throughput, bad for latency.</p>
          <p>With FP8 weights (~405 GB) it fits in one node at TP=8 with about a third of memory left for KV cache. That removes cross-node hops entirely, and on Hopper FP8 has hardware support.</p>
          <p>I’d validate quality with task evals, then scale out with single-node replicas. If memory is still tight for long contexts, I’d look at FP8 KV cache or higher-memory GPUs before adding pipeline stages.</p>
        </>}
        followUps={['How many replicas for 5,000 requests per minute?', 'What changes for a 671B MoE model?']}
      />
      <InterviewQuestion
        q="Your MoE deployment has good average throughput but terrible p99 latency. Why might that be?"
        senior={<p>Some requests are longer or the GPUs are overloaded at peak. Add more replicas.</p>}
        staff={<>
          <p>Likely <strong>expert load imbalance</strong>. Certain prompts (e.g. code) route most tokens to a few experts, whose GPUs become stragglers, and every all-to-all waits for the slowest GPU. Per-expert token counts and per-GPU step times will show it.</p>
          <p>Mitigations: replicate hot experts, rebalance expert placement from observed routing stats, cap per-expert capacity (dropping or rerouting overflow at the cost of some quality), and make sure batches are large enough that each expert sees efficient work.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Replicas scale throughput; TP, PP, and EP split one replica when the model doesn’t fit or must go faster.',
        'Tensor parallelism all-reduces every layer: keep it inside NVLink; use pipeline stages across nodes.',
        'MoE memory scales with total parameters while compute scales with active ones; expert imbalance drives the tail.',
        'Autoscale on queue time and KV utilization, not GPU utilization.',
        'Cold start (loading weights) is a first-class capacity constraint.',
      ]} />
    </>
  )
}
