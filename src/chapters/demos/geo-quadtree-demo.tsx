import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { buildQuadtree, flattenQuadtree, queryQuadtree } from './geo-models'
import type { Pt } from './geo-models'
import './geo-demos.css'

let seed = 7
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const randomPts = (n: number): Pt[] => Array.from({ length: n }, () => ({ x: rnd() * 99.9, y: rnd() * 99.9 }))
const clusterPts = (n: number): Pt[] => Array.from({ length: n }, () => ({
  x: Math.min(99.9, Math.max(0, 30 + (rnd() + rnd() + rnd() - 1.5) * 18)),
  y: Math.min(99.9, Math.max(0, 60 + (rnd() + rnd() + rnd() - 1.5) * 18)),
}))

export function GeoQuadtreeDemo() {
  const [points, setPoints] = useState<Pt[]>(() => [...randomPts(40), ...clusterPts(80)])
  const [capacity, setCapacity] = useState(4)
  const [qx, setQx] = useState(22)
  const [qy, setQy] = useState(52)
  const [qs, setQs] = useState(20)

  const root = useMemo(() => buildQuadtree(points, capacity), [points, capacity])
  const nodes = useMemo(() => flattenQuadtree(root), [root])
  // Clamp so growing the box never pushes it past the map edge.
  const rect = { x: Math.min(qx, 100 - qs), y: Math.min(qy, 100 - qs), w: qs, h: qs }
  const q = queryQuadtree(root, rect)
  const leaves = nodes.filter((n) => !n.children)
  const depth = Math.max(...nodes.map((n) => n.depth))

  const addAt = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const clamp = (v: number) => Math.min(99.9, Math.max(0, v)) // x = 100 would fall outside every child quadrant
    setPoints((p) => [...p, { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) }])
  }
  const reset = () => { seed = 7; setPoints([...randomPts(40), ...clusterPts(80)]); setCapacity(4); setQx(22); setQy(52); setQs(20) }
  const foundSet = new Set(q.found)

  return (
    <DemoFrame title="Quadtree: split only where the density is" onReset={reset}
      hint="Click the map to add businesses. Dense downtown areas split deeply while empty areas stay as one big leaf. The query box only descends into overlapping nodes.">
      <div className="geo__layout">
        <svg viewBox="0 0 100 100" className="geo__qt" onClick={addAt} role="img" aria-label={`Quadtree with ${points.length} points and ${leaves.length} leaves`}>
          {nodes.map((n, i) => <rect key={i} x={n.x} y={n.y} width={n.size} height={n.size} className={`geo__qnode d${Math.min(n.depth, 5)}`} />)}
          <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} className="geo__qrect" />
          {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="0.9" className={foundSet.has(p) ? 'geo__pt is-found' : 'geo__pt'} />)}
        </svg>
        <div className="demo-controls">
          <div className="geo__btns">
            <button className="btn btn--secondary btn--sm" onClick={() => setPoints((p) => [...p, ...randomPts(25)])}>+25 random</button>
            <button className="btn btn--secondary btn--sm" onClick={() => setPoints((p) => [...p, ...clusterPts(40)])}>+40 downtown</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setPoints([])}>Clear</button>
          </div>
          <Slider label="Leaf capacity" min={1} max={16} value={capacity} onChange={setCapacity} />
          <Slider label="Query x" min={0} max={100 - qs} value={rect.x} onChange={setQx} />
          <Slider label="Query y" min={0} max={100 - qs} value={rect.y} onChange={setQy} />
          <Slider label="Query size" min={4} max={60} value={qs} onChange={setQs} />
          <dl className="geo__facts geo__facts--tight">
            <div><dt>Points / leaves / depth</dt><dd>{points.length} / {leaves.length} / {depth}</dd></div>
            <div><dt>Nodes visited</dt><dd>{q.visited} of {nodes.length}</dd></div>
            <div><dt>Points distance-checked</dt><dd>{q.checked} (brute force: {points.length})</dd></div>
            <div><dt>Found in box</dt><dd>{q.found.length}</dd></div>
          </dl>
        </div>
      </div>
    </DemoFrame>
  )
}
