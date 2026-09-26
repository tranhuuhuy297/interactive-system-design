import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { CATALOG } from './studio-catalog'
import { CANVAS_H, CANVAS_W, NODE_H, NODE_W } from './studio-design-ops'
import { StudioEdges } from './studio-canvas-edges'
import { STUDIO_ICONS } from './studio-icons'
import { DRAG_TYPE, truncate } from './studio-labels'
import type { CompKind, Design, StudioEdge, StudioNode } from './studio-types'

export interface CanvasProps {
  design: Design
  ghost?: Design
  selectedId: string | null
  selectedEdge: StudioEdge | null
  connectFrom: string | null
  highlight: string[]
  utilById?: Map<string, number>
  onSelect: (id: string | null) => void
  onSelectEdge: (e: StudioEdge | null) => void
  onMove: (id: string, x: number, y: number) => void
  onConnectStart: (id: string | null) => void
  onConnect: (from: string, to: string) => void
  onDelete: (id: string) => void
  /** A palette item dropped on the canvas at canvas coordinates. */
  onDropKind: (kind: CompKind, x: number, y: number) => void
}

interface Drag { id: string; dx: number; dy: number; x: number; y: number; moved: boolean }

export function StudioCanvas(p: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: pt.x, y: pt.y }
  }

  const nodeDown = (e: PointerEvent, n: StudioNode) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const pt = toSvg(e)
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    setDrag({ id: n.id, dx: pt.x - n.x, dy: pt.y - n.y, x: n.x, y: n.y, moved: false })
  }
  const move = (e: PointerEvent) => {
    const pt = toSvg(e)
    if (p.connectFrom) setPointer(pt)
    if (!drag) return
    const x = pt.x - drag.dx
    const y = pt.y - drag.dy
    const moved = drag.moved || Math.abs(x - drag.x) + Math.abs(y - drag.y) > 3
    setDrag({ ...drag, x, y, moved })
  }
  const up = () => {
    if (!drag) return
    if (drag.moved) p.onMove(drag.id, drag.x, drag.y)
    else activate(drag.id)
    setDrag(null)
  }
  const activate = (id: string) => {
    if (p.connectFrom && p.connectFrom !== id) { p.onConnect(p.connectFrom, id); setPointer(null) }
    else p.onSelect(id)
  }

  const nodeKey = (e: KeyboardEvent, n: StudioNode) => {
    const step = e.shiftKey ? 40 : 10
    const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (nudge[e.key]) { e.preventDefault(); p.onMove(n.id, n.x + nudge[e.key][0], n.y + nudge[e.key][1]) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(n.id) }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); p.onDelete(n.id) }
    else if (e.key.toLowerCase() === 'c') { e.preventDefault(); p.onConnectStart(n.id) }
    else if (e.key === 'Escape') p.onConnectStart(null)
  }

  const pos = (n: StudioNode) => (drag && drag.id === n.id ? { x: drag.x, y: drag.y } : { x: n.x, y: n.y })
  const placed = p.design.nodes.map((n) => ({ ...n, ...pos(n) }))
  const from = p.connectFrom ? placed.find((n) => n.id === p.connectFrom) : null

  return (
    <svg ref={svgRef} className={`studio-canvas ${p.connectFrom ? 'is-connecting' : ''}`} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      role="application" aria-label="Design canvas" onPointerMove={move} onPointerUp={up}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault() }}
      onDrop={(e) => {
        const kind = e.dataTransfer.getData(DRAG_TYPE) as CompKind
        if (!(kind in CATALOG)) return
        e.preventDefault()
        const pt = toSvg(e)
        p.onDropKind(kind, pt.x - NODE_W / 2, pt.y - NODE_H / 2)
      }}
      onPointerDown={() => { p.onSelect(null); p.onSelectEdge(null); p.onConnectStart(null); setPointer(null) }}>
      <defs>
        <pattern id="studio-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" className="studio-dot" /></pattern>
        <marker id="studio-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="studio-arrowhead" /></marker>
        <marker id="studio-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="studio-arrowhead is-hot" /></marker>
      </defs>
      <rect width={CANVAS_W} height={CANVAS_H} fill="url(#studio-dots)" />
      {p.ghost && <GhostLayer design={p.ghost} />}
      <StudioEdges nodes={placed} edges={p.design.edges} selected={p.selectedEdge} onSelect={p.onSelectEdge} />
      {from && pointer && <line className="studio-rubber" x1={from.x + NODE_W} y1={from.y + NODE_H / 2} x2={pointer.x} y2={pointer.y} />}
      {placed.map((n) => {
        const item = CATALOG[n.kind]
        const Icon = STUDIO_ICONS[n.kind]
        const util = p.utilById?.get(n.id)
        const tone = util === undefined ? '' : util >= 1 ? 'is-over' : util >= 0.8 ? 'is-hot' : util > 0 ? 'is-ok' : ''
        const cls = ['studio-node', tone, p.selectedId === n.id ? 'is-selected' : '', p.highlight.includes(n.id) ? 'is-flagged' : '', p.connectFrom === n.id ? 'is-source' : ''].join(' ')
        const sub = n.kind === 'client' ? 'traffic source' : n.kind === 'cache' || n.kind === 'cdn' ? `×${n.units} · ${Math.round((n.hitRatio ?? item.defaultHit ?? 0) * 100)}% hit` : `×${n.units} ${item.unitLabel.split(' ')[0].toLowerCase()}`
        return (
          <g key={n.id} className={cls} tabIndex={0} role="button" transform={`translate(${n.x} ${n.y})`}
            aria-label={`${n.label || item.short}, ${item.name}, ${sub}${util !== undefined ? `, ${Math.round(util * 100)}% utilized` : ''}`}
            onPointerDown={(e) => nodeDown(e, n)} onKeyDown={(e) => nodeKey(e, n)}>
            <rect className="studio-node__box" width={NODE_W} height={NODE_H} rx={10} />
            <Icon x={11} y={14} width={20} height={20} className="studio-node__icon" aria-hidden />
            <text className="studio-node__label" x={40} y={21}>{truncate(n.label || item.short, 13)}</text>
            <text className="studio-node__sub" x={40} y={36}>{sub}</text>
            {util !== undefined && util > 0 && <rect className="studio-node__util" x={8} y={NODE_H - 5} width={(NODE_W - 16) * Math.min(1, util)} height={2.5} rx={1} />}
            <circle className="studio-node__handle" cx={NODE_W} cy={NODE_H / 2} r={7}
              onPointerDown={(e) => { e.stopPropagation(); p.onConnectStart(p.connectFrom === n.id ? null : n.id); setPointer(toSvg(e)) }}>
              <title>Connect from here</title>
            </circle>
          </g>
        )
      })}
    </svg>
  )
}

function GhostLayer({ design }: { design: Design }) {
  const byId = new Map(design.nodes.map((n) => [n.id, n]))
  return (
    <g className="studio-ghost" aria-hidden>
      {design.edges.map((e) => {
        const a = byId.get(e.from); const b = byId.get(e.to)
        return a && b ? <line key={`${e.from}>${e.to}`} x1={a.x + NODE_W / 2} y1={a.y + NODE_H / 2} x2={b.x + NODE_W / 2} y2={b.y + NODE_H / 2} /> : null
      })}
      {design.nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
          <rect width={NODE_W} height={NODE_H} rx={10} />
          <text x={NODE_W / 2} y={NODE_H / 2 + 4} textAnchor="middle">{truncate(n.label || CATALOG[n.kind].short, 16)}</text>
        </g>
      ))}
    </g>
  )
}

