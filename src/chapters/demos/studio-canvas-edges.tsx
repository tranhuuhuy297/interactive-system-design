import { NODE_H, NODE_W } from './studio-design-ops'
import type { StudioEdge, StudioNode } from './studio-types'

const HW = NODE_W / 2
const HH = NODE_H / 2

/** Clip a centre-to-centre segment to both node borders so arrowheads stay visible. */
function segment(a: StudioNode, b: StudioNode) {
  const ax = a.x + HW, ay = a.y + HH, bx = b.x + HW, by = b.y + HH
  const dx = bx - ax, dy = by - ay
  const t = Math.min(dx ? HW / Math.abs(dx) : Infinity, dy ? HH / Math.abs(dy) : Infinity)
  if (!Number.isFinite(t) || t >= 0.5) return { x1: ax, y1: ay, x2: bx, y2: by }
  return { x1: ax + dx * t, y1: ay + dy * t, x2: bx - dx * (t + 0.02), y2: by - dy * (t + 0.02) }
}

interface EdgesProps {
  nodes: StudioNode[]
  edges: StudioEdge[]
  selected: StudioEdge | null
  onSelect: (e: StudioEdge | null) => void
}

export function StudioEdges({ nodes, edges, selected, onSelect }: EdgesProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return (
    <g className="studio-edges">
      {edges.map((e) => {
        const a = byId.get(e.from); const b = byId.get(e.to)
        if (!a || !b) return null
        const s = segment(a, b)
        const isSel = selected?.from === e.from && selected?.to === e.to
        return (
          <g key={`${e.from}>${e.to}`} className={`studio-edge ${isSel ? 'is-selected' : ''}`}
            onPointerDown={(ev) => { ev.stopPropagation(); onSelect(e) }}>
            <line className="studio-edge__hit" {...s} />
            <line className="studio-edge__line" {...s} markerEnd={`url(#${isSel ? 'studio-arrow-hot' : 'studio-arrow'})`} />
          </g>
        )
      })}
    </g>
  )
}
