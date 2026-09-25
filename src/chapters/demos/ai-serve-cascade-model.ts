// Toy model comparing routing policies between a small and a large model.
// All constants are illustrative relative units, not measured prices or accuracies.

export const SMALL = { cost: 1, latency: 0.5, qEasy: 0.93, qHard: 0.45 }
export const LARGE = { cost: 10, latency: 2.0, qEasy: 0.97, qHard: 0.9 }
const ROUTER_COST = 0.05
const ROUTER_LAT = 0.05
const CHECK_COST = 0.1
const CHECK_LAT = 0.1
const FALSE_ESCALATE = 0.1

export type PolicyId = 'small' | 'large' | 'router' | 'cascade'

export interface PolicyResult { id: PolicyId; label: string; cost: number; quality: number; latency: number }

export interface CascadeInput {
  easyShare: number
  routerAccuracy: number
  /** Share of small-model failures the cascade's check catches and escalates. */
  checkRecall: number
}

function mix(e: number, easy: number, hard: number) { return e * easy + (1 - e) * hard }

export function evaluatePolicies({ easyShare: e, routerAccuracy: r, checkRecall: d }: CascadeInput): PolicyResult[] {
  const small = { id: 'small' as const, label: 'Small only', cost: SMALL.cost, quality: mix(e, SMALL.qEasy, SMALL.qHard), latency: SMALL.latency }
  const large = { id: 'large' as const, label: 'Large only', cost: LARGE.cost, quality: mix(e, LARGE.qEasy, LARGE.qHard), latency: LARGE.latency }

  // Router: easy → small with prob r; hard → large with prob r.
  const pSmallEasy = r
  const pSmallHard = 1 - r
  const routed = (p: number, qs: number, ql: number) => ({
    cost: p * SMALL.cost + (1 - p) * LARGE.cost,
    quality: p * qs + (1 - p) * ql,
    latency: p * SMALL.latency + (1 - p) * LARGE.latency,
  })
  const re = routed(pSmallEasy, SMALL.qEasy, LARGE.qEasy)
  const rh = routed(pSmallHard, SMALL.qHard, LARGE.qHard)
  const router = {
    id: 'router' as const, label: 'Router (predict upfront)',
    cost: mix(e, re.cost, rh.cost) + ROUTER_COST,
    quality: mix(e, re.quality, rh.quality),
    latency: mix(e, re.latency, rh.latency) + ROUTER_LAT,
  }

  // Cascade: always try small; escalate detected failures plus some false alarms.
  // Assumes what the small model solves, the large one also solves (correlated difficulty),
  // so escalation can only recover the gap ql − qs, never exceed the large model.
  const casc = (qs: number, ql: number) => {
    const pEsc = (1 - qs) * d + qs * FALSE_ESCALATE
    const quality = qs + d * (ql - qs)
    return { pEsc, quality, cost: SMALL.cost + CHECK_COST + pEsc * LARGE.cost, latency: SMALL.latency + CHECK_LAT + pEsc * LARGE.latency }
  }
  const ce = casc(SMALL.qEasy, LARGE.qEasy)
  const ch = casc(SMALL.qHard, LARGE.qHard)
  const cascade = {
    id: 'cascade' as const, label: 'Cascade (small, then escalate)',
    cost: mix(e, ce.cost, ch.cost), quality: mix(e, ce.quality, ch.quality), latency: mix(e, ce.latency, ch.latency),
  }
  return [small, large, router, cascade]
}
