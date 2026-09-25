// Roofline bound for a single decode step and for prefill. Lower bounds only: real
// kernels add attention FLOPs, launch overhead, and imperfect bandwidth utilization.

export interface GpuSpec {
  id: string
  label: string
  memGB: number
  /** HBM bandwidth, TB/s (spec sheet). */
  bwTBs: number
  /** Dense BF16 tensor TFLOPS (spec sheet, sparsity figures halved). */
  bf16Tflops: number
}

export const GPUS: GpuSpec[] = [
  { id: 'a100', label: 'A100 80GB SXM', memGB: 80, bwTBs: 2.039, bf16Tflops: 312 },
  { id: 'h100', label: 'H100 SXM', memGB: 80, bwTBs: 3.35, bf16Tflops: 989 },
  { id: 'h200', label: 'H200 SXM', memGB: 141, bwTBs: 4.8, bf16Tflops: 989 },
]

export interface ModelSpec {
  id: string
  label: string
  paramsB: number
  /** KV bytes per token at 16-bit = 2 × layers × kvHeads × headDim × 2. */
  kvBytesPerToken: number
}

export const MODELS: ModelSpec[] = [
  { id: '8b', label: '8B (32 layers, 8 KV heads)', paramsB: 8, kvBytesPerToken: 2 * 32 * 8 * 128 * 2 },
  { id: '70b', label: '70B (80 layers, 8 KV heads)', paramsB: 70, kvBytesPerToken: 2 * 80 * 8 * 128 * 2 },
]

export interface RooflineInput {
  gpu: GpuSpec
  gpus: number
  model: ModelSpec
  /** Bytes per weight: 2 = BF16/FP16, 1 = FP8/INT8. */
  weightBytes: 1 | 2
  batch: number
  context: number
  promptTokens: number
}

export interface RooflineResult {
  weightGB: number
  kvGB: number
  fits: boolean
  intensity: number
  ridge: number
  memoryBound: boolean
  stepMs: number
  perUserTokS: number
  aggregateTokS: number
  ttftMs: number
}

export function roofline(i: RooflineInput): RooflineResult {
  const params = i.model.paramsB * 1e9
  // 8-bit tensor throughput is ~2× BF16 on these parts; KV cache stays 16-bit here.
  const peakFlops = i.gpu.bf16Tflops * 1e12 * (i.weightBytes === 1 ? 2 : 1) * i.gpus
  const bw = i.gpu.bwTBs * 1e12 * i.gpus

  const weightBytes = params * i.weightBytes
  const kvBytes = i.model.kvBytesPerToken * i.context * i.batch
  const stepBytes = weightBytes + kvBytes
  const stepFlops = 2 * params * i.batch

  const tMem = stepBytes / bw
  const tCompute = stepFlops / peakFlops
  const stepS = Math.max(tMem, tCompute)
  const intensity = stepFlops / stepBytes
  const ridge = peakFlops / bw
  const prefillS = Math.max((2 * params * i.promptTokens) / peakFlops, weightBytes / bw)

  return {
    weightGB: weightBytes / 1e9,
    kvGB: kvBytes / 1e9,
    fits: weightBytes + kvBytes <= i.gpu.memGB * 1e9 * i.gpus * 0.9,
    intensity,
    ridge,
    memoryBound: intensity < ridge,
    stepMs: stepS * 1e3,
    perUserTokS: 1 / stepS,
    aggregateTokS: i.batch / stepS,
    ttftMs: prefillS * 1e3,
  }
}
