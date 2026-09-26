import { CATALOG } from './studio-catalog'
import type { CompKind, Design, StudioNode } from './studio-types'

// Pure, immutable edits on a design. Canvas is 960 × 560 units; nodes are 132 × 48.
export const CANVAS_W = 960
export const CANVAS_H = 560
export const NODE_W = 132
export const NODE_H = 48

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function nextId(d: Design, kind: CompKind): string {
  let i = 1
  while (d.nodes.some((n) => n.id === `${kind}-${i}`)) i += 1
  return `${kind}-${i}`
}

/** First grid slot that does not overlap an existing node. */
export function freeSlot(d: Design): { x: number; y: number } {
  for (let col = 1; col < 6; col += 1) {
    for (let row = 0; row < 5; row += 1) {
      const x = 20 + col * 162
      const y = 40 + row * 106
      if (x + NODE_W > CANVAS_W) continue
      if (!d.nodes.some((n) => Math.abs(n.x - x) < NODE_W + 8 && Math.abs(n.y - y) < NODE_H + 8)) return { x, y }
    }
  }
  return { x: 400 + (d.nodes.length % 5) * 12, y: 250 + (d.nodes.length % 5) * 12 }
}

export function addNode(d: Design, kind: CompKind, at?: { x: number; y: number }): { design: Design; id: string } {
  const id = nextId(d, kind)
  const pos = at ?? freeSlot(d)
  const item = CATALOG[kind]
  const node: StudioNode = { id, kind, x: clamp(pos.x, 0, CANVAS_W - NODE_W), y: clamp(pos.y, 0, CANVAS_H - NODE_H), units: item.defaultUnits, ...(item.defaultHit !== undefined ? { hitRatio: item.defaultHit } : {}) }
  return { design: { ...d, nodes: [...d.nodes, node] }, id }
}

export const moveNode = (d: Design, id: string, x: number, y: number): Design => ({
  ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, x: clamp(Math.round(x), 0, CANVAS_W - NODE_W), y: clamp(Math.round(y), 0, CANVAS_H - NODE_H) } : n)),
})

export const updateNode = (d: Design, id: string, patch: Partial<Pick<StudioNode, 'label' | 'units' | 'hitRatio'>>): Design => ({
  ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch, units: clamp(Math.round(patch.units ?? n.units), 1, 999) } : n)),
})

export const removeNode = (d: Design, id: string): Design => ({
  nodes: d.nodes.filter((n) => n.id !== id), edges: d.edges.filter((e) => e.from !== id && e.to !== id),
})

export function connect(d: Design, from: string, to: string): Design {
  if (from === to || d.edges.some((e) => e.from === from && e.to === to)) return d
  if (!d.nodes.some((n) => n.id === from) || !d.nodes.some((n) => n.id === to)) return d
  return { ...d, edges: [...d.edges, { from, to }] }
}

export const disconnect = (d: Design, from: string, to: string): Design => ({
  ...d, edges: d.edges.filter((e) => !(e.from === from && e.to === to)),
})

/** Validate untrusted JSON (import) into a Design, or null if unusable. */
export function sanitizeDesign(raw: unknown): Design | null {
  const obj = raw as { nodes?: unknown; edges?: unknown; design?: unknown } | null
  const src = obj && typeof obj === 'object' && 'design' in obj ? (obj.design as typeof obj) : obj
  if (!src || !Array.isArray(src.nodes)) return null
  const nodes: StudioNode[] = []
  for (const n of src.nodes as Record<string, unknown>[]) {
    if (!n || typeof n.id !== 'string' || typeof n.kind !== 'string' || !(n.kind in CATALOG)) continue
    if (nodes.some((x) => x.id === n.id)) continue
    const hit = typeof n.hitRatio === 'number' ? clamp(n.hitRatio, 0, 1) : undefined
    nodes.push({
      id: n.id.slice(0, 40), kind: n.kind as CompKind,
      x: clamp(Number(n.x) || 0, 0, CANVAS_W - NODE_W), y: clamp(Number(n.y) || 0, 0, CANVAS_H - NODE_H),
      units: clamp(Math.round(Number(n.units) || 1), 1, 999),
      ...(typeof n.label === 'string' && n.label ? { label: n.label.slice(0, 40) } : {}),
      ...(hit !== undefined ? { hitRatio: hit } : {}),
    })
  }
  const ids = new Set(nodes.map((n) => n.id))
  const edges = (Array.isArray(src.edges) ? (src.edges as Record<string, unknown>[]) : [])
    .filter((e) => e && typeof e.from === 'string' && typeof e.to === 'string' && ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
    .map((e) => ({ from: e.from as string, to: e.to as string }))
  return nodes.length ? { nodes, edges } : null
}
