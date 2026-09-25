// Toy decode-loop scheduler: one step = one decode iteration that emits one token per occupied slot.

export type Profile = 'uniform' | 'long-tail'
export type EngineKind = 'static' | 'continuous'

export interface Req { id: number; arrival: number; len: number }
export interface EngineRun { history: Int16Array[]; finish: Map<number, number> }

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** Deterministic arrival stream so both engines see identical traffic. */
export function makeArrivals(steps: number, rate: number, profile: Profile, seed = 42): Req[] {
  const r = rng(seed)
  const out: Req[] = []
  for (let t = 0; t < steps; t++) {
    let n = Math.floor(rate) + (r() < rate % 1 ? 1 : 0)
    while (n-- > 0) {
      const len = profile === 'uniform' ? 30 + Math.floor(r() * 30) : 6 + Math.floor(180 * r() ** 3)
      out.push({ id: out.length, arrival: t, len })
    }
  }
  return out
}

/** Static batching waits for a full batch (or a timeout), then holds every slot until the longest request ends. */
export function runEngine(kind: EngineKind, arrivals: Req[], slots: number, steps: number, maxWait = 8): EngineRun {
  const queue: Req[] = []
  const active: ({ req: Req; left: number } | null)[] = Array(slots).fill(null)
  const history: Int16Array[] = []
  const finish = new Map<number, number>()
  let next = 0
  let batchOpen = false

  for (let t = 0; t < steps; t++) {
    while (next < arrivals.length && arrivals[next].arrival <= t) queue.push(arrivals[next++])

    const canAdmit = kind === 'continuous'
      || (!batchOpen && (queue.length >= slots || (queue.length > 0 && t - queue[0].arrival >= maxWait)))
    if (canAdmit) {
      for (let i = 0; i < slots && queue.length; i++) if (!active[i]) { const req = queue.shift()!; active[i] = { req, left: req.len } }
      if (kind === 'static' && active.some(Boolean)) batchOpen = true
    }

    const row = new Int16Array(slots).fill(-1)
    active.forEach((a, i) => {
      if (!a) return
      row[i] = a.req.id
      a.left -= 1
      if (a.left <= 0) { finish.set(a.req.id, t + 1); active[i] = null }
    })
    history.push(row)
    if (kind === 'static' && batchOpen && active.every((a) => !a)) batchOpen = false
  }
  return { history, finish }
}

export interface Metrics { tokensPerStep: number; utilization: number; avgLatency: number; p95Latency: number; completed: number; queued: number }

export function metricsAt(run: EngineRun, arrivals: Req[], t: number, slots: number): Metrics {
  const rows = run.history.slice(0, t)
  const tokens = rows.reduce((s, r) => s + r.filter((x) => x >= 0).length, 0)
  const lats = arrivals.filter((a) => (run.finish.get(a.id) ?? Infinity) <= t).map((a) => run.finish.get(a.id)! - a.arrival).sort((a, b) => a - b)
  const started = new Set<number>()
  rows.forEach((r) => r.forEach((x) => x >= 0 && started.add(x)))
  return {
    tokensPerStep: t ? tokens / t : 0,
    utilization: t ? tokens / (t * slots) : 0,
    avgLatency: lats.length ? lats.reduce((s, x) => s + x, 0) / lats.length : 0,
    p95Latency: lats.length ? lats[Math.min(lats.length - 1, Math.floor(lats.length * 0.95))] : 0,
    completed: lats.length,
    queued: arrivals.filter((a) => a.arrival < t && !started.has(a.id)).length,
  }
}
