// Toy KV-cache allocator: contiguous per-sequence reservation vs fixed-size pages.
// Capacity and lengths are in tokens; external fragmentation is ignored for both.

export interface Cell {
  /** Sequence index owning this cell, or -1 when free. */
  seq: number
  /** True when reserved but holding no real token (wasted). */
  waste: boolean
}

export interface AllocResult {
  cells: Cell[]
  admitted: number
  usedTokens: number
  wastedTokens: number
}

/** Deterministic lengths so both allocators see the same request stream. */
export function sampleLengths(n: number, mean: number, spread: number, maxLen: number, seed: number): number[] {
  let s = seed >>> 0
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
  return Array.from({ length: n }, () => {
    const u = (rnd() + rnd() + rnd()) / 3 // roughly bell-shaped in [0, 1)
    const len = Math.round(mean * (1 + spread * (2 * u - 1) * 1.5))
    return Math.min(maxLen, Math.max(16, len))
  })
}

function paint(capacity: number, cellTokens: number, spans: { seq: number; reserved: number; used: number }[]): Cell[] {
  const cells: Cell[] = Array.from({ length: capacity / cellTokens }, () => ({ seq: -1, waste: false }))
  let at = 0
  for (const sp of spans) {
    const resCells = Math.ceil(sp.reserved / cellTokens)
    const usedCells = Math.ceil(sp.used / cellTokens)
    for (let k = 0; k < resCells && at < cells.length; k++, at++) cells[at] = { seq: sp.seq, waste: k >= usedCells }
  }
  return cells
}

export function allocateContiguous(lengths: number[], capacity: number, maxLen: number, cellTokens: number): AllocResult {
  const spans: { seq: number; reserved: number; used: number }[] = []
  let free = capacity
  for (let i = 0; i < lengths.length && free >= maxLen; i++) {
    spans.push({ seq: i, reserved: maxLen, used: lengths[i] })
    free -= maxLen
  }
  const used = spans.reduce((s, x) => s + x.used, 0)
  return { cells: paint(capacity, cellTokens, spans), admitted: spans.length, usedTokens: used, wastedTokens: spans.length * maxLen - used }
}

export function allocatePaged(lengths: number[], capacity: number, blockTokens: number, cellTokens: number): AllocResult {
  const spans: { seq: number; reserved: number; used: number }[] = []
  let free = capacity
  for (let i = 0; i < lengths.length; i++) {
    const need = Math.ceil(lengths[i] / blockTokens) * blockTokens
    if (need > free) break
    spans.push({ seq: i, reserved: need, used: lengths[i] })
    free -= need
  }
  const used = spans.reduce((s, x) => s + x.used, 0)
  const reserved = spans.reduce((s, x) => s + x.reserved, 0)
  return { cells: paint(capacity, cellTokens, spans), admitted: spans.length, usedTokens: used, wastedTokens: reserved - used }
}
