// Toy latency model for a 4-shard search cluster. All numbers are illustrative, chosen to show the shape.

export type Partitioning = 'doc' | 'term'

export const SHARDS = [0, 1, 2, 3]
export const BASE_MS = 20
export const SLOW_MS = 240
export const HEDGE_AFTER_MS = 40
export const MERGE_MS = 5
/** Shipping a posting list to the coordinator, per million postings. */
export const TRANSFER_MS_PER_M = 1.5

/** Term-partitioned layout: which shard owns each term's full posting list, and its size in millions. */
export const TERM_OWNER: Record<string, { shard: number; postingsM: number }> = {
  database: { shard: 2, postingsM: 40 },
  cache: { shard: 1, postingsM: 12 },
  index: { shard: 3, postingsM: 30 },
  segment: { shard: 3, postingsM: 2 },
  merge: { shard: 0, postingsM: 5 },
  replica: { shard: 2, postingsM: 3 },
}

export const QUERIES = ['cache database', 'index segment merge', 'replica']

export interface ShardWork { shard: number; touched: boolean; ms: number; note: string }
export interface FanoutResult { shards: ShardWork[]; totalMs: number; touched: number }

const shardLatency = (shard: number, slow: number | null, hedge: boolean) => {
  if (shard !== slow) return BASE_MS
  // Hedging: after a short wait, send the same request to a replica and take whichever answers first.
  return hedge ? Math.min(SLOW_MS, HEDGE_AFTER_MS + BASE_MS) : SLOW_MS
}

export function fanout(query: string, mode: Partitioning, slow: number | null, hedge: boolean): FanoutResult {
  const terms = query.split(' ')
  if (mode === 'doc') {
    // Every shard holds a slice of all documents, so every shard must answer.
    const shards = SHARDS.map((s) => ({ shard: s, touched: true, ms: shardLatency(s, slow, hedge), note: 'local top-k' }))
    return { shards, touched: 4, totalMs: Math.max(...shards.map((x) => x.ms)) + MERGE_MS }
  }
  // Term partitioning: only the owners of the query terms are asked, but they ship whole posting lists.
  const shards = SHARDS.map((s) => {
    const owned = terms.filter((t) => TERM_OWNER[t]?.shard === s)
    if (!owned.length) return { shard: s, touched: false, ms: 0, note: 'idle' }
    const transfer = owned.reduce((sum, t) => sum + TERM_OWNER[t].postingsM * TRANSFER_MS_PER_M, 0)
    return { shard: s, touched: true, ms: shardLatency(s, slow, hedge) + transfer, note: `ships ${owned.join(', ')}` }
  })
  const touched = shards.filter((x) => x.touched)
  return { shards, touched: touched.length, totalMs: Math.max(...touched.map((x) => x.ms)) + MERGE_MS }
}
