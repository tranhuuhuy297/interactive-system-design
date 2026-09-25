import { useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { DemoFrame, Slider } from '../../components/ui'
import './framework-demos.css'

interface Phase { id: string; name: string; min: number; max: number; def: number; hue: string; checklist: string[] }

const PHASES: Phase[] = [
  { id: 'scope', name: 'Clarify & scope', min: 3, max: 12, def: 7, hue: 'var(--accent)', checklist: [
    'Restate the problem in one sentence', 'List 3–5 core functional requirements', 'Agree on scale: DAU, read:write, data size',
    'Name non-functional targets (latency, availability, consistency)', 'State what is out of scope'] },
  { id: 'hld', name: 'High-level design', min: 6, max: 18, def: 12, hue: 'var(--accent-2)', checklist: [
    'Sketch the API (3–5 endpoints)', 'Draw the request path end to end', 'Choose data stores and justify them',
    'Walk one read and one write through the diagram', 'Confirm direction with the interviewer before going deeper'] },
  { id: 'deep', name: 'Deep dive', min: 8, max: 25, def: 18, hue: 'var(--accent-3)', checklist: [
    'Pick the 1–2 hardest components (or let the interviewer pick)', 'Quantify the bottleneck with numbers',
    'Offer ≥2 options and compare trade-offs', 'Cover failure modes: node, network, region', 'Revisit consistency and data model choices'] },
  { id: 'wrap', name: 'Wrap-up', min: 2, max: 8, def: 5, hue: 'var(--warning)', checklist: [
    'Summarize the design in 30 seconds', 'Name remaining bottlenecks honestly', 'Describe how it evolves at 10× scale',
    'Mention operability: metrics, alerts, rollout'] },
]
const TOTAL = 45

export function FrameworkTimelinePlanner() {
  const [budget, setBudget] = useState<Record<string, number>>(() => Object.fromEntries(PHASES.map((p) => [p.id, p.def])))
  const [active, setActive] = useState(PHASES[0].id)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [clock, setClock] = useState(0)
  const [running, setRunning] = useState(false)

  const used = PHASES.reduce((s, p) => s + budget[p.id], 0)
  const over = used - TOTAL

  // Accelerated clock: one interview minute every ~250 ms; stops by itself at 45:00.
  const finished = clock >= TOTAL
  const ticking = running && !finished
  useEffect(() => {
    if (!ticking) return
    const t = setInterval(() => setClock((c) => Math.min(TOTAL, c + 0.25)), 62)
    return () => clearInterval(t)
  }, [ticking])

  const spans = PHASES.map((p, i) => {
    const start = PHASES.slice(0, i).reduce((s, q) => s + budget[q.id], 0)
    return { ...p, start, end: start + budget[p.id] }
  })
  const current = spans.find((s) => clock >= s.start && clock < s.end)
  const phase = PHASES.find((p) => p.id === active)!
  const reset = () => { setBudget(Object.fromEntries(PHASES.map((p) => [p.id, p.def]))); setDone({}); setClock(0); setRunning(false) }

  return (
    <DemoFrame title="Plan your 45 minutes" onReset={reset}
      hint="Tune each phase's budget, then press play to watch an accelerated clock. Click a phase to see its checklist.">
      <div className="fw-bar" role="group" aria-label="Interview timeline: choose a phase">
        {spans.map((s) => (
          <button key={s.id} aria-pressed={active === s.id} className={`fw-bar__seg ${active === s.id ? 'is-active' : ''} ${current?.id === s.id ? 'is-now' : ''}`}
            style={{ width: `${(budget[s.id] / Math.max(TOTAL, used)) * 100}%`, ['--hue' as string]: s.hue }}
            onClick={() => setActive(s.id)}>
            <span>{s.name}</span><small>{budget[s.id]}m</small>
          </button>
        ))}
        <span className="fw-bar__head" style={{ left: `${(clock / Math.max(TOTAL, used)) * 100}%` }} aria-hidden />
      </div>
      <div className="fw-row">
        <button className="btn btn--secondary btn--sm" onClick={() => { if (finished) { setClock(0); setRunning(true) } else setRunning(!running) }}>
          {ticking ? <Pause size={14} /> : <Play size={14} />} {ticking ? 'Pause' : finished ? 'Replay' : 'Simulate'}
        </button>
        <span className="mono fw-clock">{String(Math.floor(clock)).padStart(2, '0')}:{String(Math.round((clock % 1) * 60)).padStart(2, '0')} / 45:00</span>
        <span className={`fw-total ${over > 0 ? 'is-over' : ''}`}>
          {over > 0 ? `${over} min over budget, so cut something` : `${TOTAL - used} min buffer for questions`}
        </span>
      </div>

      <div className="fw-grid">
        <div className="demo-controls">
          {PHASES.map((p) => (
            <Slider key={p.id} label={p.name} min={p.min} max={p.max} value={budget[p.id]}
              onChange={(v) => setBudget((b) => ({ ...b, [p.id]: v }))} format={(v) => `${v} min`} />
          ))}
        </div>
        <div className="demo-stage fw-check" style={{ ['--hue' as string]: phase.hue }}>
          <div className="demo-label">{phase.name} checklist</div>
          <ul>
            {phase.checklist.map((c) => {
              const key = `${phase.id}:${c}`
              return (
                <li key={key}>
                  <label>
                    <input type="checkbox" checked={!!done[key]} onChange={() => setDone((d) => ({ ...d, [key]: !d[key] }))} />
                    <span>{c}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="fw-check__count mono">
            {phase.checklist.filter((c) => done[`${phase.id}:${c}`]).length}/{phase.checklist.length} done
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
