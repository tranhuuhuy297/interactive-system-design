// Simplified single-partition replication in the style of Kafka: leader, followers, ISR, high watermark.
// Time is in ticks; the producer sends one record per tick. Constants are illustrative.

export type Acks = '0' | '1' | 'all'

export interface Replica {
  id: string
  /** Log end offset: number of records this replica holds. */
  leo: number
  alive: boolean
  /** Records fetched per tick (followers only). */
  rate: number
  /** Fractional fetch progress carried between ticks. */
  carry: number
}

export interface ReplState {
  replicas: Replica[]
  leader: string | null
  isr: string[]
  hw: number
  /** Offsets the producer was told were written. */
  acked: Set<number>
  /** Offsets the leader has appended but not yet acked (acks=all waits on the HW). */
  pending: number[]
  rejected: number
  lostAcked: number
  offline: boolean
  events: string[]
}

export interface ReplConfig { acks: Acks; minIsr: number; maxLag: number; unclean: boolean }

export function initState(rates: number[] = [1, 0.5]): ReplState {
  return {
    replicas: [{ id: 'B1', leo: 0, alive: true, rate: 0, carry: 0 }, ...rates.map((r, i) => ({ id: `B${i + 2}`, leo: 0, alive: true, rate: r, carry: 0 }))],
    leader: 'B1', isr: ['B1', ...rates.map((_, i) => `B${i + 2}`)], hw: 0,
    acked: new Set(), pending: [], rejected: 0, lostAcked: 0, offline: false, events: [],
  }
}

const clone = (s: ReplState): ReplState => ({
  ...s, replicas: s.replicas.map((r) => ({ ...r })), isr: [...s.isr], acked: new Set(s.acked), pending: [...s.pending], events: [...s.events],
})

const byId = (s: ReplState, id: string | null) => s.replicas.find((r) => r.id === id)

function refresh(s: ReplState, cfg: ReplConfig) {
  const leader = byId(s, s.leader)
  if (!leader) return
  // A follower stays in the ISR while it is alive and within maxLag records of the leader.
  s.isr = s.replicas.filter((r) => r.alive && (r.id === s.leader || leader.leo - r.leo <= cfg.maxLag)).map((r) => r.id)
  s.hw = Math.min(...s.isr.map((id) => byId(s, id)!.leo))
  // acks=all confirms only once the HW passes the record AND enough replicas are in sync;
  // otherwise the broker answers NOT_ENOUGH_REPLICAS_AFTER_APPEND and the record stays unconfirmed.
  if (cfg.acks === 'all' && s.isr.length >= cfg.minIsr) {
    for (const off of s.pending.filter((o) => o < s.hw)) s.acked.add(off)
    s.pending = s.pending.filter((o) => o >= s.hw)
  }
}

/** One tick: the producer sends a record, then followers fetch. */
export function tick(prev: ReplState, cfg: ReplConfig): ReplState {
  const s = clone(prev)
  const leader = byId(s, s.leader)
  if (!leader || s.offline) { s.rejected++; return s }
  if (cfg.acks === 'all' && s.isr.length < cfg.minIsr) {
    s.rejected++
    s.events.push(`Write rejected: ISR has ${s.isr.length} replica(s), min.insync.replicas = ${cfg.minIsr}`)
  } else {
    const off = leader.leo++
    if (cfg.acks === 'all') s.pending.push(off)
    else s.acked.add(off) // acks=1 acks on the leader's append; acks=0 never waits at all
  }
  for (const f of s.replicas) {
    if (!f.alive || f.id === s.leader) continue
    f.carry += f.rate
    const n = Math.min(Math.floor(f.carry), leader.leo - f.leo)
    f.carry -= Math.floor(f.carry)
    f.leo += Math.max(0, n)
  }
  refresh(s, cfg)
  return s
}

/** Kill the leader and elect a new one: from the ISR, or any live replica if unclean election is on. */
export function killLeader(prev: ReplState, cfg: ReplConfig): ReplState {
  const s = clone(prev)
  const old = byId(s, s.leader)
  if (!old) return s
  old.alive = false
  const live = s.replicas.filter((r) => r.alive)
  const clean = live.filter((r) => s.isr.includes(r.id)).sort((a, b) => b.leo - a.leo)
  const next = clean[0] ?? (cfg.unclean ? [...live].sort((a, b) => b.leo - a.leo)[0] : undefined)
  if (!next) {
    s.leader = null; s.offline = true
    s.events.push(`${old.id} died. No in-sync replica left: partition offline until ${old.id} returns.`)
    return s
  }
  s.leader = next.id
  // Everything past the new leader's log end is gone: followers truncate to match it.
  for (const r of live) r.leo = Math.min(r.leo, next.leo)
  const lost = [...s.acked].filter((o) => o >= next.leo)
  lost.forEach((o) => s.acked.delete(o))
  s.lostAcked += lost.length
  s.pending = s.pending.filter((o) => o < next.leo)
  s.events.push(`${old.id} died. ${next.id} elected${clean[0] ? '' : ' (unclean)'} with ${next.leo} records; ${lost.length} acknowledged record(s) lost.`)
  refresh(s, cfg)
  return s
}

/** Restart dead brokers; they rejoin as followers (or lead again if the partition was offline). */
export function reviveAll(prev: ReplState, cfg: ReplConfig): ReplState {
  const s = clone(prev)
  const dead = s.replicas.filter((r) => !r.alive)
  if (!dead.length) return s
  dead.forEach((r) => { r.alive = true; r.carry = 0; if (!r.rate) r.rate = 1 })
  if (s.offline) {
    const best = [...s.replicas].sort((a, b) => b.leo - a.leo)[0]
    s.leader = best.id; s.offline = false
    s.events.push(`${dead.map((r) => r.id).join(', ')} restarted. ${best.id} leads again; nothing acknowledged was lost.`)
  } else {
    const leo = byId(s, s.leader)!.leo
    dead.forEach((r) => { r.leo = Math.min(r.leo, leo) })
    s.events.push(`${dead.map((r) => r.id).join(', ')} restarted as follower(s), truncated to the leader's log, and started catching up.`)
  }
  refresh(s, cfg)
  return s
}
