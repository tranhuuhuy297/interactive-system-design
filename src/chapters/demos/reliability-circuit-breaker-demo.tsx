import { useEffect, useRef, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import './reliability-demos.css'

type State = 'closed' | 'open' | 'half-open'
type Outcome = 'ok' | 'fail' | 'short'

const TICK = 200
const WINDOW = 10
const MIN_CALLS = 5
const TRIALS = 3

interface Breaker { state: State; window: boolean[]; openedAt: number; trialsOk: number; now: number; history: Outcome[]; log: string[] }
const fresh = (): Breaker => ({ state: 'closed', window: [], openedAt: 0, trialsOk: 0, now: 0, history: [], log: [] })

export function ReliabilityCircuitBreakerDemo() {
  const [failRate, setFailRate] = useState(10)
  const [threshold, setThreshold] = useState(50)
  const [cooldown, setCooldown] = useState(3000)
  const s = useRef(fresh())
  // Render from a per-tick snapshot, not the mutable ref.
  const [snap, setSnap] = useState<Breaker>(() => fresh())

  const transition = (to: State, why: string) => {
    const b = s.current
    b.log = [`${(b.now / 1000).toFixed(1)}s  ${b.state} → ${to}: ${why}`, ...b.log].slice(0, 5)
    b.state = to
  }

  useEffect(() => {
    const id = setInterval(() => {
      const b = s.current
      b.now += TICK
      if (b.state === 'open' && b.now - b.openedAt >= cooldown) { transition('half-open', 'cooldown elapsed, allowing trial calls'); b.trialsOk = 0 }
      let outcome: Outcome
      if (b.state === 'open') outcome = 'short'
      else outcome = Math.random() * 100 < failRate ? 'fail' : 'ok'

      if (b.state === 'closed' && outcome !== 'short') {
        b.window = [...b.window, outcome === 'fail'].slice(-WINDOW)
        const fails = b.window.filter(Boolean).length
        if (b.window.length >= MIN_CALLS && (fails / b.window.length) * 100 >= threshold) {
          transition('open', `${fails}/${b.window.length} recent calls failed`)
          b.openedAt = b.now
        }
      } else if (b.state === 'half-open') {
        if (outcome === 'fail') { transition('open', 'trial call failed'); b.openedAt = b.now }
        else if (++b.trialsOk >= TRIALS) { transition('closed', `${TRIALS} trial calls succeeded`); b.window = [] }
      }
      b.history = [...b.history, outcome].slice(-48)
      setSnap({ ...b })
    }, TICK)
    return () => clearInterval(id)
  }, [failRate, threshold, cooldown])

  const b = snap
  const fails = b.window.filter(Boolean).length
  const counts = { ok: b.history.filter((h) => h === 'ok').length, fail: b.history.filter((h) => h === 'fail').length, short: b.history.filter((h) => h === 'short').length }

  return (
    <DemoFrame title="Circuit breaker state machine"
      onReset={() => { s.current = fresh(); setSnap(fresh()); setFailRate(10) }}
      hint="Push the downstream failure rate up to trip the breaker, then bring it back down and watch half-open probing close it again.">
      <div className="cb__controls">
        <Slider label="Downstream failure rate" min={0} max={100} value={failRate} onChange={setFailRate} format={(v) => `${v}%`} />
        <Slider label="Trip threshold" min={20} max={90} step={5} value={threshold} onChange={setThreshold} format={(v) => `${v}% of last ${WINDOW}`} />
        <Slider label="Open cooldown" min={1000} max={6000} step={500} value={cooldown} onChange={setCooldown} format={(v) => `${v / 1000}s`} />
      </div>

      <div className="cb__machine" aria-live="polite">
        {(['closed', 'open', 'half-open'] as State[]).map((st) => (
          <div key={st} className={`cb__state cb__state--${st} ${b.state === st ? 'is-active' : ''}`}>
            <strong>{st}</strong>
            <small>{st === 'closed' ? 'calls flow, failures counted' : st === 'open' ? 'fail fast, no calls sent' : `${TRIALS} trial calls decide`}</small>
          </div>
        ))}
      </div>

      <div className="cb__meta mono">
        {b.state === 'closed' && <span>window: {fails}/{b.window.length} failed</span>}
        {b.state === 'open' && <span>reopens for trials in {Math.max(0, (cooldown - (b.now - b.openedAt)) / 1000).toFixed(1)}s</span>}
        {b.state === 'half-open' && <span>trials ok: {b.trialsOk}/{TRIALS}</span>}
        <span className="cb__counts"><i className="ok" />{counts.ok} ok <i className="fail" />{counts.fail} failed <i className="short" />{counts.short} fast-failed</span>
      </div>

      <div className="cb__stream" aria-hidden>{b.history.map((h, i) => <span key={i} className={`cb__req cb__req--${h}`} />)}</div>

      <ul className="cb__log mono">{b.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </DemoFrame>
  )
}
