/** Simplified durability model: independent disk failures, fixed repair window. Real systems also face correlated failures. */
export type Scheme = { kind: 'replication'; copies: number } | { kind: 'ec'; k: number; m: number }

export const fragments = (s: Scheme) => (s.kind === 'replication' ? s.copies : s.k + s.m)
export const tolerance = (s: Scheme) => (s.kind === 'replication' ? s.copies - 1 : s.m)
export const overhead = (s: Scheme) => (s.kind === 'replication' ? s.copies : (s.k + s.m) / s.k)
export const minReadable = (s: Scheme) => (s.kind === 'replication' ? 1 : s.k)

function choose(n: number, r: number): number {
  let c = 1
  for (let i = 1; i <= r; i++) c = (c * (n - r + i)) / i
  return c
}

/**
 * Annual probability of losing an object: in each repair window, lose it if more than `tolerance`
 * fragments' disks fail before repair completes.
 */
export function annualLossProbability(s: Scheme, afr: number, repairHours: number): number {
  const n = fragments(s)
  const f = tolerance(s)
  const p = Math.min(1, afr * (repairHours / 8760)) // chance a given disk fails within one window
  let tail = 0
  for (let i = f + 1; i <= n; i++) tail += choose(n, i) * p ** i * (1 - p) ** (n - i)
  const windows = 8760 / repairHours
  return Math.min(1, 1 - (1 - tail) ** windows)
}

export function nines(lossProb: number): number {
  if (lossProb <= 0) return 20
  return Math.min(20, -Math.log10(lossProb))
}
