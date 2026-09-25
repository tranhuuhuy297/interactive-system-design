// Character-wise operational transformation with a central server (Jupiter / ot.js style).

export type Op =
  | { type: 'ins'; pos: number; ch: string; site: string }
  | { type: 'del'; pos: number; site: string }
  | { type: 'noop'; site: string }

export type Mode = 'ot' | 'naive'

export function applyOp(doc: string, op: Op): string {
  if (op.type === 'ins') return doc.slice(0, op.pos) + op.ch + doc.slice(op.pos)
  if (op.type === 'del') return op.pos < doc.length ? doc.slice(0, op.pos) + doc.slice(op.pos + 1) : doc
  return doc
}

/** Rewrite `a` so it applies after `b` (both were generated against the same state). */
export function transform(a: Op, b: Op): Op {
  if (a.type === 'noop' || b.type === 'noop') return a
  if (a.type === 'ins' && b.type === 'ins') {
    const aFirst = a.pos < b.pos || (a.pos === b.pos && a.site < b.site)
    return aFirst ? a : { ...a, pos: a.pos + 1 }
  }
  if (a.type === 'ins' && b.type === 'del') return a.pos <= b.pos ? a : { ...a, pos: a.pos - 1 }
  if (a.type === 'del' && b.type === 'ins') return a.pos < b.pos ? a : { ...a, pos: a.pos + 1 }
  // del vs del
  if (a.pos < b.pos) return a
  if (a.pos > b.pos) return { ...a, pos: a.pos - 1 }
  return { type: 'noop', site: a.site } // both deleted the same character
}

export function describe(op: Op): string {
  if (op.type === 'ins') return `ins(${op.pos}, "${op.ch === ' ' ? '␣' : op.ch}")`
  if (op.type === 'del') return `del(${op.pos})`
  return 'noop'
}

interface ClientState {
  site: string
  doc: string
  revision: number
  outstanding: Op | null
  buffer: Op[]
}

type Msg =
  | { to: 'server'; from: number; deliverAt: number; op: Op; baseRev: number }
  | { to: number; deliverAt: number; kind: 'ack' | 'remote'; op: Op }

export interface LogEntry { rev: number; site: string; sent: string; applied: string }

/** Two clients, one server, FIFO channels with a one-way delay per client. */
export class OtSimulation {
  mode: Mode
  now = 0
  serverDoc: string
  history: Op[] = []
  log: LogEntry[] = []
  clients: ClientState[]
  inflight: Msg[] = []
  delays: number[] = [600, 600]
  private lastDeliver = new Map<string, number>()

  constructor(initial: string, mode: Mode) {
    this.mode = mode
    this.serverDoc = initial
    this.clients = ['A', 'B'].map((site) => ({ site, doc: initial, revision: 0, outstanding: null, buffer: [] }))
  }

  private send(msg: Msg, channel: string, delay: number) {
    // Keep each channel FIFO even if the delay slider moves mid-flight.
    const at = Math.max(this.now + delay, (this.lastDeliver.get(channel) ?? 0) + 1)
    this.lastDeliver.set(channel, at)
    this.inflight.push({ ...msg, deliverAt: at })
  }

  private sendToServer(ci: number, op: Op) {
    const c = this.clients[ci]
    this.send({ to: 'server', from: ci, deliverAt: 0, op, baseRev: c.revision }, `up${ci}`, this.delays[ci])
  }

  /** User edit on a client: applied locally at once (optimistic), then sent. */
  localEdit(ci: number, op: Op) {
    const c = this.clients[ci]
    c.doc = applyOp(c.doc, op)
    if (this.mode === 'naive' || !c.outstanding) {
      if (this.mode === 'ot') c.outstanding = op
      this.sendToServer(ci, op)
    } else {
      c.buffer.push(op)
    }
  }

  private onServer(from: number, op: Op, baseRev: number) {
    let t = op
    if (this.mode === 'ot') for (const h of this.history.slice(baseRev)) t = transform(t, h)
    this.history.push(t)
    this.serverDoc = applyOp(this.serverDoc, t)
    this.log.push({ rev: this.history.length, site: op.site, sent: describe(op), applied: describe(t) })
    this.clients.forEach((_, ci) => {
      if (ci === from && this.mode === 'naive') return
      this.send({ to: ci, deliverAt: 0, kind: ci === from ? 'ack' : 'remote', op: t }, `down${ci}`, this.delays[ci])
    })
  }

  private onClient(ci: number, kind: 'ack' | 'remote', op: Op) {
    const c = this.clients[ci]
    if (this.mode === 'naive') { c.doc = applyOp(c.doc, op); return }
    c.revision += 1
    if (kind === 'ack') {
      c.outstanding = c.buffer.shift() ?? null
      if (c.outstanding) this.sendToServer(ci, c.outstanding)
      return
    }
    let r = op
    if (c.outstanding) { const o = c.outstanding; c.outstanding = transform(o, r); r = transform(r, o) }
    c.buffer = c.buffer.map((b) => { const nb = transform(b, r); r = transform(r, b); return nb })
    c.doc = applyOp(c.doc, r)
  }

  /** Advance the clock and deliver every message that is due, in time order. */
  advance(ms: number) {
    const until = this.now + ms
    for (;;) {
      const due = this.inflight.filter((m) => m.deliverAt <= until).sort((a, b) => a.deliverAt - b.deliverAt)[0]
      if (!due) break
      this.inflight.splice(this.inflight.indexOf(due), 1)
      this.now = due.deliverAt
      if (due.to === 'server') this.onServer(due.from, due.op, due.baseRev)
      else this.onClient(due.to, due.kind, due.op)
    }
    this.now = until
  }

  setDelay(ci: number, ms: number) { this.delays[ci] = ms }

  get quiescent() { return this.inflight.length === 0 }
  get converged() { return this.clients.every((c) => c.doc === this.serverDoc) }
}

/** Turn an input's before/after value into single-character ops. */
export function diffToOps(before: string, after: string, site: string): Op[] {
  let p = 0
  while (p < before.length && p < after.length && before[p] === after[p]) p++
  let s = 0
  while (s < before.length - p && s < after.length - p && before[before.length - 1 - s] === after[after.length - 1 - s]) s++
  const ops: Op[] = []
  for (let i = 0; i < before.length - p - s; i++) ops.push({ type: 'del', pos: p, site })
  const inserted = after.slice(p, after.length - s)
  for (let i = 0; i < inserted.length; i++) ops.push({ type: 'ins', pos: p + i, ch: inserted[i], site })
  return ops
}
