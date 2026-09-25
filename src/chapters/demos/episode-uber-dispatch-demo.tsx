import { useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import {
  GRID_H, GRID_W, batchedMatch, eta, greedyMatch, makeScenario, type Assignment,
} from './episode-uber-dispatch-model'
import './episode-uber-demos.css'

type View = 'greedy' | 'batched'
const CELL = 30
const DEFAULT_SEED = 87

export function EpisodeUberDispatchDemo() {
  const [seed, setSeed] = useState(DEFAULT_SEED)
  const [riders, setRiders] = useState(5)
  const [drivers, setDrivers] = useState(7)
  const [view, setView] = useState<View>('greedy')

  const scenario = useMemo(() => makeScenario(seed, riders, drivers), [seed, riders, drivers])
  const greedy = useMemo(() => greedyMatch(scenario), [scenario])
  const batched = useMemo(() => batchedMatch(scenario), [scenario])
  const shown = view === 'greedy' ? greedy : batched
  const saved = greedy.total - batched.total

  const reset = () => { setSeed(DEFAULT_SEED); setRiders(5); setDrivers(7); setView('greedy') }
  const c = (v: number) => v * CELL + CELL / 2

  return (
    <DemoFrame title="Dispatch: nearest driver vs batched matching" onReset={reset}
      hint="Riders (squares, numbered by request time) and free drivers (dots) on a street grid. Greedy serves riders one at a time; batched waits a moment and solves all pickups together. Toy model: ETA = blocks × 0.5 min.">
      <div className="uber-dp">
        <div className="demo-controls">
          <Segmented label="Matching strategy" value={view} onChange={setView}
            options={[{ value: 'greedy', label: 'Greedy nearest' }, { value: 'batched', label: 'Batched optimal' }]} />
          <Slider label="Waiting riders" min={2} max={6} value={riders}
            onChange={(v) => { setRiders(v); if (drivers < v) setDrivers(v) }} />
          <Slider label="Free drivers" min={riders} max={9} value={drivers} onChange={setDrivers} />
          <button className="btn btn--secondary btn--sm" onClick={() => setSeed((s) => s + 1)}>New scenario</button>
          <div className="uber-dp__stats">
            <Stat label="Greedy total" a={greedy} active={view === 'greedy'} />
            <Stat label="Batched total" a={batched} active={view === 'batched'} />
          </div>
          <p className="uber-dp__verdict">
            {saved > 0
              ? <>Batching saves <strong>{saved.toFixed(1)} min</strong> of pickup time ({Math.round((saved / greedy.total) * 100)}%) in this batch.</>
              : <>Here greedy happens to be optimal. Try a new scenario.</>}
          </p>
        </div>

        <div className="uber-dp__map">
          <svg viewBox={`0 0 ${GRID_W * CELL} ${GRID_H * CELL}`} role="img"
            aria-label={`${view} assignment, total pickup ETA ${shown.total.toFixed(1)} minutes`}>
            {Array.from({ length: GRID_W }, (_, x) => <line key={`v${x}`} className="uber-dp__street" x1={c(x)} y1={0} x2={c(x)} y2={GRID_H * CELL} />)}
            {Array.from({ length: GRID_H }, (_, y) => <line key={`h${y}`} className="uber-dp__street" x1={0} y1={c(y)} x2={GRID_W * CELL} y2={c(y)} />)}
            {shown.pairs.map(([r, d]) => {
              const a = scenario.riders[r]; const b = scenario.drivers[d]
              return (
                <g key={`${r}-${d}`} className="uber-dp__route">
                  <polyline points={`${c(b.x)},${c(b.y)} ${c(a.x)},${c(b.y)} ${c(a.x)},${c(a.y)}`} />
                  <text x={(c(a.x) + c(b.x)) / 2} y={c(b.y) - 6} textAnchor="middle">{eta(a, b).toFixed(1)}m</text>
                </g>
              )
            })}
            {scenario.drivers.map((d, i) => (
              <circle key={`d${i}`} className="uber-dp__driver" cx={c(d.x)} cy={c(d.y)} r={7} />
            ))}
            {scenario.riders.map((r, i) => (
              <g key={`r${i}`} className="uber-dp__rider">
                <rect x={c(r.x) - 9} y={c(r.y) - 9} width={18} height={18} rx={4} />
                <text x={c(r.x)} y={c(r.y) + 4} textAnchor="middle">{i + 1}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </DemoFrame>
  )
}

function Stat({ label, a, active }: { label: string; a: Assignment; active: boolean }) {
  return (
    <div className={`uber-dp__stat ${active ? 'is-on' : ''}`}>
      <span>{label}</span>
      <strong>{a.total.toFixed(1)} min</strong>
      <small>worst pickup {a.worst.toFixed(1)} min</small>
    </div>
  )
}
