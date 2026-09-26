// Toy lease-based job scheduler: one run is due per tick, workers claim runs with a lease.
// Durations, crash timing, and sizes are illustrative and seeded so results are repeatable.

export interface SchedConfig {
  leaseTicks: number
  crashPct: number
  heartbeat: boolean
  idempotent: boolean
  maxAttempts: number
}

export interface Bar { worker: number; run: number; start: number; end: number; outcome: 'done' | 'crash' | 'dup' | 'skipped' }

export interface SchedResult {
  bars: Bar[]
  runs: number
  executions: number
  duplicateExecutions: number
  duplicateEffects: number
  retriesAfterCrash: number
  deadLettered: number
  avgDelay: number
  horizon: number
}

const RUNS = 30
const WORKERS = 3
const HORIZON = 70
const RESTART = 3

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Exec { run: number; start: number; end: number; crashAt: number | null }

export function simulate(cfg: SchedConfig, seed = 11): SchedResult {
  const rnd = mulberry32(seed)
  const duration = Array.from({ length: RUNS }, () => 2 + Math.floor(rnd() * 6)) // 2–7 ticks
  const leaseUntil = new Array<number>(RUNS).fill(-1) // tick until which a run is claimed
  const attempts = new Array<number>(RUNS).fill(0)
  const effects = new Array<number>(RUNS).fill(0)
  const doneAt = new Array<number>(RUNS).fill(-1)
  const dead = new Array<boolean>(RUNS).fill(false)
  const busy: (Exec | null)[] = new Array(WORKERS).fill(null)
  const downUntil = new Array<number>(WORKERS).fill(0)
  const bars: Bar[] = []
  let executions = 0, dupExec = 0, retries = 0

  for (let t = 0; t < HORIZON; t++) {
    // 1. Running executions finish, crash, or keep their lease alive.
    busy.forEach((e, w) => {
      if (!e) return
      if (e.crashAt === t) {
        bars.push({ worker: w, run: e.run, start: e.start, end: t, outcome: 'crash' })
        busy[w] = null; downUntil[w] = t + RESTART
        return
      }
      if (t >= e.end) {
        const alreadyDone = doneAt[e.run] >= 0
        const applies = !(cfg.idempotent && effects[e.run] > 0)
        if (applies) effects[e.run]++
        if (!alreadyDone) doneAt[e.run] = t
        bars.push({ worker: w, run: e.run, start: e.start, end: t, outcome: alreadyDone ? (applies ? 'dup' : 'skipped') : 'done' })
        busy[w] = null
        return
      }
      if (cfg.heartbeat) leaseUntil[e.run] = t + cfg.leaseTicks
    })
    // 2. Idle workers claim the oldest due run that is not finished and whose lease has expired.
    for (let w = 0; w < WORKERS; w++) {
      if (busy[w] || t < downUntil[w]) continue
      let pick = -1
      for (let r = 0; r <= Math.min(t, RUNS - 1); r++) {
        if (doneAt[r] >= 0 || dead[r] || leaseUntil[r] > t) continue
        pick = r; break
      }
      if (pick < 0) break
      if (attempts[pick] >= cfg.maxAttempts) { dead[pick] = true; w--; continue }
      if (attempts[pick] > 0) retries++
      // Another execution of this run may still be alive: that is a duplicate in flight.
      if (busy.some((e) => e?.run === pick)) dupExec++
      attempts[pick]++; executions++
      leaseUntil[pick] = t + cfg.leaseTicks
      const crashAt = rnd() * 100 < cfg.crashPct ? t + 1 + Math.floor(rnd() * duration[pick]) : null
      busy[w] = { run: pick, start: t, end: t + duration[pick], crashAt: crashAt !== null && crashAt < t + duration[pick] ? crashAt : null }
    }
  }
  busy.forEach((e, w) => { if (e) bars.push({ worker: w, run: e.run, start: e.start, end: HORIZON, outcome: 'done' }) })
  const finished = doneAt.map((d, r) => (d >= 0 ? d - r : -1)).filter((d) => d >= 0)
  return {
    bars, runs: RUNS, executions, duplicateExecutions: dupExec,
    duplicateEffects: effects.reduce((a, n) => a + Math.max(0, n - 1), 0),
    retriesAfterCrash: retries, deadLettered: dead.filter(Boolean).length,
    avgDelay: finished.length ? finished.reduce((a, b) => a + b, 0) / finished.length : 0,
    horizon: HORIZON,
  }
}
