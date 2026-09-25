// GPU memory arithmetic for transformer serving. Architecture numbers are public Llama 3 configs, rounded.

export interface ModelShape { params: number; layers: number; kvHeads: number; headDim: number }

export const PRESETS: Record<string, ModelShape> = {
  '8B-class': { params: 8, layers: 32, kvHeads: 8, headDim: 128 },
  '70B-class': { params: 70, layers: 80, kvHeads: 8, headDim: 128 },
  '405B-class': { params: 405, layers: 126, kvHeads: 8, headDim: 128 },
}

export const BYTES = { fp16: 2, fp8: 1, int4: 0.5 } as const
export type Precision = keyof typeof BYTES

export interface MemoryInput extends ModelShape {
  weightPrecision: Precision
  kvPrecision: Exclude<Precision, 'int4'>
  context: number
  batch: number
  gpuGb: number
  gpus: number
}

const GB = 1e9
/** Fraction reserved for activations, CUDA graphs, fragmentation; varies by engine. */
export const OVERHEAD = 0.1

export function memory(i: MemoryInput) {
  const weights = i.params * 1e9 * BYTES[i.weightPrecision]
  const kvPerToken = 2 * i.layers * i.kvHeads * i.headDim * BYTES[i.kvPrecision] // K and V, every layer
  const kvPerSeq = kvPerToken * i.context
  const kvTotal = kvPerSeq * i.batch
  const usable = i.gpus * i.gpuGb * GB * (1 - OVERHEAD)
  const need = weights + kvTotal
  const maxSeqs = Math.max(0, Math.floor((usable - weights) / kvPerSeq))
  return {
    weightsGb: weights / GB,
    kvPerTokenKb: kvPerToken / 1024,
    kvPerSeqGb: kvPerSeq / GB,
    kvTotalGb: kvTotal / GB,
    needGb: need / GB,
    usableGb: usable / GB,
    fits: need <= usable,
    minGpus: Math.ceil(need / (i.gpuGb * GB * (1 - OVERHEAD))),
    maxSeqs,
  }
}
