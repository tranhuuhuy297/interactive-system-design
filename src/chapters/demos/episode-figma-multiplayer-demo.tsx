import { useEffect, useState } from 'react'
import { Pause, Play, StepForward } from 'lucide-react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import {
  createSim, edit, isConverged, lostEdits, PROPS, SCENARIOS, step,
  type ClientId, type Delays, type Mode, type Props, type SimState,
} from './episode-figma-multiplayer-model'
import './episode-figma-demos.css'

type ScenarioKey = keyof typeof SCENARIOS
type Edits = (typeof SCENARIOS)[ScenarioKey]['edits']

/** Apply the edits scheduled for this tick, then deliver due messages. */
function tickSim(s: SimState, edits: Edits, delays: Delays, mode: Mode): SimState {
  let next = s
  for (const e of edits.filter((x) => x.t === next.t)) next = edit(next, e.client, e.prop, e.value, delays, mode)
  return step(next, delays, mode)
}
const FILL: Record<string, string> = { Gray: 'var(--text-subtle)', Red: 'var(--danger)', Blue: 'var(--accent)' }

function View({ title, props, pending }: { title: string; props: Props; pending?: Partial<Record<string, number>> }) {
  return (
    <div className="fg-mp__view">
      <div className="fg-mp__title">{title}</div>
      <div className="fg-mp__canvas" aria-hidden>
        <span className="fg-mp__shape" style={{ left: `${(Number(props.x) / 240) * 80}%`, background: FILL[String(props.fill)] ?? 'var(--text)' }}>{props.name}</span>
      </div>
      <dl className="fg-mp__props">
        {PROPS.map((p) => (
          <div key={p} className={pending?.[p] !== undefined ? 'is-pending' : ''}>
            <dt>{p}</dt><dd className="mono">{String(props[p])}{pending?.[p] !== undefined && <small> · unacked</small>}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function EpisodeFigmaMultiplayerDemo() {
  const [mode, setMode] = useState<Mode>('figma')
  const [scenario, setScenario] = useState<ScenarioKey>('different')
  const [delays, setDelays] = useState<Delays>({ A: 2, B: 4 })
  const [sim, setSim] = useState<SimState>(createSim)
  const [playing, setPlaying] = useState(false)

  const edits = SCENARIOS[scenario].edits
  const lastEditTick = Math.max(...edits.map((e) => e.t))
  const done = sim.t > lastEditTick && isConverged(sim)
  const running = playing && !done

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSim((s) => tickSim(s, edits, delays, mode)), 700)
    return () => clearInterval(id)
  }, [running, edits, delays, mode])

  const restart = (next?: { mode?: Mode; scenario?: ScenarioKey }) => {
    if (next?.mode) setMode(next.mode)
    if (next?.scenario) setScenario(next.scenario)
    setSim(createSim()); setPlaying(false)
  }
  const lost = lostEdits(sim)
  const setDelay = (c: ClientId) => (v: number) => { setDelays((d) => ({ ...d, [c]: v })); setSim(createSim()); setPlaying(false) }

  return (
    <DemoFrame title="Two designers, one object: multiplayer conflict rules" onReset={() => restart({ mode: 'figma', scenario: 'different' })}
      hint="Messages take the chosen number of ticks each way. The server applies edits in arrival order and echoes them to both clients.">
      <div className="fg-mp__controls">
        <Segmented label="Sync rule" value={mode} onChange={(m) => restart({ mode: m })} options={[
          { value: 'figma', label: 'Per property + guard' }, { value: 'naive', label: 'No unacked guard' }, { value: 'object', label: 'Whole-object LWW' },
        ]} />
        <Segmented label="Scenario" value={scenario} onChange={(k) => restart({ scenario: k })}
          options={(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => ({ value: k, label: SCENARIOS[k].label }))} />
        <div className="fg-mp__sliders">
          <Slider label="Latency A ↔ server" min={1} max={6} value={delays.A} onChange={setDelay('A')} format={(v) => `${v} ticks`} />
          <Slider label="Latency B ↔ server" min={1} max={6} value={delays.B} onChange={setDelay('B')} format={(v) => `${v} ticks`} />
        </div>
        <div className="fg-mp__buttons">
          <button className="btn btn--primary btn--sm" onClick={() => (done ? restart() : setPlaying(!running))}>
            {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> {done ? 'Replay' : 'Play'}</>}
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => setSim((s) => tickSim(s, edits, delays, mode))} disabled={done || running}><StepForward size={14} /> Step</button>
          <span className="fg-mp__t mono">t = {sim.t}</span>
        </div>
      </div>

      <div className="fg-mp__grid">
        <View title="Client A" props={sim.A.view} pending={sim.A.pending} />
        <View title="Server (truth)" props={sim.server} />
        <View title="Client B" props={sim.B.view} pending={sim.B.pending} />
      </div>

      <div className="fg-mp__status" aria-live="polite">
        <span className={`fg-mp__badge ${done ? 'is-ok' : ''}`}>{done ? 'Converged' : `${sim.inflight.length} message${sim.inflight.length === 1 ? '' : 's'} in flight`}</span>
        <span className={`fg-mp__badge ${sim.flickers ? 'is-bad' : ''}`}>{sim.flickers} flicker{sim.flickers === 1 ? '' : 's'}</span>
        <span className={`fg-mp__badge ${lost.length ? 'is-bad' : ''}`}>{lost.length ? `Lost edit: ${lost.join(', ')}` : 'No lost edits'}</span>
      </div>
      <ol className="fg-mp__log" aria-label="Event log">{sim.log.map((l, i) => <li key={`${sim.t}-${i}`}>{l}</li>)}</ol>
    </DemoFrame>
  )
}
