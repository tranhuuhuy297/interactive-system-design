import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Cloud, Cog, Database, Globe, HardDrive, ListOrdered, Monitor, Search, Server, Split, Zap,
} from 'lucide-react'
import { Segmented } from './form-controls'
import { useMediaQuery } from '../../lib/use-media-query'

export type ArchKind =
  | 'client' | 'cdn' | 'lb' | 'service' | 'cache' | 'db' | 'queue' | 'storage' | 'worker' | 'external' | 'search'

export interface ArchNode {
  id: string
  label: string
  sub?: string
  kind: ArchKind
  /** Center position in percent of the canvas (0–100). */
  x: number
  y: number
  detail?: ReactNode
}

export interface ArchEdge {
  from: string
  to: string
  label?: string
  /** Async edge (queue/event) — drawn dashed. */
  async?: boolean
}

export interface ArchFlow {
  name: string
  /** Ordered node ids a request travels through. */
  path: string[]
  /** Optional narration per hop; steps[i] describes path[i] → path[i+1]. */
  steps?: string[]
}

const ICONS: Record<ArchKind, LucideIcon> = {
  client: Monitor, cdn: Globe, lb: Split, service: Server, cache: Zap, db: Database,
  queue: ListOrdered, storage: HardDrive, worker: Cog, external: Cloud, search: Search,
}

interface ArchitectureDiagramProps {
  nodes: ArchNode[]
  edges: ArchEdge[]
  flows?: ArchFlow[]
  /** Canvas height in px (width is fluid). */
  height?: number
  caption?: string
  /** Node ids to mark as newly added (episode stages). */
  added?: string[]
}

/** Interactive architecture diagram: click nodes for details, pick a flow to animate requests. */
export function ArchitectureDiagram({ nodes, edges, flows = [], height = 380, caption, added = [] }: ArchitectureDiagramProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [flowName, setFlowName] = useState(flows[0]?.name ?? '')
  const [selected, setSelected] = useState<string | null>(null)
  const markerId = `arch-arrow-${useId().replace(/:/g, '')}`
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    // Measure synchronously so the first paint uses the real width, not the fallback.
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  // Clamp centres so fixed-width nodes never spill past the canvas edge, whatever the data says.
  const px = (n: ArchNode) => ({
    x: clamp((n.x / 100) * width, HALF_W + 4, width - HALF_W - 4),
    y: clamp((n.y / 100) * height, HALF_H + 6, height - HALF_H - 6),
  })
  const flow = flows.find((f) => f.name === flowName)

  const onFlow = new Set<string>()
  const hopKey = (a: string, b: string) => `${a}>${b}`
  const activeHops = new Set<string>()
  flow?.path.forEach((id, i) => {
    onFlow.add(id)
    if (i > 0) { activeHops.add(hopKey(flow.path[i - 1], id)); activeHops.add(hopKey(id, flow.path[i - 1])) }
  })

  const flowPath = flow
    ? flow.path.map((id, i) => { const p = px(byId[id]); return `${i ? 'L' : 'M'}${p.x},${p.y}` }).join(' ')
    : ''
  const dur = flow ? (flow.path.length - 1) * 1.1 : 0
  const sel = selected ? byId[selected] : null

  return (
    <figure className="arch">
      {flows.length > 1 && (
        <div className="arch__bar">
          <span className="demo-label">Trace a request</span>
          <Segmented label="Flow" options={flows.map((f) => f.name)} value={flowName} onChange={setFlowName} />
        </div>
      )}
      <div className="arch__scroll">
      <div className="arch__canvas" ref={wrapRef} style={{ height }}>
        {/* Keyed so the SMIL timeline (packet stagger) restarts from zero on flow or size change. */}
        <svg key={`${flowName}-${Math.round(width)}`} width={width} height={height} className="arch__svg" aria-hidden>
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>
          {edges.map((e) => {
            const a = byId[e.from]; const b = byId[e.to]
            if (!a || !b) return null
            const [p1, p2] = clipToBoxes(px(a), px(b))
            const hot = activeHops.has(hopKey(e.from, e.to))
            const fresh = added.includes(e.from) || added.includes(e.to)
            return (
              <g key={`${e.from}-${e.to}`} className={`arch__edge ${hot ? 'is-hot' : ''} ${e.async ? 'is-async' : ''} ${fresh ? 'is-new' : ''}`}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} markerEnd={`url(#${markerId})`} />
                {e.label && <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 6} textAnchor="middle">{e.label}</text>}
              </g>
            )
          })}
          {flow && !reducedMotion && [0, 1, 2].map((k) => (
            <circle key={`${flow.name}-${k}-${width}`} r="5" className="arch__packet" visibility="hidden">
              {/* Hidden until its staggered start so it doesn't sit at the SVG origin. */}
              <set attributeName="visibility" to="visible" begin={`${k * (dur / 3)}s`} fill="freeze" />
              <animateMotion dur={`${dur}s`} begin={`${k * (dur / 3)}s`} repeatCount="indefinite" path={flowPath} />
            </circle>
          ))}
        </svg>
        {nodes.map((n) => {
          const Icon = ICONS[n.kind]
          const p = px(n)
          const dim = flow && !onFlow.has(n.id)
          return (
            <button key={n.id} className={`arch__node arch__node--${n.kind} ${selected === n.id ? 'is-selected' : ''} ${dim ? 'is-dim' : ''} ${added.includes(n.id) ? 'is-new' : ''}`}
              style={{ left: p.x, top: p.y }} onClick={() => setSelected(selected === n.id ? null : n.id)}
              aria-pressed={selected === n.id} title={n.sub ? `${n.label} — ${n.sub}` : n.label}>
              <Icon size={16} />
              <span className="arch__label">{n.label}{n.sub && <small>{n.sub}</small>}</span>
            </button>
          )
        })}
      </div>
      </div>
      {flow?.steps && <FlowSteps key={flow.name} steps={flow.steps} hops={flow.path.length - 1} animate={!reducedMotion} />}
      {sel && (
        <div className="arch__detail" key={sel.id}>
          <strong>{sel.label}</strong>
          <div>{sel.detail ?? <span className="muted">No extra notes for this component.</span>}</div>
        </div>
      )}
      {caption && <figcaption>{caption}{nodes.some((n) => n.detail) && ' · Click any component for details.'}</figcaption>}
    </figure>
  )
}

type Pt = { x: number; y: number }
// Approximate node half-size; keeps arrowheads at the node border instead of hidden under it.
const HALF_W = 62
const HALF_H = 20

function clipToBoxes(a: Pt, b: Pt): [Pt, Pt] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.min(dx ? HALF_W / Math.abs(dx) : Infinity, dy ? HALF_H / Math.abs(dy) : Infinity)
  if (!Number.isFinite(t) || t >= 0.5) return [a, b]
  return [{ x: a.x + dx * t, y: a.y + dy * t }, { x: b.x - dx * t, y: b.y - dy * t }]
}

/** Narrated hop list; remounted per flow so the highlight starts in sync with the packets. */
function FlowSteps({ steps, hops, animate }: { steps: string[]; hops: number; animate: boolean }) {
  const [step, setStep] = useState(animate ? 0 : -1)
  useEffect(() => {
    if (!animate || hops < 1) return
    const t = setInterval(() => setStep((i) => (i + 1) % hops), 1100)
    return () => clearInterval(t)
  }, [animate, hops])
  return (
    <ol className="arch__steps">
      {steps.map((s, i) => <li key={i} className={i === step ? 'is-active' : ''}><span>{i + 1}</span>{s}</li>)}
    </ol>
  )
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
