/** Instagram-style 64-bit IDs: 41 bits of ms since a custom epoch | 13 bits logical shard | 10 bits sequence. */

export const TIME_BITS = 41
export const SHARD_BITS = 13
export const SEQ_BITS = 10
export const LOGICAL_SHARDS = 1 << SHARD_BITS // 8192
export const SEQ_MOD = 1 << SEQ_BITS // 1024
/** A custom epoch in 2011; any fixed past instant works, it just maximizes the usable time range. */
export const EPOCH_MS = 1314220021721

const SHIFT_TIME = BigInt(SHARD_BITS + SEQ_BITS)
const SHIFT_SHARD = BigInt(SEQ_BITS)

export function makeId(nowMs: number, shard: number, seq: number): bigint {
  return (BigInt(nowMs - EPOCH_MS) << SHIFT_TIME) | (BigInt(shard) << SHIFT_SHARD) | BigInt(seq % SEQ_MOD)
}

export function decodeId(id: bigint) {
  return {
    ms: Number(id >> SHIFT_TIME) + EPOCH_MS,
    shard: Number((id >> SHIFT_SHARD) & BigInt(LOGICAL_SHARDS - 1)),
    seq: Number(id & BigInt(SEQ_MOD - 1)),
  }
}

/** Posts live on the author's shard so one user's data is co-located. */
export const shardForUser = (userId: number) => ((Math.floor(userId) % LOGICAL_SHARDS) + LOGICAL_SHARDS) % LOGICAL_SHARDS

/** Contiguous ranges of logical shards per physical host (moving a range never re-keys rows). */
export const hostForShard = (shard: number, hosts: number) => Math.floor((shard * hosts) / LOGICAL_SHARDS)

export function toBits(id: bigint) {
  const s = id.toString(2).padStart(64, '0')
  return { time: s.slice(0, TIME_BITS), shard: s.slice(TIME_BITS, TIME_BITS + SHARD_BITS), seq: s.slice(TIME_BITS + SHARD_BITS) }
}

/** Generates `count` IDs on one shard within the same millisecond; returns how many collide. */
export function burstDuplicates(nowMs: number, shard: number, startSeq: number, count: number) {
  const seen = new Set<bigint>()
  let dupes = 0
  for (let i = 0; i < count; i++) {
    const id = makeId(nowMs, shard, startSeq + i)
    if (seen.has(id)) dupes++
    else seen.add(id)
  }
  return dupes
}
