/** Toy dispatch model on a street grid: pickup ETA = Manhattan distance × minutes per block. */
export interface Pt { x: number; y: number }
export interface Scenario { riders: Pt[]; drivers: Pt[] }
export interface Assignment { pairs: [number, number][]; total: number; worst: number }

export const GRID_W = 16
export const GRID_H = 10
export const MIN_PER_BLOCK = 0.5

export const eta = (a: Pt, b: Pt) => (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) * MIN_PER_BLOCK

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random scenario; drivers ≥ riders so everyone can be matched. */
export function makeScenario(seed: number, riders: number, drivers: number): Scenario {
  const rnd = mulberry32(seed)
  const used = new Set<string>()
  const pick = (): Pt => {
    for (;;) {
      const p = { x: Math.floor(rnd() * GRID_W), y: Math.floor(rnd() * GRID_H) }
      const k = `${p.x},${p.y}`
      if (!used.has(k)) { used.add(k); return p }
    }
  }
  return { riders: Array.from({ length: riders }, pick), drivers: Array.from({ length: Math.max(drivers, riders) }, pick) }
}

const summarize = (s: Scenario, pairs: [number, number][]): Assignment => {
  const etas = pairs.map(([r, d]) => eta(s.riders[r], s.drivers[d]))
  return { pairs, total: etas.reduce((a, b) => a + b, 0), worst: Math.max(0, ...etas) }
}

/** Greedy: riders served in request order, each grabs the nearest free driver. */
export function greedyMatch(s: Scenario): Assignment {
  const free = new Set(s.drivers.map((_, i) => i))
  const pairs: [number, number][] = []
  s.riders.forEach((r, ri) => {
    let best = -1
    for (const d of free) if (best < 0 || eta(r, s.drivers[d]) < eta(r, s.drivers[best])) best = d
    if (best >= 0) { free.delete(best); pairs.push([ri, best]) }
  })
  return summarize(s, pairs)
}

/** Batched: exact min-total-ETA assignment via bitmask DP (fine for ≤ 10 drivers). */
export function batchedMatch(s: Scenario): Assignment {
  const R = s.riders.length
  const D = s.drivers.length
  const size = 1 << D
  let dp = new Float64Array(size).fill(Infinity)
  dp[0] = 0
  const choice: Int8Array[] = []
  for (let r = 0; r < R; r++) {
    const next = new Float64Array(size).fill(Infinity)
    const pick = new Int8Array(size).fill(-1)
    for (let m = 0; m < size; m++) {
      if (dp[m] === Infinity) continue
      for (let d = 0; d < D; d++) {
        if (m & (1 << d)) continue
        const nm = m | (1 << d)
        const c = dp[m] + eta(s.riders[r], s.drivers[d])
        if (c < next[nm]) { next[nm] = c; pick[nm] = d }
      }
    }
    choice.push(pick)
    dp = next
  }
  let bestMask = 0
  for (let m = 0; m < size; m++) if (dp[m] < dp[bestMask]) bestMask = m
  const pairs: [number, number][] = []
  for (let r = R - 1, m = bestMask; r >= 0; r--) {
    const d = choice[r][m]
    pairs.unshift([r, d])
    m &= ~(1 << d)
  }
  return summarize(s, pairs)
}
