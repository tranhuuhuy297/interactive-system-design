// Tiny Lucene-style pipeline: analyze → inverted index → boolean evaluation → BM25 ranking.

export interface Doc { id: number; title: string; text: string }

export const DOCS: Doc[] = [
  { id: 1, title: 'Caching 101', text: 'A cache keeps hot data in memory so reads skip the slow database.' },
  { id: 2, title: 'Database sharding', text: 'Sharding splits a database across machines; each shard owns a key range or hash bucket.' },
  { id: 3, title: 'Cache invalidation', text: 'Invalidation keeps cache entries fresh when the database changes. Delete the cache key on write.' },
  { id: 4, title: 'Search engines', text: 'A search engine builds an inverted index that maps each term to the documents containing it.' },
  { id: 5, title: 'Index segments', text: 'Lucene writes immutable index segments and merges small segments into larger ones in the background.' },
  { id: 6, title: 'Read replicas', text: 'Replicas copy the database to serve more reads; replication lag can return stale data.' },
]

const STOP = new Set(['a', 'an', 'the', 'so', 'to', 'of', 'in', 'on', 'or', 'and', 'each', 'it', 'is', 'can', 'when', 'that', 'into', 'more', 'across'])

/** Lowercase, split on non-letters, drop stop words, strip a plural "s" (a crude stand-in for stemming). */
export function analyze(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t))
}

export interface Posting { doc: number; tf: number }
export interface Index { postings: Map<string, Posting[]>; docLen: Map<number, number>; avgdl: number; N: number }

export function buildIndex(docs: Doc[]): Index {
  const postings = new Map<string, Posting[]>()
  const docLen = new Map<number, number>()
  for (const d of docs) {
    const toks = analyze(`${d.title} ${d.text}`)
    docLen.set(d.id, toks.length)
    const tf = new Map<string, number>()
    toks.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1))
    // Docs are added in id order, so every posting list stays sorted by doc id.
    tf.forEach((n, t) => { const list = postings.get(t) ?? []; list.push({ doc: d.id, tf: n }); postings.set(t, list) })
  }
  const avgdl = [...docLen.values()].reduce((s, v) => s + v, 0) / Math.max(1, docs.length)
  return { postings, docLen, avgdl, N: docs.length }
}

/** Two-pointer intersection of sorted posting lists; also counts comparisons to show why it is cheap. */
export function intersect(a: number[], b: number[]): { docs: number[]; steps: number } {
  const out: number[] = []; let i = 0; let j = 0; let steps = 0
  while (i < a.length && j < b.length) {
    steps++
    if (a[i] === b[j]) { out.push(a[i]); i++; j++ } else if (a[i] < b[j]) i++; else j++
  }
  return { docs: out, steps }
}

export const union = (lists: number[][]) => [...new Set(lists.flat())].sort((x, y) => x - y)

export const K1 = 1.2
export const B = 0.75

/** Lucene's BM25 idf: always positive, even for terms in most documents. */
export const idf = (N: number, n: number) => Math.log(1 + (N - n + 0.5) / (n + 0.5))

export function bm25(index: Index, terms: string[], doc: number): number {
  const dl = index.docLen.get(doc) ?? 0
  let score = 0
  for (const t of new Set(terms)) {
    const list = index.postings.get(t)
    const p = list?.find((x) => x.doc === doc)
    if (!list || !p) continue
    const norm = p.tf + K1 * (1 - B + (B * dl) / index.avgdl)
    score += idf(index.N, list.length) * ((p.tf * (K1 + 1)) / norm)
  }
  return score
}

export interface QueryResult { terms: string[]; matched: number[]; steps: number; ranked: { doc: number; score: number }[] }

export function runQuery(index: Index, q: string, mode: 'AND' | 'OR'): QueryResult {
  const terms = [...new Set(analyze(q))]
  const lists = terms.map((t) => (index.postings.get(t) ?? []).map((p) => p.doc))
  let matched: number[] = []; let steps = 0
  if (terms.length && mode === 'AND') {
    // Intersect shortest lists first: the result can only shrink.
    const sorted = [...lists].sort((a, b) => a.length - b.length)
    matched = sorted[0]
    for (const l of sorted.slice(1)) { const r = intersect(matched, l); matched = r.docs; steps += r.steps }
  } else if (terms.length) {
    matched = union(lists); steps = lists.reduce((s, l) => s + l.length, 0)
  }
  const ranked = matched.map((d) => ({ doc: d, score: bm25(index, terms, d) })).sort((x, y) => y.score - x.score)
  return { terms, matched, steps, ranked }
}
