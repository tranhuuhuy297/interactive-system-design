import { mulberry32 } from './lb-hash-ring-math'

// Toy flash-sale model: fixed stock, a burst of buyers, some of whom abandon payment.
export type Strategy = 'naive' | 'atomic' | 'reserve'

export const STOCK = 60
export const DEMAND = 300

interface Claim { payAt: number; willPay: boolean; expiresAt: number }

export interface InvState {
  tick: number
  stock: number
  arrived: number
  claims: Claim[]
  paid: number
  turnedAway: number
  lost: number
  released: number
  lateRejected: number
  done: boolean
}

export function initialInv(): InvState {
  return { tick: 0, stock: STOCK, arrived: 0, claims: [], paid: 0, turnedAway: 0, lost: 0, released: 0, lateRejected: 0, done: false }
}

export interface InvParams { strategy: Strategy; concurrency: number; abandonRate: number; ttl: number }

/** One tick: `concurrency` buyers hit checkout at once, then payments and holds resolve. */
export function stepInv(s: InvState, p: InvParams): InvState {
  if (s.done) return s
  const rng = mulberry32(42 + s.tick * 131)
  const n = { ...s, claims: [] as Claim[], tick: s.tick + 1 }
  const newClaim = (): Claim => ({
    payAt: s.tick + 1 + Math.floor(rng() * 4),
    willPay: rng() >= p.abandonRate,
    expiresAt: s.tick + p.ttl,
  })

  const buyers = Math.min(p.concurrency, DEMAND - s.arrived)
  n.arrived += buyers
  if (p.strategy === 'naive') {
    // Every concurrent buyer reads the same snapshot, then writes snapshot − 1 (lost updates).
    const snapshot = n.stock
    let won = 0
    for (let i = 0; i < buyers; i++) {
      if (snapshot > 0) { won++; n.claims.push(newClaim()) } else n.turnedAway++
    }
    if (won) n.stock = snapshot - 1
  } else {
    // Conditional decrement: UPDATE stock = stock - 1 WHERE stock > 0.
    for (let i = 0; i < buyers; i++) {
      if (n.stock > 0) { n.stock--; n.claims.push(newClaim()) } else n.turnedAway++
    }
  }

  // Resolve earlier claims (new ones from this tick are already in n.claims and not yet due).
  for (const c of s.claims) {
    const expired = p.strategy === 'reserve' && s.tick >= c.expiresAt
    if (expired) {
      // Hold timed out: unit goes back on sale; a later payment from this buyer is refused.
      n.stock++
      n.released++
      if (c.willPay) n.lateRejected++
    } else if (s.tick >= c.payAt) {
      if (c.willPay) n.paid++
      else if (p.strategy !== 'reserve') n.lost++ // abandoned checkout never returns its unit
      else { n.stock++; n.released++ }
    } else n.claims.push(c)
  }
  n.done = n.arrived >= DEMAND && n.claims.length === 0
  return n
}

export const oversold = (s: InvState) => Math.max(0, s.paid - STOCK)
