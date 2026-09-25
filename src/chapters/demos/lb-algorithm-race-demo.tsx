import { useEffect, useReducer, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Button, DemoFrame, Segmented, Slider } from '../../components/ui'
import { ALGOS, createRace, laneStats, step } from './lb-algorithm-race-sim'
import './lb-demos.css'

const N = 6

export function LbAlgorithmRaceDemo() {
  const [load, setLoad] = useState(0.85)
  const [slow, setSlow] = useState<'uniform' | 'one-slow'>('uniform')
  const [running, setRunning] = useState(false)
  const race = useRef(createRace(N, false))
  const [, redraw] = useReducer((x: number) => x + 1, 0)

  const reset = (slowMode = slow) => { race.current = createRace(N, slowMode === 'one-slow'); redraw() }

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => { for (let i = 0; i < 3; i++) step(race.current, load); redraw() }, 90)
    return () => clearInterval(t)
  }, [running, load])

  const stats = race.current.lanes.map(laneStats)
  const bestP99 = Math.min(...stats.map((s) => s.p99 || Infinity))
  const scale = Math.max(8, ...stats.map((s) => s.maxQ))

  return (
    <DemoFrame title="Load-balancing algorithm race" onReset={() => { setRunning(false); reset() }}
      hint="All four balancers get the exact same heavy-tailed request stream. Push the load up, or add one slow server, and compare tail latency.">
      <div className="lba__controls">
        <Button variant="primary" size="sm" onClick={() => setRunning(!running)}>
          {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Run</>}
        </Button>
        <div className="lba__slider"><Slider label="Utilisation" min={0.3} max={0.98} step={0.01} value={load} onChange={setLoad} format={(v) => `${Math.round(v * 100)}%`} /></div>
        <Segmented label="Fleet" value={slow} onChange={(v) => { setSlow(v); reset(v) }}
          options={[{ value: 'uniform', label: 'Identical servers' }, { value: 'one-slow', label: 'One slow server' }]} />
      </div>

      <div className="lba__grid">
        {race.current.lanes.map((lane, i) => {
          const s = stats[i]
          const isBest = s.p99 > 0 && s.p99 === bestP99
          return (
            <div key={lane.algo} className={`lba__lane ${isBest ? 'is-best' : ''}`}>
              <div className="lba__head">
                <strong>{ALGOS[i].label}</strong>
                {isBest && <span className="badge badge--success">best p99</span>}
              </div>
              <div className="lba__queues" aria-label={`Queue lengths: ${s.q.join(', ')}`}>
                {s.q.map((q, j) => (
                  <div key={j} className="lba__q" title={`server ${j + 1}: ${q} queued`}>
                    <i style={{ height: `${Math.min(100, (q / scale) * 100)}%` }} className={q > scale * 0.7 ? 'is-hot' : ''} />
                    <span>{lane.servers[j].speed < 1 ? '🐢' : j + 1}</span>
                  </div>
                ))}
              </div>
              <div className="lba__stats mono">
                <span>avg <b>{s.avg.toFixed(1)}</b></span>
                <span>p99 <b>{s.p99}</b></span>
                <span>max q <b>{s.maxQ}</b></span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="lba__foot">Latency is measured in simulation ticks. This is a toy model: 90% of requests are cheap, 10% cost about 7× more. Tick {race.current.tick}.</p>
    </DemoFrame>
  )
}
