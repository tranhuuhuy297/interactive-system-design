import { useRef, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import {
  CHANNELS, INITIAL_NOTIF, processEvent, type Channel, type Counters, type EventKind, type NotifConfig,
} from './notif-pipeline-model'
import './notif-pipeline-simulator-demo.css'

const STAGES: { key: keyof Counters; label: string; tone: string }[] = [
  { key: 'received', label: 'Received', tone: 'neutral' },
  { key: 'deduped', label: 'Deduped', tone: 'warn' },
  { key: 'suppressed', label: 'Opted out', tone: 'warn' },
  { key: 'rateLimited', label: 'Rate-limited', tone: 'warn' },
  { key: 'retried', label: 'Retries', tone: 'info' },
  { key: 'delivered', label: 'Delivered', tone: 'ok' },
  { key: 'dlq', label: 'Dead-letter', tone: 'bad' },
]

const INITIAL_CFG: NotifConfig = {
  prefs: { push: true, sms: false, email: true },
  failRate: { push: 0.1, sms: 0.2, email: 0.3 },
  marketingPerHour: 3,
  maxRetries: 2,
}

export function NotifPipelineSimulatorDemo() {
  const [cfg, setCfg] = useState(INITIAL_CFG)
  const [kind, setKind] = useState<EventKind>('transactional')
  const [s, setS] = useState(INITIAL_NOTIF)
  const n = useRef(1000)

  // Keys are minted outside the updater: StrictMode double-invokes updaters in dev.
  const fire = (key?: string) => {
    const k = key ?? `evt-${++n.current}`
    setS((prev) => processEvent(prev, k, kind, cfg))
  }
  const burst = () => {
    const keys = Array.from({ length: 10 }, () => `evt-${++n.current}`)
    setS((prev) => keys.reduce((acc, k) => processEvent(acc, k, kind, cfg), prev))
  }
  const setPref = (ch: Channel) => setCfg((c) => ({ ...c, prefs: { ...c.prefs, [ch]: !c.prefs[ch] } }))
  const setFail = (ch: Channel, v: number) => setCfg((c) => ({ ...c, failRate: { ...c.failRate, [ch]: v / 100 } }))
  const reset = () => { setCfg(INITIAL_CFG); setS(INITIAL_NOTIF); setKind('transactional'); n.current = 1000 }

  return (
    <DemoFrame title="Notification pipeline: dedup, preferences, limits, retries, DLQ" onReset={reset}
      hint="Replay the last event to see idempotency in action. Push provider failure rates up and watch retries spill into the DLQ.">
      <div className="notif">
        <div className="demo-controls">
          <Segmented label="Event type" value={kind} onChange={setKind} options={['transactional', 'marketing'] as const} />
          <div>
            <div className="demo-label">User preferences</div>
            <div className="notif__prefs">
              {CHANNELS.map((ch) => (
                <button key={ch} className="notif__pref" aria-pressed={cfg.prefs[ch]} onClick={() => setPref(ch)}>{ch}</button>
              ))}
            </div>
          </div>
          {CHANNELS.map((ch) => (
            <Slider key={ch} label={`${ch} provider failure rate`} min={0} max={90} step={5}
              value={Math.round(cfg.failRate[ch] * 100)} onChange={(v) => setFail(ch, v)} format={(v) => `${v}%`} />
          ))}
          <Slider label="Marketing cap per user / hour" min={1} max={10} value={cfg.marketingPerHour}
            onChange={(v) => setCfg((c) => ({ ...c, marketingPerHour: v }))} />
          <Slider label="Max retries" min={0} max={5} value={cfg.maxRetries} onChange={(v) => setCfg((c) => ({ ...c, maxRetries: v }))} />
        </div>

        <div className="notif__stage">
          <div className="notif__actions">
            <button className="btn btn--primary btn--sm" onClick={() => fire()}>Fire event</button>
            <button className="btn btn--secondary btn--sm" onClick={() => fire(`evt-${n.current}`)} disabled={s.c.received === 0}>Replay last (duplicate)</button>
            <button className="btn btn--secondary btn--sm" onClick={burst}>Burst ×10</button>
          </div>
          <div className="notif__stages">
            {STAGES.map((st) => (
              <div key={st.key} className={`notif__count notif__count--${st.tone}`}>
                <span>{st.label}</span>
                <strong key={s.c[st.key]} className="mono">{s.c[st.key]}</strong>
              </div>
            ))}
          </div>
          <ul className="notif__log" aria-live="polite">
            {s.log.length === 0 && <li className="notif__line--info">No events yet.</li>}
            {s.log.map((l, i) => <li key={`${s.c.received}-${i}`} className={`notif__line--${l.tone}`}>{l.text}</li>)}
          </ul>
        </div>
      </div>
    </DemoFrame>
  )
}
