// Retrieval playground model: chunking, BM25, a toy "embedding", and reciprocal rank fusion.

export interface Doc { id: string; title: string; text: string }

export const CORPUS: Doc[] = [
  { id: 'D1', title: 'Refund policy', text: 'You can request a refund within 30 days of purchase. Refunds are returned to the original card and usually arrive in 5 to 10 business days. Annual plans are reimbursed pro rata after the first month. To start, open Billing, choose the invoice, and click Request refund.' },
  { id: 'D2', title: 'Cancel your subscription', text: 'Cancel anytime from Settings, Plan. Cancellation takes effect at the end of the current billing period and you keep access until then. Workspace data is kept for 90 days in case you change your mind, after that it is permanently deleted.' },
  { id: 'D3', title: 'Two-factor authentication', text: 'Protect your account with 2FA using an authenticator app. If you lose your device, use one of your backup codes to sign in, then reset 2FA from Security settings. Support cannot disable 2FA without identity verification.' },
  { id: 'D4', title: 'Upload errors', text: 'Uploads larger than 5 GB must use the resumable uploader. Error E4012 means the file exceeded your storage quota, so free space or upgrade your plan. Error E5003 is a temporary network failure and the client retries automatically.' },
  { id: 'D5', title: 'Export your data', text: 'You can export all workspace data as a ZIP from Settings, Data. Large exports are prepared in the background and a download link is emailed to the workspace owner. Links expire after 7 days.' },
  { id: 'D6', title: 'Performance tips', text: 'If the dashboard feels slow, check the status page first. Large tables load faster with filters applied, and disabling browser extensions often reduces latency. Enterprise plans can request a dedicated region.' },
]

export const PRESET_QUERIES = [
  { q: 'how do I get my money back', expect: 'D1', why: 'No shared words with the answer: lexical search misses, meaning-based search hits.' },
  { q: 'what does E5003 mean', expect: 'D4', why: 'An exact identifier: lexical search hits, the embedding stand-in has nothing to hold on to.' },
  { q: 'close my account and delete everything', expect: 'D2', why: 'BM25 is pulled toward the 2FA doc by the word “account”; the embedding finds cancellation. Fusion keeps both in the top 3, which is exactly what a reranker needs.' },
  { q: 'download invoice', expect: 'D1', why: 'Each method’s top hit is wrong, but both rank the billing chunk second. Fusion rewards agreement and puts it first.' },
] as const

const STOP = new Set('a an and are as at be by can do does for from get how i if in is it me my of on or so the then this to until use using what when with you your after all has one there their that'.split(' '))

/** Lowercase word tokens with a naive plural strip; stopwords removed. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
}

export interface Chunk { id: string; docId: string; text: string }

/** Fixed-size word windows with overlap (overlap is a fraction of size). */
export function chunkCorpus(size: number, overlapFrac: number): Chunk[] {
  const step = Math.max(1, Math.round(size * (1 - overlapFrac)))
  const out: Chunk[] = []
  for (const d of CORPUS) {
    const words = d.text.split(/\s+/)
    for (let start = 0, i = 0; start < words.length; start += step, i++) {
      out.push({ id: `${d.id}#${i}`, docId: d.id, text: words.slice(start, start + size).join(' ') })
      if (start + size >= words.length) break
    }
  }
  return out
}

export interface Scored { chunk: Chunk; score: number }

/** Okapi BM25 (k1=1.2, b=0.75) with the non-negative Lucene-style IDF. */
export function bm25(chunks: Chunk[], query: string, k1 = 1.2, b = 0.75): Scored[] {
  const docs = chunks.map((c) => tokenize(c.text))
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / docs.length
  const N = docs.length
  const q = [...new Set(tokenize(query))]
  const df = new Map(q.map((t) => [t, docs.filter((d) => d.includes(t)).length]))
  return chunks.map((chunk, i) => {
    const d = docs[i]
    let score = 0
    for (const t of q) {
      const f = d.filter((w) => w === t).length
      if (!f) continue
      const n = df.get(t)!
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgdl)))
    }
    return { chunk, score }
  }).filter((s) => s.score > 0).sort((a, b2) => b2.score - a.score)
}

// Stand-in for a neural embedding: words map to shared "concepts"; unknown words (IDs, codes) vanish.
const PHRASES: [RegExp, string][] = [[/money back/g, 'refund'], [/sign in/g, 'login'], [/two-factor/g, '2fa']]
const CONCEPTS: Record<string, string> = Object.fromEntries(Object.entries({
  refund: 'refund reimbursed reimburse chargeback', billing: 'billing invoice card purchase payment charged plan',
  cancel: 'cancel cancellation close terminate', account: 'account workspace profile',
  security: '2fa authenticator login password identity verification security', delete: 'delete deleted erase remove permanently',
  upload: 'upload uploads uploader file', error: 'error failure failed fail', storage: 'storage quota space gb',
  export: 'export exports download zip data backup', speed: 'slow latency faster performance',
}).flatMap(([c, words]) => words.split(' ').map((w) => [w, c])))

export function embed(text: string): Map<string, number> {
  let t = text.toLowerCase()
  for (const [re, rep] of PHRASES) t = t.replace(re, rep)
  const v = new Map<string, number>()
  for (const w of t.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    const c = CONCEPTS[w]
    if (c) v.set(c, (v.get(c) ?? 0) + 1)
  }
  return v
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  for (const [k, x] of a) dot += x * (b.get(k) ?? 0)
  const norm = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, x) => s + x * x, 0))
  const d = norm(a) * norm(b)
  return d ? dot / d : 0
}

export function vectorSearch(chunks: Chunk[], query: string): Scored[] {
  const qv = embed(query)
  return chunks.map((chunk) => ({ chunk, score: cosine(qv, embed(chunk.text)) }))
    .filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
}

/** Reciprocal rank fusion: sum of 1 / (k + rank) across ranked lists (k = 60 by convention). */
export function rrf(lists: Scored[][], k = 60): Scored[] {
  const acc = new Map<string, Scored>()
  for (const list of lists) {
    list.forEach((s, i) => {
      const prev = acc.get(s.chunk.id)
      acc.set(s.chunk.id, { chunk: s.chunk, score: (prev?.score ?? 0) + 1 / (k + i + 1) })
    })
  }
  return [...acc.values()].sort((a, b) => b.score - a.score)
}

/** 1-based rank of the first chunk from the expected document, or null. */
export function firstHit(list: Scored[], docId: string, topK = 5): number | null {
  const i = list.slice(0, topK).findIndex((s) => s.chunk.docId === docId)
  return i < 0 ? null : i + 1
}
