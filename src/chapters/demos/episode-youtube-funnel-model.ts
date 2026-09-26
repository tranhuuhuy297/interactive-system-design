// Toy latency model for a two-stage recommender. All constants are illustrative, not YouTube figures.

export interface FunnelInput {
  /** Videos in the corpus. */
  corpus: number
  /** Candidates returned by the retrieval stage. */
  candidates: number
  /** CPU time to score one item with the heavy ranking model, in microseconds. */
  rankUs: number
  /** Parallel ranking workers per request. */
  workers: number
  /** Items finally shown. */
  shown: number
  /** End-to-end latency budget in milliseconds. */
  budgetMs: number
}

export interface FunnelResult {
  retrievalMs: number
  rankMs: number
  rulesMs: number
  totalMs: number
  /** Latency if the heavy model scored the whole corpus instead. */
  bruteForceMs: number
  /** Share of "good" videos that survive retrieval (toy recall curve). */
  recall: number
  withinBudget: boolean
  stages: { label: string; count: number }[]
}

const ANN_BASE_MS = 2 // fixed cost of an approximate nearest-neighbor lookup
const ANN_PER_DECADE_MS = 0.6 // grows slowly (roughly log) with corpus size
const ANN_PER_CANDIDATE_MS = 0.002
const RULES_MS = 2 // dedupe, diversity, policy filters
const RECALL_SCALE = 400 // candidates at which recall reaches ~63%

export function simulateFunnel(i: FunnelInput): FunnelResult {
  const corpus = Math.max(1, i.corpus)
  const candidates = Math.max(1, Math.min(i.candidates, corpus))
  const workers = Math.max(1, i.workers)
  const retrievalMs = ANN_BASE_MS + ANN_PER_DECADE_MS * Math.log10(corpus) + ANN_PER_CANDIDATE_MS * candidates
  const rankMs = (candidates * i.rankUs) / 1000 / workers
  const totalMs = retrievalMs + rankMs + RULES_MS
  const bruteForceMs = (corpus * i.rankUs) / 1000 / workers
  const recall = 1 - Math.exp(-candidates / RECALL_SCALE)
  const shown = Math.min(i.shown, candidates)
  return {
    retrievalMs, rankMs, rulesMs: RULES_MS, totalMs, bruteForceMs, recall,
    withinBudget: totalMs <= i.budgetMs,
    stages: [
      { label: 'Corpus', count: corpus },
      { label: 'Candidates', count: candidates },
      { label: 'Ranked top', count: Math.min(candidates, shown * 3) },
      { label: 'Shown', count: shown },
    ],
  }
}

/** Human-readable duration from milliseconds. */
export function fmtMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)} ms`
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 1 : 0)} ms`
  const s = ms / 1000
  if (s < 120) return `${s.toFixed(1)} s`
  const min = s / 60
  if (min < 120) return `${min.toFixed(0)} min`
  return `${(min / 60).toFixed(1)} h`
}

/** Compact count: 1.2K, 3.4M, 1.0B. */
export function fmtCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`
  return String(Math.round(n))
}
