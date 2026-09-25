/** Toy models for the reliability demos. Deliberately simple and labelled as such in the UI. */

export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Availability math ──
/** N redundant replicas with independent failures: available unless all are down. */
export const parallel = (a: number, n: number) => 1 - (1 - a) ** n
export const serial = (parts: number[]) => parts.reduce((p, a) => p * a, 1)

export function downtime(a: number) {
  const minutesPerYear = 365.25 * 24 * 60
  const m = (1 - a) * minutesPerYear
  const fmt = (min: number) => (min >= 1440 ? `${(min / 1440).toFixed(1)} days` : min >= 60 ? `${(min / 60).toFixed(1)} h` : min >= 1 ? `${min.toFixed(1)} min` : `${(min * 60).toFixed(0)} s`)
  return { year: fmt(m), month: fmt(m / 12) }
}

// ── Retry storm ──
export type RetryPolicy = 'immediate' | 'exponential' | 'jitter'

export interface RetryRun { attempts: number[]; served: number[]; doneAt: number | null }

/**
 * Clients all fail during an outage, then retry per policy. When load exceeds 2× capacity the server
 * spends its time on requests that will time out anyway, so goodput collapses (toy model of congestion collapse).
 */
export function simulateRetries(policy: RetryPolicy, clients: number, capacity: number, outage: number, ticks = 80): RetryRun {
  const rand = mulberry32(42)
  const failures = new Map<number, number[]>() // tick -> failure counts of clients retrying then
  failures.set(0, new Array(clients).fill(0))
  const attempts: number[] = []
  const served: number[] = []
  let remaining = clients
  let doneAt: number | null = null

  for (let t = 0; t < ticks; t++) {
    const batch = failures.get(t) ?? []
    failures.delete(t)
    const n = batch.length
    attempts.push(n)
    let ok = 0
    if (t >= outage && n > 0) {
      const goodput = n <= 2 * capacity ? Math.min(n, capacity) : Math.floor(capacity * Math.max(0.02, ((2 * capacity) / n) ** 2))
      ok = goodput
    }
    served.push(ok)
    remaining -= ok
    if (remaining === 0 && doneAt === null) doneAt = t
    // Everyone not served fails and reschedules.
    for (let i = ok; i < n; i++) {
      const k = batch[i] + 1
      const base = Math.min(16, 2 ** (k - 1))
      const delay = policy === 'immediate' ? 1 : policy === 'exponential' ? base : Math.max(1, Math.ceil(rand() * base))
      const at = t + delay
      if (!failures.has(at)) failures.set(at, [])
      failures.get(at)!.push(k)
    }
  }
  return { attempts, served, doneAt }
}
