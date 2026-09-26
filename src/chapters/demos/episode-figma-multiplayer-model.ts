/** Toy multiplayer sync: one object, two clients, one authoritative server (after Figma's 2019 write-up). */

export type ClientId = 'A' | 'B'
export type Prop = 'fill' | 'x' | 'name'
export type Props = Record<Prop, string | number>
/** figma = last-writer-wins per property + ignore server echoes over unacked local edits. */
export type Mode = 'figma' | 'naive' | 'object'

export interface Msg { at: number; to: 'server' | ClientId; from: ClientId; editId: number; changes: Partial<Props>; prop: Prop }
export interface ClientState { view: Props; pending: Partial<Record<Prop, number>> }
export interface SimState {
  t: number
  server: Props
  A: ClientState
  B: ClientState
  inflight: Msg[]
  nextEdit: number
  flickers: number
  /** Last value each property was meant to get, in server arrival order. */
  intended: Partial<Props>
  log: string[]
}
export type Delays = Record<ClientId, number>
export interface ScheduledEdit { t: number; client: ClientId; prop: Prop; value: string | number }

export const PROPS: Prop[] = ['fill', 'x', 'name']
export const INITIAL: Props = { fill: 'Gray', x: 40, name: 'Card' }

export const createSim = (): SimState => ({
  t: 0, server: { ...INITIAL }, A: { view: { ...INITIAL }, pending: {} }, B: { view: { ...INITIAL }, pending: {} },
  inflight: [], nextEdit: 1, flickers: 0, intended: {}, log: [],
})

const pushLog = (s: SimState, line: string) => { s.log = [`t${s.t} · ${line}`, ...s.log].slice(0, 8) }

/** A client edits a property locally and sends it to the server. */
export function edit(prev: SimState, client: ClientId, prop: Prop, value: string | number, delays: Delays, mode: Mode): SimState {
  const s: SimState = structuredClone(prev)
  const c = s[client]
  c.view[prop] = value
  c.pending[prop] = s.nextEdit
  const changes: Partial<Props> = mode === 'object' ? { ...c.view } : { [prop]: value }
  s.inflight.push({ at: s.t + delays[client], to: 'server', from: client, editId: s.nextEdit, changes, prop })
  pushLog(s, `${client} sets ${prop} = ${value}`)
  s.nextEdit += 1
  return s
}

function receiveAtServer(s: SimState, m: Msg, delays: Delays) {
  Object.assign(s.server, m.changes)
  s.intended[m.prop] = m.changes[m.prop]
  pushLog(s, `server applies ${m.from}’s ${m.prop}`)
  for (const to of ['A', 'B'] as ClientId[]) {
    s.inflight.push({ at: s.t + delays[to], to, from: m.from, editId: m.editId, changes: m.changes, prop: m.prop })
  }
}

function receiveAtClient(s: SimState, m: Msg & { to: ClientId }, mode: Mode) {
  const c = s[m.to]
  const wasPending = { ...c.pending }
  // An echo of our own edit acknowledges it.
  if (m.from === m.to) for (const p of PROPS) if (c.pending[p] === m.editId) delete c.pending[p]
  for (const p of Object.keys(m.changes) as Prop[]) {
    const incoming = m.changes[p]!
    const guard = mode !== 'naive' && c.pending[p] !== undefined
    if (guard) continue
    if (c.view[p] !== incoming && wasPending[p] !== undefined && wasPending[p] !== m.editId) s.flickers += 1
    c.view[p] = incoming
  }
}

/** Advance one tick and deliver every message due by then. */
export function step(prev: SimState, delays: Delays, mode: Mode): SimState {
  const s: SimState = structuredClone(prev)
  s.t += 1
  const due = s.inflight.filter((m) => m.at <= s.t).sort((a, b) => a.at - b.at || a.editId - b.editId)
  s.inflight = s.inflight.filter((m) => m.at > s.t)
  for (const m of due) {
    if (m.to === 'server') receiveAtServer(s, m, delays)
    else receiveAtClient(s, m as Msg & { to: ClientId }, mode)
  }
  return s
}

const same = (a: Props, b: Props) => PROPS.every((p) => a[p] === b[p])

export const isConverged = (s: SimState) => s.inflight.length === 0 && same(s.A.view, s.server) && same(s.B.view, s.server)

/** Properties whose final server value is not the last edit the server received for them. */
export const lostEdits = (s: SimState): Prop[] =>
  PROPS.filter((p) => s.intended[p] !== undefined && s.server[p] !== s.intended[p])

export const SCENARIOS: Record<string, { label: string; edits: ScheduledEdit[] }> = {
  different: { label: 'Different properties', edits: [{ t: 0, client: 'A', prop: 'fill', value: 'Red' }, { t: 0, client: 'B', prop: 'x', value: 200 }] },
  same: { label: 'Same property', edits: [{ t: 0, client: 'A', prop: 'fill', value: 'Red' }, { t: 0, client: 'B', prop: 'fill', value: 'Blue' }] },
  drag: { label: 'Fast drag vs rename', edits: [
    { t: 0, client: 'A', prop: 'x', value: 100 }, { t: 1, client: 'A', prop: 'x', value: 160 }, { t: 2, client: 'A', prop: 'x', value: 220 },
    { t: 1, client: 'B', prop: 'x', value: 60 }, { t: 1, client: 'B', prop: 'name', value: 'Hero' },
  ] },
}

/** Run a scenario to completion (used by tests and the "run all" button). */
export function runScenario(key: keyof typeof SCENARIOS, delays: Delays, mode: Mode, maxTicks = 60): SimState {
  let s = createSim()
  const edits = SCENARIOS[key].edits
  for (let t = 0; t <= maxTicks; t++) {
    for (const e of edits.filter((x) => x.t === s.t)) s = edit(s, e.client, e.prop, e.value, delays, mode)
    if (s.t > Math.max(...edits.map((e) => e.t)) && isConverged(s)) break
    s = step(s, delays, mode)
  }
  return s
}
