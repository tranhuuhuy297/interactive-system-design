import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, DemoFrame, Segmented } from '../../components/ui'
import { COLS, ROWS, TRAFFIC_COST, emptyGrid, idx, presetGrid, search } from './maps-routing-model'
import type { Algo, Cell } from './maps-routing-model'
import './maps-demos.css'

const START = idx(6, 1)
const GOAL = idx(6, 20)
type Brush = 'wall' | 'traffic' | 'road'

export function MapsRoutingVisualizerDemo() {
  const [grid, setGrid] = useState<Cell[]>(presetGrid)
  const [algo, setAlgo] = useState<Algo>('astar')
  const [brush, setBrush] = useState<Brush>('traffic')
  const [step, setStep] = useState(Infinity) // how many visited cells to reveal
  const painting = useRef(false)

  const results = useMemo(() => ({
    dijkstra: search(grid, START, GOAL, 'dijkstra'),
    astar: search(grid, START, GOAL, 'astar'),
  }), [grid])
  const res = results[algo]

  useEffect(() => {
    if (step >= res.visited.length) return
    const t = setTimeout(() => setStep((s) => s + 3), 16)
    return () => clearTimeout(t)
  }, [step, res.visited.length])

  const run = () => setStep(0)
  const paint = (i: number) => {
    if (i === START || i === GOAL) return
    setGrid((g) => (g[i] === brush ? g : g.map((c, j) => (j === i ? brush : c))))
    setStep(Infinity)
  }

  const visitedSet = new Set(res.visited.slice(0, step))
  const done = step >= res.visited.length
  const pathSet = new Set(done ? res.path : [])

  return (
    <DemoFrame title="Route planner: Dijkstra vs A*" onReset={() => { setGrid(presetGrid()); setStep(Infinity) }}
      hint="Drag on the map to paint walls (river, closed roads) or traffic (cost ×5). Press Run to animate the search.">
      <div className="maps-rt__bar">
        <Segmented label="Algorithm" value={algo} onChange={(a) => { setAlgo(a); setStep(Infinity) }}
          options={[{ value: 'dijkstra', label: 'Dijkstra' }, { value: 'astar', label: 'A*' }]} />
        <Segmented label="Brush" value={brush} onChange={setBrush}
          options={[{ value: 'traffic', label: 'Traffic' }, { value: 'wall', label: 'Wall' }, { value: 'road', label: 'Erase' }]} />
        <Button size="sm" variant="primary" onClick={run}>Run</Button>
        <Button size="sm" variant="ghost" onClick={() => { setGrid(emptyGrid()); setStep(Infinity) }}>Clear map</Button>
      </div>

      <div className="maps-rt__grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} aria-hidden
        onPointerLeave={() => { painting.current = false }} onPointerUp={() => { painting.current = false }}>
        {grid.map((cell, i) => {
          const cls = i === START ? 'is-start' : i === GOAL ? 'is-goal' : pathSet.has(i) ? 'is-path' : visitedSet.has(i) ? 'is-visited' : ''
          return (
            <span key={i} className={`maps-rt__cell maps-rt__cell--${cell} ${cls}`}
              onPointerDown={(e) => { e.preventDefault(); painting.current = true; paint(i) }}
              onPointerEnter={() => { if (painting.current) paint(i) }} />
          )
        })}
      </div>

      <div className="maps-rt__stats">
        {(['dijkstra', 'astar'] as const).map((a) => (
          <div key={a} className={a === algo ? 'is-active' : ''}>
            <span className="maps-rt__label">{a === 'astar' ? 'A*' : 'Dijkstra'}</span>
            <span><b className="mono">{results[a].visited.length}</b> nodes settled</span>
            <span><b className="mono">{Number.isFinite(results[a].cost) ? results[a].cost : '∞'}</b> path cost</span>
          </div>
        ))}
      </div>
      <p className="maps-note" role="status">
        {Number.isFinite(res.cost)
          ? `Both find the same optimal cost; A* settles ${Math.round((1 - results.astar.visited.length / Math.max(1, results.dijkstra.visited.length)) * 100)}% fewer nodes by aiming at the goal. Traffic cells cost ${TRAFFIC_COST}.`
          : 'No route: the goal is walled off. Erase a wall to reopen a bridge.'}
        {' '}Grid is {ROWS}×{COLS}; real road graphs have hundreds of millions of edges.
      </p>
    </DemoFrame>
  )
}
