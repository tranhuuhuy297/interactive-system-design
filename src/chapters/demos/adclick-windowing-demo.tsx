import { useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { HORIZON, generateEvents, runPipeline, type WindowKind } from './adclick-windowing-model'
import './adclick-demos.css'

const X = (t: number) => 10 + t * 10
const Y = (delay: number) => 70 + delay * 7.5
type LateMode = 'drop' | 'side'

/** Event time vs arrival delay; windows close when the watermark passes their end. */
export function AdclickWindowingDemo() {
  const events = useMemo(() => generateEvents(), [])
  const [kind, setKind] = useState<WindowKind>('tumbling')
  const [lateness, setLateness] = useState(3)
  const [lateMode, setLateMode] = useState<LateMode>('side')
  const { processed, windows, lateCount } = useMemo(() => runPipeline(events, kind, lateness), [events, kind, lateness])
  const [hover, setHover] = useState<number | null>(null)
  const hovered = processed.find((p) => p.id === hover)
  const accuracy = Math.round(((events.length - lateCount) / events.length) * 100)

  return (
    <DemoFrame title="Windows & watermarks: freshness vs completeness"
      onReset={() => { setKind('tumbling'); setLateness(3); setLateMode('side') }}
      hint="Each dot is a click: x is when it happened, height is how late it arrived. Raise the allowed lateness and watch late clicks turn on-time.">
      <div className="ac-win__controls">
        <Segmented label="Window" value={kind} onChange={setKind}
          options={[{ value: 'tumbling', label: 'Tumbling 10s' }, { value: 'sliding', label: 'Sliding 10s/5s' }, { value: 'session', label: 'Session gap 4s' }]} />
        <Segmented label="Late events" value={lateMode} onChange={setLateMode}
          options={[{ value: 'drop', label: 'Drop' }, { value: 'side', label: 'Side output' }]} />
        <div className="ac-win__slider">
          <Slider label="Allowed lateness (watermark lag)" min={0} max={20} value={lateness} onChange={setLateness} format={(v) => `${v}s`} />
        </div>
      </div>

      <svg viewBox="0 0 620 240" className="ac-win__svg" role="img" aria-label="Event timeline with windows">
        {windows.map((w, i) => {
          const row = kind === 'sliding' ? (w.start / 5) % 2 : 0
          const y = 6 + row * 24
          return (
            <g key={`${w.start}-${i}`} className="ac-win__band">
              <rect x={X(w.start) + 1} y={y} width={Math.max(4, X(Math.min(w.end, HORIZON + 0.8)) - X(w.start) - 2)} height={20} rx={5} />
              <text x={X(w.start) + 6} y={y + 14}>{w.count}</text>
            </g>
          )
        })}
        <line x1={X(0)} x2={X(HORIZON)} y1={Y(lateness)} y2={Y(lateness)} className="ac-win__lag" />
        <text x={X(HORIZON) - 2} y={Y(lateness) - 5} textAnchor="end" className="ac-win__lagtxt">delay = {lateness}s: clicks above this line are never late</text>
        {[0, 10, 20, 30, 40, 50, 60].map((t) => (
          <g key={t}><line x1={X(t)} x2={X(t)} y1={60} y2={225} className="ac-win__grid" /><text x={X(t)} y={236} className="ac-win__tick">{t}s</text></g>
        ))}
        {processed.map((p) => (
          <circle key={p.id} cx={X(p.eventTime)} cy={Y(p.delay)} r={hover === p.id ? 6.5 : 4.5}
            className={`ac-win__dot ${p.late ? 'is-late' : ''}`} tabIndex={0}
            onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(p.id)} onBlur={() => setHover(null)} />
        ))}
      </svg>

      <p className="ac-win__hover" aria-live="polite">
        {hovered
          ? `Click #${hovered.id}: happened at ${hovered.eventTime}s, arrived at ${hovered.arrival}s (${hovered.delay}s late) → ${hovered.late ? (lateMode === 'drop' ? 'DROPPED' : 'sent to side output') : 'counted'}`
          : 'Hover or focus a dot for details. Window labels show counts.'}
      </p>

      <div className="ac-win__stats">
        <div><span>Counted in windows</span><strong>{events.length - lateCount} / {events.length}</strong></div>
        <div><span>Late clicks</span><strong className={lateCount ? 'is-bad' : ''}>{lateCount} {lateMode === 'drop' ? 'lost' : '→ side output'}</strong></div>
        <div><span>Real-time accuracy</span><strong>{accuracy}%</strong></div>
        <div><span>Result delay</span><strong>≈ window end + {lateness}s</strong></div>
      </div>
      <p className="ac-win__note">
        {lateMode === 'drop'
          ? 'Dropping keeps the pipeline simple but silently under-counts. For billing, that means lost revenue or disputes.'
          : 'A side output keeps late clicks. A correction job (or the nightly batch recount) merges them into the final billed numbers.'}
      </p>
    </DemoFrame>
  )
}
