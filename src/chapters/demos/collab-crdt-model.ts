// Minimal RGA sequence CRDT: every character has a unique (lamport, site) id and remembers its left origin.

export interface CharId { c: number; s: string }
export interface Elem { id: CharId; ch: string; origin: CharId | null; deleted: boolean }

export type CrdtOp =
  | { kind: 'ins'; id: CharId; ch: string; origin: CharId | null }
  | { kind: 'del'; id: CharId }

export interface Replica { site: string; clock: number; elems: Elem[]; log: CrdtOp[]; seen: Set<string> }

export const idKey = (id: CharId) => `${id.c}@${id.s}`
const same = (a: CharId | null, b: CharId | null) => (a && b ? a.c === b.c && a.s === b.s : a === b)
// Higher lamport wins the spot closest to the origin; site id breaks ties deterministically.
const greater = (a: CharId, b: CharId) => a.c > b.c || (a.c === b.c && a.s > b.s)

export function createReplica(site: string, seed: Elem[]): Replica {
  const elems = seed.map((e) => ({ ...e }))
  return { site, clock: Math.max(0, ...elems.map((e) => e.id.c)), elems, log: [], seen: new Set(elems.map((e) => `ins:${idKey(e.id)}`)) }
}

export function seedElems(text: string, site = 'S'): Elem[] {
  return [...text].map((ch, i) => ({ id: { c: i + 1, s: site }, ch, origin: i ? { c: i, s: site } : null, deleted: false }))
}

function integrate(r: Replica, op: CrdtOp): boolean {
  const key = `${op.kind}:${idKey(op.id)}`
  if (r.seen.has(key)) return true
  if (op.kind === 'del') {
    const e = r.elems.find((x) => same(x.id, op.id))
    if (!e) return false // insert not seen yet; retry later
    e.deleted = true
  } else {
    let i = op.origin ? r.elems.findIndex((x) => same(x.id, op.origin)) + 1 : 0
    if (op.origin && i === 0) return false
    while (i < r.elems.length && greater(r.elems[i].id, op.id)) i++
    r.elems.splice(i, 0, { id: op.id, ch: op.ch, origin: op.origin, deleted: false })
    r.clock = Math.max(r.clock, op.id.c)
  }
  r.seen.add(key)
  return true
}

export const visible = (r: Replica) => r.elems.filter((e) => !e.deleted)
export const text = (r: Replica) => visible(r).map((e) => e.ch).join('')

/** Insert `ch` at visible index `index` on replica `r`. */
export function localInsert(r: Replica, index: number, ch: string) {
  const vis = visible(r)
  const origin = index > 0 ? vis[index - 1].id : null
  const op: CrdtOp = { kind: 'ins', id: { c: r.clock + 1, s: r.site }, ch, origin }
  integrate(r, op)
  r.log.push(op)
}

export function localDelete(r: Replica, id: CharId) {
  const op: CrdtOp = { kind: 'del', id }
  integrate(r, op)
  r.log.push(op)
}

/** Apply every op from `from` that `to` hasn't integrated yet (retrying until causal deps arrive). */
export function pull(to: Replica, from: Replica) {
  let pending = from.log.filter((op) => !to.seen.has(`${op.kind}:${idKey(op.id)}`))
  for (let guard = 0; pending.length && guard < 50; guard++) {
    pending = pending.filter((op) => !integrate(to, op))
  }
  for (const op of from.log) if (!to.log.some((o) => o.kind === op.kind && same(o.id, op.id))) to.log.push(op)
}

export function cloneReplica(r: Replica): Replica {
  return { ...r, elems: r.elems.map((e) => ({ ...e })), log: [...r.log], seen: new Set(r.seen) }
}
