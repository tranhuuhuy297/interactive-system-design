import { useEffect, useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { makeArrivals, metricsAt, runEngine, type EngineKind, type Profile } from './llm-batching-model'
import './llm-demos.css'

const STEPS = 240
const WINDOW = 60

export function LlmBatchingSimulatorDemo() {
  const [slots, setSlots] = useState(8)
  const [rate, setRate] = useState(0.16)
  const [profile, setProfile] = useState<Profile>('long-tail')
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)

  const arrivals = useMemo(() => makeArrivals(STEPS, rate, profile), [rate, profile])
  const runs = useMemo(() => ({
    static: runEngine('static', arrivals, slots, STEPS),
    continuous: runEngine('continuous', arrivals, slots, STEPS),
  }), [arrivals, slots])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => (x >= STEPS ? x : x + 1)), 90)
    return () => clearInterval(id)
  }, [playing])

  const restart = () => { setT(0); setPlaying(true) }
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setT(0) }
  const from = Math.max(0, t - WINDOW)

  return (
    <DemoFrame title="Static vs continuous batching on the same traffic"
      hint="Each row is a GPU batch slot, each column a decode step. Colored = producing a token, blank = wasted slot. Toy model."
      onReset={restart}>
      <div className="llm-bat__controls">
        <Slider label="Batch slots" min={4} max={16} value={slots} onChange={change(setSlots)} />
        <Slider label="Arrivals per step" min={0.04} max={0.4} step={0.02} value={rate} onChange={change(setRate)} format={(v) => v.toFixed(2)} />
        <div className="llm-bat__col">
          <span className="demo-label">Output lengths</span>
          <Segmented label="Output length profile" value={profile} onChange={change(setProfile)}
            options={[{ value: 'long-tail', label: 'Long tail' }, { value: 'uniform', label: 'Similar' }]} />
        </div>
        <div className="llm-bat__col">
          <span className="demo-label">Step {t} / {STEPS}</span>
          <div className="llm-bat__buttons">
            <button className="btn btn--secondary btn--sm" onClick={() => setPlaying((p) => !p)} disabled={t >= STEPS}>{playing && t < STEPS ? 'Pause' : 'Play'}</button>
            <button className="btn btn--ghost btn--sm" onClick={restart}>Restart</button>
          </div>
        </div>
      </div>

      {(['static', 'continuous'] as EngineKind[]).map((kind) => {
        const run = runs[kind]
        const m = metricsAt(run, arrivals, t, slots)
        const rows = run.history.slice(from, t)
        return (
          <section key={kind} className="llm-bat__engine" aria-label={`${kind} batching`}>
            <header className="llm-bat__head">
              <strong>{kind === 'static' ? 'Static batching' : 'Continuous batching'}</strong>
              <dl className="llm-bat__stats">
                <div><dt>tokens/step</dt><dd>{m.tokensPerStep.toFixed(1)}</dd></div>
                <div><dt>slot use</dt><dd>{Math.round(m.utilization * 100)}%</dd></div>
                <div><dt>avg latency</dt><dd>{m.avgLatency.toFixed(0)} steps</dd></div>
                <div><dt>p95</dt><dd>{m.p95Latency} steps</dd></div>
                <div><dt>queued</dt><dd className={m.queued > slots ? 'is-bad' : ''}>{m.queued}</dd></div>
              </dl>
            </header>
            <svg className="llm-bat__grid" viewBox={`0 0 ${WINDOW * 10} ${slots * 10}`} preserveAspectRatio="none" role="img" style={{ height: slots * 12 }}
              aria-label={`${kind} batching slot occupancy over the last ${rows.length} steps`}>
              {rows.map((row, x) => Array.from(row).map((id, y) => (
                <rect key={`${x}-${y}`} x={x * 10 + 0.5} y={y * 10 + 0.5} width={9} height={9} rx={1.5}
                  className={id < 0 ? 'llm-bat__idle' : 'llm-bat__busy'} style={id < 0 ? undefined : { ['--h' as string]: (id * 47) % 360 }} />
              )))}
            </svg>
          </section>
        )
      })}
      <p className="llm-bat__note">
        One step ≈ one forward pass of the decoder (tens of milliseconds on real hardware). Prefill is ignored for clarity.
      </p>
    </DemoFrame>
  )
}
