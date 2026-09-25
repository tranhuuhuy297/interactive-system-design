import { useEffect, useState } from 'react'
import { Badge, Button, DemoFrame, Segmented } from '../../components/ui'
import { SCRIPTS, STRATEGY_LABELS, type Lane, type Strategy } from './reserve-race-scripts'
import './reserve-demos.css'

const LANES: Lane[] = ['A', 'DB', 'B']
const LANE_TITLE: Record<Lane, string> = { A: 'User A', DB: 'Database', B: 'User B' }

/** Step through two concurrent bookings of the last room. */
export function ReserveRaceDemo() {
  const [strategy, setStrategy] = useState<Strategy>('none')
  const [at, setAt] = useState(1)
  const [playing, setPlaying] = useState(false)
  const script = SCRIPTS[strategy]
  const done = at >= script.length
  const state = script[at - 1].state
  const running = playing && !done // derived, so reaching the end stops playback without an extra render

  useEffect(() => {
    if (!running) return
    const t = setTimeout(() => setAt((a) => a + 1), 1100)
    return () => clearTimeout(t)
  }, [running, at])

  const pick = (st: Strategy) => { setStrategy(st); setAt(1); setPlaying(false) }
  const doubleBooked = state.bookings.length > 1

  return (
    <DemoFrame title="Two users, one room left" onReset={() => pick(strategy)}
      hint="Same interleaving, four strategies. Step through and watch the database state.">
      <div className="rs-race__bar">
        <Segmented label="Strategy" value={strategy} onChange={pick}
          options={(Object.keys(STRATEGY_LABELS) as Strategy[]).map((k) => ({ value: k, label: STRATEGY_LABELS[k] }))} />
        <div className="rs-race__btns">
          <Button size="sm" onClick={() => setAt((a) => Math.max(1, a - 1))} disabled={at <= 1}>Back</Button>
          <Button size="sm" onClick={() => setAt((a) => a + 1)} disabled={done}>Step</Button>
          <Button size="sm" variant="primary" onClick={() => { if (done) { setAt(1); setPlaying(true) } else setPlaying(!running) }}>{running ? 'Pause' : done ? 'Replay' : 'Play'}</Button>
        </div>
      </div>

      <div className="rs-race__grid">
        <div className="rs-race__seq">
          <div className="rs-race__heads">{LANES.map((l) => <span key={l} className={`rs-race__head rs-race__head--${l}`}>{LANE_TITLE[l]}</span>)}</div>
          {script.slice(0, at).map((step, i) => (
            <div key={`${strategy}-${i}`} className="rs-race__row">
              {LANES.map((l) => (
                <div key={l} className="rs-race__cell">
                  {step.lane === l && (
                    <div className={`rs-race__msg rs-race__msg--${step.tone ?? 'plain'} ${i === at - 1 ? 'is-current' : ''}`}>
                      <span>{step.text}</span>
                      {step.sql && <code>{step.sql}</code>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <aside className="rs-race__db" aria-live="polite">
          <div className="demo-label">room_inventory (hotel 42, deluxe, 2026-12-31)</div>
          <dl>
            <div><dt>available</dt><dd className="mono">{state.available}</dd></div>
            <div><dt>version</dt><dd className="mono">v{state.version}</dd></div>
            <div><dt>row lock</dt><dd>{state.lock ? `held by ${state.lock}` : '—'}</dd></div>
          </dl>
          <div className="demo-label">reservations</div>
          <ul>{state.bookings.length ? state.bookings.map((b) => <li key={b} className="mono">{b}</li>) : <li className="rs-race__none">none</li>}</ul>
          {done && (
            <div className="rs-race__verdict">
              <Badge tone={doubleBooked ? 'danger' : 'success'}>{doubleBooked ? 'Double-booked' : 'Exactly one booking'}</Badge>
            </div>
          )}
        </aside>
      </div>
    </DemoFrame>
  )
}
