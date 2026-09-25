// Simplified inference parallelism planner: fit weights + a KV/activation reserve,
// prefer tensor parallelism inside a node, and fall back to pipeline stages across nodes.

export interface PlanInput {
  totalParamsB: number
  activeParamsB: number
  bytesPerWeight: number
  gpuMemGB: number
  gpusPerNode: number
  /** Fraction of each GPU kept for KV cache and activations. */
  kvReserve: number
}

export interface Plan {
  weightsGB: number
  minGpus: number
  tp: number
  pp: number
  totalGpus: number
  perGpuWeightsGB: number
  perGpuKvGB: number
  crossNode: boolean
  isMoE: boolean
  warnings: string[]
}

const USABLE = 0.9 // runtime, CUDA context, fragmentation

export function planParallelism(i: PlanInput): Plan {
  const weightsGB = i.totalParamsB * i.bytesPerWeight
  const perGpuForWeights = i.gpuMemGB * USABLE * (1 - i.kvReserve)
  const minGpus = Math.max(1, Math.ceil(weightsGB / perGpuForWeights))

  let tp = 1
  while (tp < minGpus && tp < i.gpusPerNode) tp *= 2
  tp = Math.min(tp, i.gpusPerNode)
  const pp = Math.ceil(minGpus / tp)
  const totalGpus = tp * pp
  const perGpuWeightsGB = weightsGB / totalGpus
  const perGpuKvGB = Math.max(0, i.gpuMemGB * USABLE - perGpuWeightsGB)
  const isMoE = i.activeParamsB < i.totalParamsB

  const warnings: string[] = []
  if (pp > 1) warnings.push(`Pipeline spans ${pp} nodes: each token crosses ${pp - 1} network hop(s), and stages idle without enough in-flight micro-batches.`)
  if (tp >= 8) warnings.push('TP=8 uses all-reduce over NVLink every layer. Keep TP groups inside one node.')
  if (isMoE) warnings.push(`MoE: memory holds all ${i.totalParamsB}B params, but each token computes only ~${i.activeParamsB}B. Consider expert parallelism (all-to-all routing).`)
  if (perGpuKvGB < 8) warnings.push('Little memory left for KV cache per GPU: concurrency and context will be tight.')

  return { weightsGB, minGpus, tp, pp, totalGpus, perGpuWeightsGB, perGpuKvGB, crossNode: pp > 1, isMoE, warnings }
}
