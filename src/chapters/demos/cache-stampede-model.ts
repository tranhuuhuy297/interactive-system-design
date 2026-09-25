import { mulberry32 } from './lb-hash-ring-math'

export type Mode = 'none' | 'coalesce' | 'early'

export interface StampedeParams {
  rps: number        // requests/second for the hot key
  ttlMs: number
  dbLatencyMs: number
  mode: Mode
  durationMs?: number
}

export interface Bucket { t: number; db: number; waiting: number; hit: number }

const BUCKET = 100 // ms

/**
 * Bucketed simulation of one hot key.
 * - none: every request that misses during a refill goes to the DB itself.
 * - coalesce: the first miss fetches; the rest wait on that single in-flight request.
 * - early: XFetch probabilistic early recompute, P(refresh) = exp(-(expiry - now) / (delta * beta)).
 */
export function simulateStampede({ rps, ttlMs, dbLatencyMs, mode, durationMs = 30_000 }: StampedeParams): Bucket[] {
  const rng = mulberry32(7)
  const perBucket = (rps * BUCKET) / 1000
  const beta = 1
  const buckets: Bucket[] = []
  let expiry = ttlMs            // cache warm at t=0
  let refillDoneAt = -1         // pending refresh completion time (-1 = none)
  let missStartedAt = -1        // in 'none' mode: when the first miss began

  for (let t = 0; t < durationMs; t += BUCKET) {
    const b: Bucket = { t, db: 0, waiting: 0, hit: 0 }
    // Apply a completed refresh at the start of the bucket.
    if (refillDoneAt >= 0 && refillDoneAt <= t) { expiry = refillDoneAt + ttlMs; refillDoneAt = -1; missStartedAt = -1 }
    const n = Math.max(0, Math.round(perBucket + (rng() - 0.5)))

    if (t < expiry) {
      b.hit = n
      if (mode === 'early' && refillDoneAt < 0 && n > 0) {
        const p = Math.exp(-(expiry - t) / (dbLatencyMs * beta))
        const anyFires = 1 - (1 - Math.min(1, p)) ** n
        if (rng() < anyFires) { b.db += 1; refillDoneAt = t + dbLatencyMs }
      }
    } else if (mode === 'none') {
      // Every request in the miss window queries the DB until the first refill lands.
      if (missStartedAt < 0) { missStartedAt = t; refillDoneAt = t + dbLatencyMs }
      b.db += n
    } else {
      // coalesce (and 'early' if it failed to refresh in time) → single flight
      if (refillDoneAt < 0) { refillDoneAt = t + dbLatencyMs; b.db += 1 }
      b.waiting = n
    }
    buckets.push(b)
  }
  return buckets
}

export function summarize(buckets: Bucket[]) {
  const totalDb = buckets.reduce((a, b) => a + b.db, 0)
  const peakDb = Math.max(...buckets.map((b) => b.db))
  const waited = buckets.reduce((a, b) => a + b.waiting, 0)
  return { totalDb, peakDbPerSec: peakDb * (1000 / BUCKET), waited }
}
