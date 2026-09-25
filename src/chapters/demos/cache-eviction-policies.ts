/** Exact eviction-policy simulators producing a per-access trace for visualisation. */
export type Policy = 'LRU' | 'LFU' | 'FIFO'

export interface TraceStep {
  key: string
  hit: boolean
  evicted?: string
  /** Cache contents after the access, in display order (most "protected" first). */
  contents: { key: string; meta: string }[]
}

export function simulate(policy: Policy, seq: string[], capacity: number): TraceStep[] {
  // entries: key → { freq, lastUsed, inserted }
  const entries = new Map<string, { freq: number; last: number; inserted: number }>()
  const out: TraceStep[] = []
  seq.forEach((key, t) => {
    const e = entries.get(key)
    let evicted: string | undefined
    if (e) {
      e.freq += 1
      e.last = t
    } else {
      if (entries.size >= capacity) {
        evicted = pickVictim(policy, entries)
        entries.delete(evicted)
      }
      entries.set(key, { freq: 1, last: t, inserted: t })
    }
    const contents = [...entries.entries()]
      .sort(([, a], [, b]) => rank(policy, b) - rank(policy, a) || b.last - a.last)
      .map(([k, v]) => ({ key: k, meta: policy === 'LFU' ? `×${v.freq}` : policy === 'LRU' ? `t${v.last}` : `in t${v.inserted}` }))
    out.push({ key, hit: !!e, evicted, contents })
  })
  return out
}

function rank(policy: Policy, e: { freq: number; last: number; inserted: number }) {
  return policy === 'LFU' ? e.freq : policy === 'LRU' ? e.last : e.inserted
}

function pickVictim(policy: Policy, entries: Map<string, { freq: number; last: number; inserted: number }>): string {
  let victim = ''
  let best: { freq: number; last: number; inserted: number } | null = null
  for (const [k, v] of entries) {
    if (!best) { victim = k; best = v; continue }
    const worse =
      policy === 'LRU' ? v.last < best.last
      : policy === 'FIFO' ? v.inserted < best.inserted
      // LFU: lowest frequency, ties broken by least recently used.
      : v.freq < best.freq || (v.freq === best.freq && v.last < best.last)
    if (worse) { victim = k; best = v }
  }
  return victim
}

export const PRESETS: { id: string; label: string; seq: string }[] = [
  { id: 'mixed', label: 'Hot set + noise', seq: 'A B A C A D B A E A B F A B G A B C' },
  { id: 'scan', label: 'Scan pollution', seq: 'A B A B A B C D E F G H A B A B' },
  { id: 'loop', label: 'Loop > capacity', seq: 'A B C D E A B C D E A B C D E' },
  { id: 'shift', label: 'Popularity shift', seq: 'A A A A B B B B C D C D C D C D E C D' },
]
