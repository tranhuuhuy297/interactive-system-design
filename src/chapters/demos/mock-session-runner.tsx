import { useEffect, useState } from 'react'
import { Eye, EyeOff, Flag, Lightbulb, Pause, Play, Zap } from 'lucide-react'
import { Badge, Button } from '../../components/ui'
import type { MockPrompt } from '../../data/mock-prompts-data'
import { useLocalStorageState } from '../../lib/use-local-storage-state'
import { MOCK_PHASES, MOCK_TOTAL_SECONDS, PHASE_ENDS } from './mock-phases'

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

interface RunnerProps {
  prompt: MockPrompt
  onFinish: (minutesUsed: number) => void
}

/** Live session: clock, phase coach, curveballs, reference reveal and a persisted scratchpad. */
export function MockSessionRunner({ prompt, onFinish }: RunnerProps) {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(true)
  const [curveballs, setCurveballs] = useState<string[]>([])
  const [showRef, setShowRef] = useState(false)
  const [notes, setNotes] = useLocalStorageState<string>('sdh:mock-notes', '')

  const ticking = running && elapsed < MOCK_TOTAL_SECONDS
  useEffect(() => {
    if (!ticking) return
    const t = window.setInterval(() => setElapsed((e) => Math.min(MOCK_TOTAL_SECONDS, e + 1)), 1000)
    return () => window.clearInterval(t)
  }, [ticking])

  const found = PHASE_ENDS.findIndex((end) => elapsed < end)
  const phaseIdx = found === -1 ? MOCK_PHASES.length - 1 : found
  const phase = MOCK_PHASES[phaseIdx]
  const phaseLeft = (PHASE_ENDS[phaseIdx] ?? MOCK_TOTAL_SECONDS) - elapsed
  const hint = phase.hints[Math.floor(elapsed / 25) % phase.hints.length]

  const remaining = prompt.curveballs.filter((c) => !curveballs.includes(c))
  const throwCurveball = () => { if (remaining.length) setCurveballs((c) => [...c, remaining[Math.floor(Math.random() * remaining.length)]]) }

  return (
    <div className="mk-run">
      <div className="mk-run__head">
        <div>
          <span className="demo-label">Your prompt</span>
          <h3 className="mk-run__title">{prompt.title}</h3>
        </div>
        <div className="mk-run__clock">
          <span role="timer" aria-label="Time remaining" className={`mono ${MOCK_TOTAL_SECONDS - elapsed < 300 ? 'is-low' : ''}`}>{fmt(MOCK_TOTAL_SECONDS - elapsed)}</span>
          <Button size="sm" variant="secondary" onClick={() => setRunning(!running)} disabled={elapsed >= MOCK_TOTAL_SECONDS}>
            {ticking ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}
          </Button>
        </div>
      </div>

      <div className="mk-track" aria-hidden>
        {MOCK_PHASES.map((p, i) => (
          <span key={p.id} style={{ flexGrow: p.minutes }} className={`${i === phaseIdx ? 'is-current' : ''} ${elapsed >= PHASE_ENDS[i] ? 'is-done' : ''}`}>
            <i>{p.title}</i>
          </span>
        ))}
      </div>

      <div className="mk-coach">
        <Lightbulb size={16} aria-hidden />
        <div>
          {/* Only phase + hint are announced; the per-second countdown stays out of the live region. */}
          <span className="sr-only" aria-live="polite">{`${phase.title}. ${hint}`}</span>
          <strong>{phase.title}</strong> <span className="mk-coach__left mono">{fmt(Math.max(0, phaseLeft))} left</span>
          <p key={hint} aria-hidden>{hint}</p>
        </div>
      </div>

      {curveballs.map((c) => (
        <div key={c} className="mk-curve"><Zap size={15} /> <span><b>Interviewer:</b> {c}</span></div>
      ))}

      <div className="mk-run__cols">
        <label className="mk-notes">
          <span className="demo-label">Scratchpad (saved locally)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} spellCheck={false}
            placeholder={'Requirements…\nEstimates…\nAPI…\nComponents…\nDeep dive…'} />
        </label>
        <div className="mk-ref">
          <Button size="sm" variant="ghost" onClick={() => setShowRef(!showRef)}>
            {showRef ? <><EyeOff size={13} /> Hide reference</> : <><Eye size={13} /> Peek at reference</>}
          </Button>
          {showRef && (
            <div className="mk-ref__body">
              {([['Clarify', prompt.clarify], ['Components', prompt.components], ['Deep dives', prompt.deepDives]] as const).map(([label, items]) => (
                <div key={label}>
                  <span className="demo-label">{label}</span>
                  <div className="mk-ref__chips">{items.map((x) => <Badge key={x} tone="neutral">{x}</Badge>)}</div>
                </div>
              ))}
              {prompt.chapter && <a className="mk-ref__link" href={`#/${prompt.chapter}`}>Open the full case study →</a>}
            </div>
          )}
        </div>
      </div>

      <div className="mk-run__actions">
        <Button variant="secondary" onClick={throwCurveball} disabled={!remaining.length}><Zap size={14} /> Throw a curveball</Button>
        <Button variant="primary" onClick={() => onFinish(Math.max(1, Math.round(elapsed / 60)))}><Flag size={14} /> End & score</Button>
      </div>
    </div>
  )
}
