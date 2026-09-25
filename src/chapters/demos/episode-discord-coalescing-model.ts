/** Toy model of hot-channel reads hitting a data-service tier, with and without request coalescing. */

export type Routing = 'hash' | 'random'

export interface CoalesceInput {
  clients: number
  windowMs: number
  latencyMs: number
  instances: number
  routing: Routing
  coalesce: boolean
}

export interface QuerySpan { instance: number; start: number; end: number }

export interface CoalesceResult {
  queries: number
  peakInFlight: number
  avgWaitMs: number
  spans: QuerySpan[]
}

// Deterministic PRNG so the same inputs always draw the same arrival pattern.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function simulateCoalescing(inp: CoalesceInput): CoalesceResult {
  const clients = Math.max(1, Math.round(inp.clients))
  const instances = Math.max(1, Math.round(inp.instances))
  const latency = Math.max(1, inp.latencyMs)
  const rand = mulberry32(7)
  const arrivals = Array.from({ length: clients }, () => rand() * inp.windowMs).sort((a, b) => a - b)
  const inflightUntil: number[] = new Array(instances).fill(-Infinity)
  const spans: QuerySpan[] = []
  let totalWait = 0

  for (const t of arrivals) {
    // Hash routing: every request for this channel lands on the same instance.
    const inst = inp.routing === 'hash' ? 0 : Math.floor(rand() * instances)
    if (inp.coalesce && inflightUntil[inst] > t) {
      totalWait += inflightUntil[inst] - t // piggyback on the query already in flight
      continue
    }
    const end = t + latency
    spans.push({ instance: inst, start: t, end })
    if (inp.coalesce) inflightUntil[inst] = end
    totalWait += latency
  }

  return { queries: spans.length, peakInFlight: peakConcurrency(spans), avgWaitMs: totalWait / clients, spans }
}

function peakConcurrency(spans: QuerySpan[]): number {
  const events: [number, number][] = []
  for (const s of spans) { events.push([s.start, 1]); events.push([s.end, -1]) }
  // Ends sort before starts at the same instant so back-to-back queries don't double count.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let cur = 0
  let peak = 0
  for (const [, d] of events) { cur += d; peak = Math.max(peak, cur) }
  return peak
}
