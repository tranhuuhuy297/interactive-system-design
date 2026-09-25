import { hash32 } from './lb-hash-ring-math'

/** Tiny LSM tree: memtable → immutable L0 SSTables → one compacted L1 run. */
export const MEMTABLE_CAP = 4
export const L0_COMPACT_AT = 3
const BLOOM_BITS = 24

export type Val = string | null // null = tombstone

export interface SSTable { id: number; entries: [string, Val][]; bloom: boolean[] }

export interface Lsm {
  memtable: Map<string, Val>
  l0: SSTable[]          // newest first
  l1: SSTable | null
  nextId: number
  userWrites: number
  diskWrites: number     // entries written to disk (flush + compaction)
  log: string[]
}

export const emptyLsm = (): Lsm => ({ memtable: new Map(), l0: [], l1: null, nextId: 1, userWrites: 0, diskWrites: 0, log: [] })

const bloomIdx = (k: string) => [hash32(`a${k}`) % BLOOM_BITS, hash32(`b${k}`) % BLOOM_BITS]

function makeTable(id: number, entries: [string, Val][]): SSTable {
  const bloom = new Array(BLOOM_BITS).fill(false)
  for (const [k] of entries) for (const i of bloomIdx(k)) bloom[i] = true
  return { id, entries, bloom }
}

export function mayContain(t: SSTable, key: string) { return bloomIdx(key).every((i) => t.bloom[i]) }

function clone(s: Lsm): Lsm { return { ...s, memtable: new Map(s.memtable), l0: [...s.l0], log: [...s.log] } }

export function put(prev: Lsm, key: string, val: Val): Lsm {
  let s = clone(prev)
  s.memtable.set(key, val)
  s.userWrites++
  s.log.unshift(val === null ? `DELETE ${key} → tombstone in memtable` : `PUT ${key}=${val} → memtable`)
  if (s.memtable.size >= MEMTABLE_CAP) s = flush(s)
  if (s.l0.length >= L0_COMPACT_AT) s = compact(s)
  s.log = s.log.slice(0, 8)
  return s
}

function flush(s: Lsm): Lsm {
  const entries = [...s.memtable.entries()].sort(([a], [b]) => a.localeCompare(b))
  s.l0 = [makeTable(s.nextId++, entries), ...s.l0]
  s.diskWrites += entries.length
  s.memtable = new Map()
  s.log.unshift(`Flush memtable → SSTable #${s.l0[0].id} (L0, sorted, immutable)`)
  return s
}

function compact(s: Lsm): Lsm {
  // Oldest first so newer values overwrite older ones.
  const merged = new Map<string, Val>()
  for (const [k, v] of s.l1?.entries ?? []) merged.set(k, v)
  for (const t of [...s.l0].reverse()) for (const [k, v] of t.entries) merged.set(k, v)
  // Bottom level: tombstones can be dropped now that nothing older remains.
  const entries = [...merged.entries()].filter(([, v]) => v !== null).sort(([a], [b]) => a.localeCompare(b))
  const inputs = s.l0.map((t) => `#${t.id}`).join(', ') + (s.l1 ? `, L1 #${s.l1.id}` : '')
  s.l1 = makeTable(s.nextId++, entries)
  s.diskWrites += entries.length
  s.l0 = []
  s.log.unshift(`Compaction merged ${inputs} → L1 #${s.l1.id} (${entries.length} live keys)`)
  return s
}

export interface ReadStep { where: string; outcome: 'hit' | 'miss' | 'skip' | 'false-positive' | 'tombstone' }

export function get(s: Lsm, key: string): { value: Val | undefined; steps: ReadStep[] } {
  const steps: ReadStep[] = []
  if (s.memtable.has(key)) {
    const v = s.memtable.get(key)!
    steps.push({ where: 'memtable', outcome: v === null ? 'tombstone' : 'hit' })
    return { value: v, steps }
  }
  steps.push({ where: 'memtable', outcome: 'miss' })
  const tables = [...s.l0.map((t) => ({ t, name: `L0 #${t.id}` })), ...(s.l1 ? [{ t: s.l1, name: `L1 #${s.l1.id}` }] : [])]
  for (const { t, name } of tables) {
    if (!mayContain(t, key)) { steps.push({ where: name, outcome: 'skip' }); continue }
    const found = t.entries.find(([k]) => k === key)
    if (!found) { steps.push({ where: name, outcome: 'false-positive' }); continue }
    steps.push({ where: name, outcome: found[1] === null ? 'tombstone' : 'hit' })
    return { value: found[1], steps }
  }
  return { value: undefined, steps }
}
