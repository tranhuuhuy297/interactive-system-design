import { CATALOG } from './studio-catalog'
import type { Design, StudioNode, StudioPrompt } from './studio-types'

// Pure load propagation: every edge carries its parent's full forwarded traffic (fan-out = 1 per edge),
// filtered by what the child can handle. Toy model for teaching, not a capacity planner.

export interface Flow { r: number; w: number }

export interface Graph {
  byId: Map<string, StudioNode>
  out: Map<string, string[]>
  onPath: Set<string>
  order: string[]
}

export function buildGraph(design: Design): Graph {
  const byId = new Map(design.nodes.map((n) => [n.id, n]))
  const out = new Map<string, string[]>(design.nodes.map((n) => [n.id, []]))
  for (const e of design.edges) {
    if (byId.has(e.from) && byId.has(e.to) && e.from !== e.to && !out.get(e.from)!.includes(e.to)) out.get(e.from)!.push(e.to)
  }
  // DFS from clients: reachable set plus a topological order that ignores back edges (cycles).
  const onPath = new Set<string>()
  const state = new Map<string, 1 | 2>()
  const post: string[] = []
  const visit = (id: string) => {
    state.set(id, 1)
    onPath.add(id)
    for (const c of out.get(id)!) if (!state.has(c)) visit(c)
    state.set(id, 2)
    post.push(id)
  }
  for (const n of design.nodes) if (n.kind === 'client' && !state.has(n.id)) visit(n.id)
  return { byId, out, onPath, order: post.reverse() }
}

export const hitOf = (n: StudioNode) => clamp01(n.hitRatio ?? CATALOG[n.kind].defaultHit ?? 0)
const isCachey = (n: StudioNode) => n.kind === 'cache' || n.kind === 'cdn'

/** Traffic that leaves a node after it absorbs what it can. */
export function forwarded(n: StudioNode, f: Flow, g: Graph): Flow {
  const hasKids = g.out.get(n.id)!.length > 0
  switch (n.kind) {
    case 'cdn':
    case 'cache':
      return hasKids ? { r: f.r * (1 - hitOf(n)), w: f.w } : { r: 0, w: 0 }
    case 'queue':
    case 'worker':
    case 'sql':
    case 'kv':
    case 'blob':
    case 'search':
      return { r: 0, w: f.w }
    default:
      return f
  }
}

/** Reads/writes arriving at each node on the request path. */
export function propagate(design: Design, prompt: StudioPrompt, g: Graph): Map<string, Flow> {
  const inbound = new Map<string, Flow>(design.nodes.map((n) => [n.id, { r: 0, w: 0 }]))
  const clients = design.nodes.filter((n) => n.kind === 'client')
  for (const c of clients) inbound.set(c.id, { r: prompt.req.readQps / clients.length, w: prompt.req.writeQps / clients.length })

  for (const id of g.order) {
    const n = g.byId.get(id)!
    const f = forwarded(n, inbound.get(id)!, g)
    const kids = g.out.get(id)!.map((k) => g.byId.get(k)!)
    // Cache-aside: a leaf cache/CDN beside other children serves hits; only misses reach the siblings.
    const asideMiss = kids.filter((k) => isCachey(k) && g.out.get(k.id)!.length === 0).reduce((m, k) => m * (1 - hitOf(k)), 1)
    for (const k of kids) {
      const item = CATALOG[k.kind]
      const leafCache = isCachey(k) && g.out.get(k.id)!.length === 0
      const r = item.serveReads ? (leafCache ? f.r : f.r * asideMiss) : 0
      const w = isCachey(k) ? (leafCache ? 0 : f.w) : item.acceptWrites ? f.w : 0
      const cur = inbound.get(k.id)!
      inbound.set(k.id, { r: cur.r + r, w: cur.w + w })
    }
  }
  return inbound
}

/** Utilization 0..∞ for one node (0 for managed, effectively unlimited components). */
export function utilization(n: StudioNode, f: Flow): { capacity: number; util: number } {
  const item = CATALOG[n.kind]
  if (!Number.isFinite(item.cap)) return { capacity: Number.POSITIVE_INFINITY, util: 0 }
  const units = Math.max(1, n.units)
  const capacity = item.cap * units
  if (item.writeCap) return { capacity, util: Math.max(f.r / capacity, f.w / item.writeCap) }
  return { capacity, util: (f.r + f.w) / capacity }
}

/** Typical read-path latency in ms; mild queueing penalty 1 + ρ². */
export function readLatency(g: Graph, flows: Map<string, Flow>): number {
  const memo = new Map<string, number>()
  const lat = (id: string, seen: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!
    if (seen.has(id)) return 0
    const n = g.byId.get(id)!
    const flow = flows.get(id)!
    const rho = Math.min(utilization(n, flow).util, 0.95)
    const base = CATALOG[n.kind].latencyMs * (1 + rho * rho)
    const next = new Set(seen).add(id)
    const kids = g.out.get(id)!.map((k) => g.byId.get(k)!).filter((k) => CATALOG[k.kind].serveReads && (flows.get(k.id)!.r > 0 || isCachey(k)))
    const leafCaches = kids.filter((k) => isCachey(k) && g.out.get(k.id)!.length === 0)
    const others = kids.filter((k) => !leafCaches.includes(k))
    const deepest = others.length ? Math.max(...others.map((k) => lat(k.id, next))) : 0
    let total = base
    if (isCachey(n) && g.out.get(id)!.length) total += (1 - hitOf(n)) * deepest
    else if (leafCaches.length) {
      const miss = leafCaches.reduce((m, k) => m * (1 - hitOf(k)), 1)
      total += Math.max(...leafCaches.map((k) => lat(k.id, next))) + miss * deepest
    } else total += deepest
    memo.set(id, total)
    return total
  }
  const clients = [...g.byId.values()].filter((n) => n.kind === 'client')
  return clients.length ? Math.max(...clients.map((c) => lat(c.id, new Set()))) : 0
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
