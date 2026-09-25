import { mulberry32 } from './lb-hash-ring-math'

// Toy model of routing card payments across two processors. Auth rates are illustrative.
export type Policy = 'primary' | 'split' | 'smart' | 'blind'
export type Outage = 'none' | 'down' | 'timeout'

export const PER_TICK = 20
export const HISTORY = 40
const AUTH = { A: 0.93, B: 0.9 } as const
const STATUS_CHECK_DELAY = 3
const PROBE_SHARE = 0.1
const TRIP_RATE = 0.3

export interface TickStats { ok: number; declined: number; failed: number; pending: number; doubled: number }
interface Pending { due: number; charged: boolean }

export interface SimState {
  tick: number
  breakerOpen: boolean
  pending: Pending[]
  history: TickStats[]
  totals: TickStats & { payments: number; callsA: number; callsB: number }
}

const zero = (): TickStats => ({ ok: 0, declined: 0, failed: 0, pending: 0, doubled: 0 })

export function initialState(): SimState {
  return { tick: 0, breakerOpen: false, pending: [], history: [], totals: { ...zero(), payments: 0, callsA: 0, callsB: 0 } }
}

/** Advance one tick: PER_TICK new payments plus any status checks that come due. */
export function step(s: SimState, policy: Policy, outage: Outage): SimState {
  const rng = mulberry32(1000 + s.tick * 7919)
  const t = zero()
  let callsA = 0; let callsB = 0; let failA = 0

  const attempt = (p: 'A' | 'B'): 'ok' | 'decline' | 'error' | 'timeout' => {
    if (p === 'A') {
      callsA++
      if (outage === 'down') { failA++; return 'error' }
      if (outage === 'timeout') { failA++; return 'timeout' }
    } else callsB++
    return rng() < AUTH[p] ? 'ok' : 'decline'
  }
  const onB = () => { if (attempt('B') === 'ok') t.ok++; else t.declined++ }

  // Status checks for earlier timeouts: charged → late success, not charged → safe to retry on B.
  const pending: Pending[] = []
  for (const p of s.pending) {
    if (p.due > s.tick) { pending.push(p); continue }
    if (p.charged) t.ok++
    else onB()
  }

  for (let i = 0; i < PER_TICK; i++) {
    const p: 'A' | 'B' =
      policy === 'split' ? (rng() < 0.5 ? 'A' : 'B')
      : policy === 'smart' && s.breakerOpen ? (rng() < PROBE_SHARE ? 'A' : 'B')
      : 'A'
    const r = attempt(p)
    if (r === 'ok') t.ok++
    else if (r === 'decline') t.declined++
    else if (r === 'error') {
      // A hard connection error means no charge happened, so a retry elsewhere is safe.
      if (policy === 'smart' || policy === 'blind') onB()
      else t.failed++
    } else {
      // A timeout is ambiguous: the processor may or may not have charged the card.
      const charged = rng() < 0.5
      if (policy === 'blind') {
        const r2 = attempt('B')
        if (r2 === 'ok') { t.ok++; if (charged) t.doubled++ } else t.declined++
      } else if (policy === 'smart') {
        t.pending++
        pending.push({ due: s.tick + STATUS_CHECK_DELAY, charged })
      } else t.failed++
    }
  }

  let breakerOpen = s.breakerOpen
  if (policy === 'smart') {
    const rate = callsA ? failA / callsA : 0
    if (!breakerOpen && callsA >= 3 && rate > TRIP_RATE) breakerOpen = true
    else if (breakerOpen && callsA > 0 && failA === 0) breakerOpen = false
  } else breakerOpen = false

  const tot = s.totals
  return {
    tick: s.tick + 1,
    breakerOpen,
    pending,
    history: [...s.history, t].slice(-HISTORY),
    totals: {
      ok: tot.ok + t.ok, declined: tot.declined + t.declined, failed: tot.failed + t.failed,
      pending: pending.length, doubled: tot.doubled + t.doubled,
      payments: tot.payments + PER_TICK, callsA: tot.callsA + callsA, callsB: tot.callsB + callsB,
    },
  }
}
