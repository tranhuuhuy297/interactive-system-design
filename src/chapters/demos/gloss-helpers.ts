import { GLOSSARY, type GlossaryEntry } from '../../data/glossary-data'

export { GLOSSARY_FOCUS_EVENT, GLOSSARY_FOCUS_KEY } from './gloss-focus'

export const slugify = (term: string) =>
  term.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'term'

export const anchorId = (term: string) => `term-${slugify(term)}`

/** First letter used for A–Z grouping; digits and symbols share "#". */
export const letterOf = (term: string) => {
  const c = term.replace(/^[^a-z0-9]+/i, '').charAt(0).toUpperCase()
  return /[A-Z]/.test(c) ? c : '#'
}

interface Indexed { entry: GlossaryEntry; term: string; names: string[]; hay: string }

// Lowercased haystacks computed once; the glossary is static.
const INDEX: Indexed[] = GLOSSARY.map((entry) => {
  const names = [entry.term, ...(entry.aka ?? [])].map((n) => n.toLowerCase())
  return { entry, term: entry.term.toLowerCase(), names, hay: `${names.join(' ')} ${entry.def.toLowerCase()}` }
})

const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)

/** Entries where every query word appears in the term, aliases, or definition. */
export function filterGlossary(query: string): GlossaryEntry[] {
  const ws = words(query)
  if (!ws.length) return GLOSSARY
  return INDEX.filter((i) => ws.every((w) => i.hay.includes(w))).map((i) => i.entry)
}

/** Name matches only, ranked exact > prefix > word-prefix > substring; used by the command palette. */
export function rankTermMatches(query: string, limit = 6): GlossaryEntry[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const scored: { e: GlossaryEntry; s: number }[] = []
  for (const i of INDEX) {
    let best = 0
    for (const n of i.names) {
      const s = n === q ? 4 : n.startsWith(q) ? 3 : n.split(/[\s/(-]+/).some((p) => p.startsWith(q)) ? 2 : n.includes(q) ? 1 : 0
      if (s > best) best = s
    }
    if (best) scored.push({ e: i.entry, s: best })
  }
  return scored.sort((a, b) => b.s - a.s || a.e.term.length - b.e.term.length).slice(0, limit).map((x) => x.e)
}

/** Find an entry by display term, alias, or slug (for deep links). */
export function findEntry(key: string): GlossaryEntry | undefined {
  const k = key.trim().toLowerCase()
  return INDEX.find((i) => i.names.includes(k) || slugify(i.entry.term) === slugify(k))?.entry
}

/** Group entries by first letter, preserving the data file's alphabetical order. */
export function groupByLetter(entries: GlossaryEntry[]): [string, GlossaryEntry[]][] {
  const map = new Map<string, GlossaryEntry[]>()
  for (const e of entries) {
    const l = letterOf(e.term)
    const list = map.get(l)
    if (list) list.push(e)
    else map.set(l, [e])
  }
  return [...map.entries()].sort(([a], [b]) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b)))
}
