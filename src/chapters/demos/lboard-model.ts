/** Toy sorted set with Redis-like semantics (ties broken by member name, like Redis lexicographic order). */
export type Scores = Record<string, number>

const NAMES = ['ava', 'ben', 'cy', 'dia', 'eli', 'fay', 'gus', 'hana', 'ivo', 'jin', 'kai', 'lea', 'mo', 'nia', 'oz',
  'pia', 'quin', 'rae', 'sol', 'tao', 'uma', 'vic', 'wes', 'xia', 'yan', 'zed', 'you']

/** Deterministic PRNG so the demo looks the same on every load. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedScores(): Scores {
  const r = mulberry32(42)
  return Object.fromEntries(NAMES.map((n) => [n, Math.floor(r() * 400)]))
}

/** Descending by score; equal scores ordered by member desc, as ZREVRANGE does. */
export function zrevrange(s: Scores, start: number, stop: number): [string, number][] {
  return Object.entries(s)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))
    .slice(start, stop + 1)
}

export function zrevrank(s: Scores, member: string): number {
  return zrevrange(s, 0, Infinity).findIndex(([m]) => m === member)
}

export function zincrby(s: Scores, member: string, by: number): Scores {
  return { ...s, [member]: (s[member] ?? 0) + by }
}

export type ShardMode = 'hash' | 'range'
export const SHARDS = 3
const RANGE_BOUNDS = [300, 150] // shard 0: ≥300, shard 1: 150–299, shard 2: <150

function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

export function shardOf(mode: ShardMode, member: string, score: number): number {
  if (mode === 'hash') return hash(member) % SHARDS
  return score >= RANGE_BOUNDS[0] ? 0 : score >= RANGE_BOUNDS[1] ? 1 : 2
}

export const RANGE_LABELS = ['score ≥ 300', '150–299', '< 150']

/** How many shards a top-10 query must touch, and how many rows it pulls. */
export function top10Cost(mode: ShardMode, s: Scores) {
  if (mode === 'hash') return { shards: SHARDS, rows: SHARDS * 10, note: 'scatter-gather: top 10 from every shard, merge' }
  const counts = [0, 0, 0]
  for (const [m, v] of Object.entries(s)) counts[shardOf('range', m, v)] += 1
  let need = 10; let touched = 0
  for (const c of counts) { if (need <= 0) break; touched += 1; need -= c }
  return { shards: touched, rows: 10, note: 'walk shards from the highest range until 10 rows' }
}
