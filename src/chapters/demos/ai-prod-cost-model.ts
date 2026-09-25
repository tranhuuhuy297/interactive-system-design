// Toy cost/latency model for an LLM app with an exact cache, a semantic cache, and a two-model mix.
// All prices and latencies are illustrative defaults, not any provider's real price list.

export interface CostInputs {
  requestsPerDay: number
  inputTokens: number
  outputTokens: number
  /** Share of cache misses routed to the small model (0–1). */
  smallModelShare: number
  largePriceIn: number   // $ per 1M input tokens
  largePriceOut: number  // $ per 1M output tokens
  smallPriceIn: number
  smallPriceOut: number
  exactHit: number       // share of all requests served by the exact cache (0–1)
  semanticHit: number    // share of exact-cache misses served by the semantic cache (0–1)
  semanticFalseHit: number // share of semantic hits that return a wrong/stale answer (0–1)
}

export interface CostResult {
  monthlyCost: number
  monthlyCostNoCache: number
  modelCalls: number        // per day
  wrongAnswersPerDay: number
  avgLatencyMs: number
  shares: { exact: number; semantic: number; small: number; large: number }
}

const DAYS = 30
const EMBED_PRICE = 0.02 // $ per 1M tokens to embed queries for semantic lookup (illustrative)
const LAT = { exact: 15, semantic: 60, largeTtft: 600, largePerTok: 25, smallTtft: 250, smallPerTok: 8 }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function computeCost(i: CostInputs): CostResult {
  const exact = clamp01(i.exactHit)
  const semantic = (1 - exact) * clamp01(i.semanticHit)
  const miss = 1 - exact - semantic
  const small = miss * clamp01(i.smallModelShare)
  const large = miss - small

  const perCall = (pin: number, pout: number) => (i.inputTokens * pin + i.outputTokens * pout) / 1e6
  const largeCall = perCall(i.largePriceIn, i.largePriceOut)
  const smallCall = perCall(i.smallPriceIn, i.smallPriceOut)
  const embedCall = (i.inputTokens * EMBED_PRICE) / 1e6

  const daily = i.requestsPerDay * (large * largeCall + small * smallCall)
    // With a semantic cache on, every exact-cache miss is embedded for the similarity lookup.
    + (i.semanticHit > 0 ? i.requestsPerDay * (1 - exact) * embedCall : 0)

  const largeLat = LAT.largeTtft + i.outputTokens * LAT.largePerTok
  const smallLat = LAT.smallTtft + i.outputTokens * LAT.smallPerTok
  const lookup = i.semanticHit > 0 ? LAT.semantic : LAT.exact
  const avgLatencyMs = exact * LAT.exact + semantic * LAT.semantic
    + small * (lookup + smallLat) + large * (lookup + largeLat)

  return {
    monthlyCost: daily * DAYS,
    monthlyCostNoCache: i.requestsPerDay * largeCall * DAYS,
    modelCalls: i.requestsPerDay * miss,
    wrongAnswersPerDay: i.requestsPerDay * semantic * clamp01(i.semanticFalseHit),
    avgLatencyMs,
    shares: { exact, semantic, small, large },
  }
}
