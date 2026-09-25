/** Toy Kafka model: keyed producers → hash partitions → one consumer group with range assignment. */

export const KEYS = ['alice', 'bob', 'carol', 'dave', 'erin'] as const
export type Key = (typeof KEYS)[number]

export interface Msg { key: Key; n: number; offset: number }
export interface Partition { log: Msg[]; committed: number }
export interface Consumer { id: string; seen: Msg[]; orderOk: boolean }

/** Stable string hash (djb2) standing in for Kafka's murmur2 partitioner. */
export function partitionFor(key: string, partitions: number): number {
  let h = 5381
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0
  return Math.abs(h) % partitions
}

/** Range-style assignment: contiguous partition blocks; extra consumers sit idle. */
export function assign(partitions: number, consumerIds: string[]): Record<number, string | undefined> {
  const out: Record<number, string | undefined> = {}
  const n = consumerIds.length
  if (!n) { for (let p = 0; p < partitions; p++) out[p] = undefined; return out }
  const per = Math.floor(partitions / n)
  const extra = partitions % n
  let p = 0
  consumerIds.forEach((c, i) => {
    const count = per + (i < extra ? 1 : 0)
    for (let k = 0; k < count; k++) out[p++] = c
  })
  return out
}

export function makeState(partitions: number) {
  return {
    parts: Array.from({ length: partitions }, (): Partition => ({ log: [], committed: 0 })),
    perKey: Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<Key, number>,
  }
}
