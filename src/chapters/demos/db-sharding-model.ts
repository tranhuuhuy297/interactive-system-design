import { buildRing, hash32, mulberry32, ringOwner } from './lb-hash-ring-math'

export type Strategy = 'range' | 'hash-mod' | 'consistent'
export type Workload = 'uniform' | 'celebrity' | 'time-series'

const KEY_SPACE = 1_000_000
const OPS = 3000

export interface Op { key: number; label: string }

/** Generate a deterministic stream of operations for a workload. */
export function generateOps(workload: Workload, saltHotKey: boolean): Op[] {
  const rng = mulberry32(workload.length * 31)
  return Array.from({ length: OPS }, (_, i) => {
    if (workload === 'time-series') {
      // Monotonic timestamps: key grows with time.
      const key = Math.floor((i / OPS) * KEY_SPACE)
      return { key, label: `ts:${key}` }
    }
    if (workload === 'celebrity' && rng() < 0.35) {
      const salt = saltHotKey ? `#${Math.floor(rng() * 8)}` : ''
      return { key: 424_242, label: `user:424242${salt}` }
    }
    const key = Math.floor(rng() * KEY_SPACE)
    return { key, label: `user:${key}` }
  })
}

export function shardOf(strategy: Strategy, op: Op, shards: number): number {
  switch (strategy) {
    case 'range': return Math.min(shards - 1, Math.floor((op.key / KEY_SPACE) * shards))
    case 'hash-mod': return hash32(op.label) % shards
    case 'consistent': {
      const ring = ringCache(shards)
      return Number(ringOwner(ring, hash32(op.label)).slice(1))
    }
  }
}

const rings = new Map<number, ReturnType<typeof buildRing>>()
function ringCache(n: number) {
  let r = rings.get(n)
  if (!r) { r = buildRing(Array.from({ length: n }, (_, i) => `s${i}`), 64); rings.set(n, r) }
  return r
}

/** Load per shard for the "current traffic" window (the last quarter of the stream). */
export function shardLoad(strategy: Strategy, ops: Op[], shards: number): number[] {
  const load = new Array(shards).fill(0)
  for (const op of ops.slice(Math.floor(ops.length * 0.75))) load[shardOf(strategy, op, shards)]++
  return load
}

/** Fraction of distinct keys that change shard when going from n to n+1 shards. */
export function movedFraction(strategy: Strategy, ops: Op[], shards: number): number {
  const seen = new Set<string>()
  let moved = 0
  for (const op of ops) {
    if (seen.has(op.label)) continue
    seen.add(op.label)
    if (shardOf(strategy, op, shards) !== shardOf(strategy, op, shards + 1)) moved++
  }
  return seen.size ? moved / seen.size : 0
}
