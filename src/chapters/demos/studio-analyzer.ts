import { CATALOG } from './studio-catalog'
import { buildGraph, propagate, readLatency, utilization, type Flow, type Graph } from './studio-load-model'
import type { Design, Finding, NodeLoad, RubricCheck, Severity, StudioPrompt, StudioReport } from './studio-types'

export const PENALTY: Record<Severity, number> = { critical: 18, warning: 7, info: 1 }
/** Toy rule of thumb: tail latency ≈ 2× the typical path. */
export const P99_FACTOR = 2
const STORAGE_YEARS = 3

const name = (d: Design, id: string) => {
  const n = d.nodes.find((x) => x.id === id)!
  return n.label || CATALOG[n.kind].short
}
const pct = (u: number) => `${Math.round(u * 100)}%`
const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}K` : `${Math.round(v)}`)

export function analyze(design: Design, prompt: StudioPrompt): StudioReport {
  const clients = design.nodes.filter((n) => n.kind === 'client')
  if (!clients.length) {
    return {
      score: 0, loads: [], passed: [], readLatencyMs: 0, staffMoves: [],
      findings: [{ id: 'no-client', severity: 'critical', title: 'Add Clients to start the request path', detail: 'Load is traced from Clients along your arrows, so nothing can be evaluated yet.', fix: 'Add a Clients node and connect it to your entry point.', chapter: 'framework' }],
    }
  }
  const g = buildGraph(design)
  const flows = propagate(design, prompt, g)
  const loads: NodeLoad[] = design.nodes.map((n) => {
    const f = flows.get(n.id)!
    const { capacity, util } = utilization(n, f)
    return { id: n.id, kind: n.kind, reads: f.r, writes: f.w, capacity, util, onPath: g.onPath.has(n.id) }
  })
  const findings: Finding[] = [
    ...(clients.every((c) => g.out.get(c.id)!.length === 0)
      ? [{ id: 'no-entry', severity: 'critical' as Severity, title: 'Clients have nowhere to send requests', detail: 'Nothing is connected to Clients yet.', fix: 'Add an entry point (load balancer, gateway, CDN, or WebSocket gateway) and connect Clients to it.', chapter: 'framework', nodeIds: clients.map((c) => c.id) }]
      : []),
    ...capacityFindings(design, loads),
    ...spofFindings(design, loads),
    ...queueFindings(design, g, flows),
    ...storageFindings(design, prompt, g, flows),
    ...orphanFindings(design, g),
  ]
  const latency = readLatency(g, flows)
  if (prompt.req.readQps > 0 && latency * P99_FACTOR > prompt.req.p99Ms) {
    findings.push({ id: 'latency', severity: 'warning', title: `Read p99 ≈ ${Math.round(latency * P99_FACTOR)} ms misses the ${prompt.req.p99Ms} ms target`, detail: `The typical read path is about ${Math.round(latency)} ms; tails run roughly ${P99_FACTOR}× longer, more when components run hot.`, fix: 'Serve hot reads from a cache or CDN, cut hops, or add capacity to busy components.', chapter: 'caching' })
  }
  const passed: string[] = []
  for (const c of prompt.checks) {
    if (checkPasses(c, design, g)) passed.push(c.label)
    else findings.push({ id: `check-${c.id}`, severity: 'warning', title: c.label, detail: 'This prompt needs it and your design does not have it yet.', fix: c.fix, chapter: c.chapter })
  }
  const order: Severity[] = ['critical', 'warning', 'info']
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
  const score = Math.max(0, Math.round(100 - findings.reduce((s, f) => s + PENALTY[f.severity], 0)))
  return { score, findings, loads, passed, readLatencyMs: latency, staffMoves: staffMoves(design, prompt, loads) }
}

function capacityFindings(d: Design, loads: NodeLoad[]): Finding[] {
  const out: Finding[] = []
  for (const l of loads) {
    if (!l.onPath || l.kind === 'worker' || !Number.isFinite(l.capacity)) continue
    const item = CATALOG[l.kind]
    const writeBound = item.writeCap !== undefined && l.writes / item.writeCap >= l.reads / l.capacity
    const fix = writeBound
      ? 'One primary takes every write: shard the data or move write-heavy tables to a partitioned store.'
      : `Add ${item.unitLabel.toLowerCase()}, put a cache in front, or split the traffic.`
    if (l.util >= 1) out.push({ id: `over-${l.id}`, severity: 'critical', title: `${name(d, l.id)} is overloaded (${pct(l.util)} of capacity)`, detail: `It receives ≈${fmt(l.reads)} reads/s and ${fmt(l.writes)} writes/s.`, fix, chapter: item.chapter, nodeIds: [l.id] })
    else if (l.util >= 0.8) out.push({ id: `hot-${l.id}`, severity: 'warning', title: `${name(d, l.id)} runs hot at ${pct(l.util)}`, detail: 'Above ~80% utilization, queueing makes latency climb fast and there is no headroom for a failure.', fix, chapter: item.chapter, nodeIds: [l.id] })
  }
  return out
}

function spofFindings(d: Design, loads: NodeLoad[]): Finding[] {
  return loads.flatMap((l) => {
    const n = d.nodes.find((x) => x.id === l.id)!
    const item = CATALOG[l.kind]
    if (!l.onPath || item.minHA === 0 || n.units >= item.minHA || l.reads + l.writes === 0) return []
    return [{ id: `spof-${l.id}`, severity: item.spofSeverity, title: `${name(d, l.id)} is a single point of failure`, detail: `${n.units} ${item.unitLabel.toLowerCase()}; surviving one failure needs at least ${item.minHA}.`, fix: `Run ${item.minHA}+ ${item.unitLabel.toLowerCase()} across failure zones.`, chapter: 'reliability', nodeIds: [l.id] }]
  })
}

function queueFindings(d: Design, g: Graph, flows: Map<string, Flow>): Finding[] {
  const out: Finding[] = []
  for (const q of d.nodes.filter((n) => n.kind === 'queue' && g.onPath.has(n.id))) {
    const inflow = flows.get(q.id)!.w
    const workers = g.out.get(q.id)!.map((id) => g.byId.get(id)!).filter((n) => n.kind === 'worker')
    if (!workers.length) {
      out.push({ id: `nocons-${q.id}`, severity: 'warning', title: `Nobody consumes ${name(d, q.id)}`, detail: 'Messages pile up with no worker reading them.', fix: 'Connect the queue to a worker pool.', chapter: 'messaging', nodeIds: [q.id] })
      continue
    }
    const drain = workers.reduce((s, w) => s + CATALOG.worker.cap * Math.max(1, w.units), 0)
    if (inflow > drain) out.push({ id: `drain-${q.id}`, severity: 'critical', title: `Workers drain ${fmt(drain)}/s but ${fmt(inflow)}/s arrive`, detail: 'The backlog grows without bound, so async work falls further behind every minute.', fix: 'Add worker replicas (and partitions so they can run in parallel).', chapter: 'messaging', nodeIds: [q.id, ...workers.map((w) => w.id)] })
    else if (inflow > 0.8 * drain) out.push({ id: `drainhot-${q.id}`, severity: 'warning', title: `Workers behind ${name(d, q.id)} run at ${pct(inflow / drain)}`, detail: 'No headroom to catch up after a spike or an outage.', fix: 'Add worker replicas.', chapter: 'messaging', nodeIds: workers.map((w) => w.id) })
  }
  return out
}

function storageFindings(d: Design, p: StudioPrompt, g: Graph, flows: Map<string, Flow>): Finding[] {
  const out: Finding[] = []
  const writing = d.nodes.filter((n) => g.onPath.has(n.id) && flows.get(n.id)!.w > 0)
  const structured = writing.filter((n) => n.kind === 'sql' || n.kind === 'kv')
  if (p.req.writeQps > 0 && !structured.length) {
    out.push({ id: 'no-store', severity: 'critical', title: 'Writes never reach a durable database', detail: 'No SQL or KV store receives the write traffic, so data would be lost on restart.', fix: 'Route writes from your service to a database.', chapter: 'databases' })
  }
  const need = p.req.storageTbPerYear * STORAGE_YEARS
  const have = structured.reduce((s, n) => s + (CATALOG[n.kind].storageShared ? CATALOG[n.kind].storageTb! : CATALOG[n.kind].storageTb! * Math.max(1, n.units)), 0)
  if (structured.length && need > have) {
    out.push({ id: 'storage', severity: 'warning', title: `Data outgrows storage: ${Math.round(need)} TB in ${STORAGE_YEARS} years vs ${Math.round(have)} TB`, detail: 'A single SQL primary cannot hold it; replicas copy data, they do not add space.', fix: 'Shard, or use a partitioned KV store with enough nodes.', chapter: 'databases', nodeIds: structured.map((n) => n.id) })
  }
  if (p.req.flags.largeBlobs && !writing.some((n) => n.kind === 'blob')) {
    out.push({ id: 'no-blob', severity: 'critical', title: 'Large media has nowhere cheap to live', detail: `≈${p.req.blobTbPerYear ?? 0} TB of media per year does not belong in a database.`, fix: 'Store media in object storage and keep only metadata in the database.', chapter: 'object-storage' })
  }
  return out
}

function orphanFindings(d: Design, g: Graph): Finding[] {
  return d.nodes.filter((n) => !g.onPath.has(n.id)).map((n) => ({ id: `orphan-${n.id}`, severity: 'info' as Severity, title: `${name(d, n.id)} is not on any request path`, detail: 'Nothing flows from Clients to it, so it is not evaluated.', fix: 'Connect it, or delete it.', nodeIds: [n.id] }))
}

export function checkPasses(c: RubricCheck, d: Design, g: Graph): boolean {
  const on = d.nodes.filter((n) => g.onPath.has(n.id) && c.kinds.includes(n.kind))
  switch (c.mode) {
    case 'present':
      return on.length > 0
    case 'fromClient':
      return d.nodes.some((n) => n.kind === 'client' && g.out.get(n.id)!.some((k) => c.kinds.includes(g.byId.get(k)!.kind)))
    case 'consumed':
      return on.some((n) => g.out.get(n.id)!.some((k) => g.byId.get(k)!.kind === 'worker'))
    case 'before':
      return on.some((n) => reaches(g, n.id, (id) => g.byId.get(id)!.kind === c.target))
  }
}

function reaches(g: Graph, from: string, match: (id: string) => boolean): boolean {
  const seen = new Set<string>()
  const stack = [...g.out.get(from)!]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    if (match(id)) return true
    stack.push(...g.out.get(id)!)
  }
  return false
}

function staffMoves(d: Design, p: StudioPrompt, loads: NodeLoad[]): string[] {
  const hot = loads.filter((l) => l.onPath && Number.isFinite(l.capacity)).sort((a, b) => b.util - a.util)[0]
  const moves = [...p.staffMoves]
  if (hot && hot.util >= 0.4) moves.unshift(`Next 10×: ${name(d, hot.id)} is already at ${pct(hot.util)}. Say out loud how it scales past that, and what breaks first.`)
  return moves.slice(0, 3)
}
