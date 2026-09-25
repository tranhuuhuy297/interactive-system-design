/** Hashing + ring helpers shared by the load-balancing and sharding demos. */

/** 32-bit FNV-1a with a murmur-style finalizer so nearby strings spread across the ring. */
export function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16
  return h >>> 0
}

/** Deterministic PRNG (mulberry32) so simulations are reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface RingPoint { pos: number; server: string }

/** Build a sorted ring with `vnodes` points per server. */
export function buildRing(servers: string[], vnodes: number): RingPoint[] {
  const pts: RingPoint[] = []
  for (const s of servers) for (let v = 0; v < vnodes; v++) pts.push({ pos: hash32(`${s}#${v}`), server: s })
  return pts.sort((a, b) => a.pos - b.pos)
}

/** First ring point clockwise from the key's hash (binary search, wraps around). */
export function ringOwner(ring: RingPoint[], keyHash: number): string {
  if (!ring.length) return ''
  let lo = 0, hi = ring.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (ring[mid].pos < keyHash) lo = mid + 1; else hi = mid }
  return ring[lo === ring.length ? 0 : lo].server
}

/** Coefficient of variation (std-dev / mean) of per-server counts, as a percentage. */
export function imbalancePct(counts: number[]): number {
  if (!counts.length) return 0
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length
  if (!mean) return 0
  const variance = counts.reduce((a, c) => a + (c - mean) ** 2, 0) / counts.length
  return (Math.sqrt(variance) / mean) * 100
}
