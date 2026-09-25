/** Toy simulation of an LLM gateway routing 1,000 requests across three providers. Prices and latencies are illustrative. */

export type Policy = 'primary' | 'weighted' | 'adaptive'
export type FailureMode = 'rate-limit' | 'timeout'

export interface Provider { id: string; name: string; p50Ms: number; pricePerMTok: number }

export const PROVIDERS: Provider[] = [
  { id: 'a', name: 'Provider A', p50Ms: 700, pricePerMTok: 3 },
  { id: 'b', name: 'Provider B', p50Ms: 900, pricePerMTok: 4 },
  { id: 'c', name: 'Self-hosted', p50Ms: 1200, pricePerMTok: 1.5 },
]

export interface GatewayConfig {
  policy: Policy
  failureMode: FailureMode
  /** Failure probability per provider id, 0–1. */
  failRate: Record<string, number>
}

export interface GatewayResult {
  successRate: number
  p95Ms: number
  cost: number
  attemptsPerRequest: number
  served: Record<string, number>
}

const REQUESTS = 1000
const TOKENS_PER_REQUEST = 2000
const TIMEOUT_MS = 3000
const RATE_LIMIT_MS = 60
const BREAKER_WINDOW = 20
const BREAKER_THRESHOLD = 0.5
const WEIGHTS: Record<string, number> = { a: 0.6, b: 0.3, c: 0.1 }

/** Deterministic PRNG (mulberry32) so every run of the demo is reproducible. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function simulateGateway(cfg: GatewayConfig): GatewayResult {
  const rand = rng(42)
  const recent: Record<string, boolean[]> = { a: [], b: [], c: [] }
  const served: Record<string, number> = { a: 0, b: 0, c: 0 }
  const latencies: number[] = []
  let ok = 0
  let cost = 0
  let attempts = 0

  const breakerOpen = (id: string) => {
    const w = recent[id]
    return w.length >= 10 && w.filter((x) => !x).length / w.length > BREAKER_THRESHOLD
  }
  const record = (id: string, success: boolean) => {
    recent[id].push(success)
    if (recent[id].length > BREAKER_WINDOW) recent[id].shift()
  }
  const pickWeighted = () => {
    const r = rand()
    return r < WEIGHTS.a ? 'a' : r < WEIGHTS.a + WEIGHTS.b ? 'b' : 'c'
  }

  for (let i = 0; i < REQUESTS; i++) {
    let order: string[]
    if (cfg.policy === 'primary') order = ['a']
    else if (cfg.policy === 'weighted') order = [pickWeighted()]
    else {
      // Fastest healthy provider first; open breakers go to the back (half-open probe every 25 requests).
      const byLatency = [...PROVIDERS].sort((x, y) => x.p50Ms - y.p50Ms).map((p) => p.id)
      const probe = i % 25 === 0
      order = [...byLatency.filter((id) => probe || !breakerOpen(id)), ...byLatency.filter((id) => !probe && breakerOpen(id))]
    }

    let elapsed = 0
    let success = false
    for (const id of order) {
      attempts++
      const p = PROVIDERS.find((x) => x.id === id)!
      if (rand() < (cfg.failRate[id] ?? 0)) {
        elapsed += cfg.failureMode === 'timeout' ? TIMEOUT_MS : RATE_LIMIT_MS
        record(id, false)
        continue
      }
      elapsed += p.p50Ms * (0.6 + rand() * 0.9)
      record(id, true)
      served[id]++
      cost += (TOKENS_PER_REQUEST / 1e6) * p.pricePerMTok // failed attempts are not billed
      success = true
      break
    }
    if (success) ok++
    latencies.push(elapsed)
  }

  latencies.sort((a, b) => a - b)
  return {
    successRate: ok / REQUESTS,
    p95Ms: Math.round(latencies[Math.floor(REQUESTS * 0.95)]),
    cost: Math.round(cost * 100) / 100,
    attemptsPerRequest: Math.round((attempts / REQUESTS) * 100) / 100,
    served,
  }
}
