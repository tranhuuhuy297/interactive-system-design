import { mulberry32 } from './lb-hash-ring-math'

/** Discrete-time toy model: every algorithm sees the identical request stream. */
export type Algo = 'random' | 'round-robin' | 'least-conn' | 'p2c'
export const ALGOS: { id: Algo; label: string }[] = [
  { id: 'random', label: 'Random' },
  { id: 'round-robin', label: 'Round robin' },
  { id: 'least-conn', label: 'Least connections' },
  { id: 'p2c', label: 'Power of two choices' },
]

interface Job { work: number; arrived: number }
interface Server { queue: Job[]; speed: number }

export interface Lane {
  algo: Algo
  servers: Server[]
  rr: number
  latencies: number[]
  pick: () => number
}

export interface RaceState {
  tick: number
  lanes: Lane[]
  arrivals: () => number
  cost: () => number
}

export function createRace(n: number, slowServer: boolean, seed = 42): RaceState {
  const mk = (): Server[] => Array.from({ length: n }, (_, i) => ({ queue: [], speed: slowServer && i === 0 ? 0.35 : 1 }))
  const lanes = ALGOS.map((a, i) => ({ algo: a.id, servers: mk(), rr: 0, latencies: [], pick: mulberry32(seed + 100 + i) }))
  return { tick: 0, lanes, arrivals: mulberry32(seed), cost: mulberry32(seed + 7) }
}

const MEAN_COST = 0.9 * 0.75 + 0.1 * 5 // = 1.175

const outstanding = (s: Server) => s.queue.length

function choose(lane: Lane): number {
  const n = lane.servers.length
  switch (lane.algo) {
    case 'random': return Math.floor(lane.pick() * n)
    case 'round-robin': return lane.rr++ % n
    case 'least-conn': {
      let best = 0
      for (let i = 1; i < n; i++) if (outstanding(lane.servers[i]) < outstanding(lane.servers[best])) best = i
      return best
    }
    case 'p2c': {
      const a = Math.floor(lane.pick() * n)
      let b = Math.floor(lane.pick() * (n - 1)); if (b >= a) b++
      return outstanding(lane.servers[a]) <= outstanding(lane.servers[b]) ? a : b
    }
  }
}

/** Advance one tick: `load` is utilisation of total capacity (0–1). */
export function step(state: RaceState, load: number) {
  const capacity = state.lanes[0].servers.reduce((a, s) => a + s.speed, 0)
  // Heavy-tailed request cost: 90% cheap (0.5–1), 10% expensive (3–7). Arrivals are scaled by the mean
  // cost so the slider value really is the fraction of total capacity in use.
  const jobs: number[] = []
  const expected = (load * capacity) / MEAN_COST
  let count = Math.floor(expected) + (state.arrivals() < expected % 1 ? 1 : 0)
  while (count-- > 0) {
    const u = state.cost()
    jobs.push(u < 0.9 ? 0.5 + state.cost() * 0.5 : 3 + state.cost() * 4)
  }
  for (const lane of state.lanes) {
    for (const w of jobs) lane.servers[choose(lane)].queue.push({ work: w, arrived: state.tick })
    for (const s of lane.servers) {
      let budget = s.speed
      while (budget > 0 && s.queue.length) {
        const head = s.queue[0]
        const used = Math.min(budget, head.work)
        head.work -= used; budget -= used
        if (head.work <= 1e-9) { s.queue.shift(); lane.latencies.push(state.tick - head.arrived + 1) }
      }
    }
    if (lane.latencies.length > 400) lane.latencies.splice(0, lane.latencies.length - 400)
  }
  state.tick++
}

export function laneStats(lane: Lane) {
  const q = lane.servers.map(outstanding)
  const sorted = [...lane.latencies].sort((a, b) => a - b)
  const p99 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] : 0
  const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0
  return { q, maxQ: Math.max(...q), avg, p99 }
}
