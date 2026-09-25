import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Zap, Swords } from 'lucide-react'
import { Button, DemoFrame, Slider } from '../../components/ui'
import { makeLimiters, type Limiter } from './ratelimit-algorithms'
import './ratelimit-demo.css'

const SPAN = 10_000 // visible timeline, ms
const TICK = 50

interface Hit { t: number; served: number | null }

/** Peak number of served requests inside any rolling window — exposes the fixed-window boundary burst. */
function peakPerWindow(times: number[], windowMs: number) {
  let best = 0
  for (let i = 0, j = 0; i < times.length; i++) {
    while (times[i] - times[j] >= windowMs) j++
    best = Math.max(best, i - j + 1)
  }
  return best
}

export function RateLimitRaceDemo() {
  const [limit, setLimit] = useState(5)
  const [windowMs, setWindowMs] = useState(2000)
  const [rate, setRate] = useState(3)
  const [running, setRunning] = useState(true)
  const [, force] = useState(0)

  const now = useRef(0)
  const limiters = useRef<Limiter[]>([])
  const hits = useRef<Record<string, Hit[]>>({})
  const pending = useRef<number[]>([])
  const nextSteady = useRef(0)

  const reset = () => {
    now.current = 0
    nextSteady.current = 0
    pending.current = []
    limiters.current = makeLimiters(limit, windowMs)
    hits.current = Object.fromEntries(limiters.current.map((l) => [l.key, []]))
    force((x) => x + 1)
  }
  // Rebuild limiters whenever their parameters change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reset, [limit, windowMs])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const from = now.current
      const to = from + TICK
      const due: number[] = []
      if (rate > 0) {
        while (nextSteady.current < to) { if (nextSteady.current >= from) due.push(nextSteady.current); nextSteady.current += 1000 / rate }
      } else nextSteady.current = to
      pending.current = pending.current.filter((p) => (p < to ? (due.push(p), false) : true))
      due.sort((a, b) => a - b)
      for (const t of due) for (const l of limiters.current) hits.current[l.key].push({ t, served: l.allow(t) })
      for (const k in hits.current) hits.current[k] = hits.current[k].filter((h) => Math.max(h.t, h.served ?? 0) > to - SPAN - 500)
      now.current = to
      force((x) => x + 1)
    }, TICK)
    return () => clearInterval(id)
  }, [running, rate])

  const burst = () => { for (let i = 0; i < 12; i++) pending.current.push(now.current + TICK + i * 12) }
  const boundaryAttack = () => {
    const b = (Math.floor(now.current / windowMs) + 1) * windowMs
    for (let i = 0; i < limit; i++) { pending.current.push(b - 200 + i * (180 / limit)); pending.current.push(b + 10 + i * (180 / limit)) }
  }

  const t0 = now.current - SPAN
  const x = (t: number) => ((t - t0) / SPAN) * 1000
  const boundaries = useMemo(() => {
    const out: number[] = []
    for (let b = Math.ceil(Math.max(0, t0) / windowMs) * windowMs; b <= now.current; b += windowMs) out.push(b)
    return out
  }, [t0, windowMs])

  return (
    <DemoFrame title="Five rate limiters, one request stream" onReset={reset}
      hint={`Limit: ${limit} requests per ${windowMs / 1000}s. Green = served (leaky bucket shows when the request leaves the queue), red = rejected with 429. Try “Boundary attack”.`}>
      <div className="rl__controls">
        <Slider label="Limit (requests)" min={2} max={20} value={limit} onChange={setLimit} />
        <Slider label="Window" min={1000} max={5000} step={500} value={windowMs} onChange={setWindowMs} format={(v) => `${v / 1000}s`} />
        <Slider label="Steady traffic" min={0} max={15} value={rate} onChange={setRate} format={(v) => `${v} req/s`} />
        <div className="rl__buttons">
          <Button size="sm" onClick={() => setRunning(!running)}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Pause' : 'Play'}</Button>
          <Button size="sm" onClick={burst}><Zap size={14} />Burst ×12</Button>
          <Button size="sm" variant="primary" onClick={boundaryAttack}><Swords size={14} />Boundary attack</Button>
        </div>
      </div>

      <div className="rl__rows">
        {limiters.current.map((l) => {
          const hs = hits.current[l.key] ?? []
          const visible = hs.filter((h) => (h.served ?? h.t) <= now.current && (h.served ?? h.t) >= t0)
          const served = visible.filter((h) => h.served != null).map((h) => h.served as number).sort((a, b) => a - b)
          const rejected = visible.length - served.length
          const peak = peakPerWindow(served, windowMs)
          const queued = hs.filter((h) => h.served != null && h.served > now.current).length
          return (
            <div key={l.key} className="rl__row">
              <div className="rl__meta">
                <strong>{l.name}</strong>
                <span className="rl__stats mono">
                  <b className="ok">{served.length}</b> ok · <b className="no">{rejected}</b> 429
                  {l.key === 'leaky' && queued > 0 && <> · {queued} queued</>}
                </span>
                <span className={`rl__peak mono ${peak > limit ? 'is-over' : ''}`}>peak {peak}/{limit} per window</span>
              </div>
              <svg className="rl__lane" viewBox="0 0 1000 36" preserveAspectRatio="none" aria-hidden>
                {boundaries.map((b) => <line key={b} x1={x(b)} x2={x(b)} y1={0} y2={36} className="rl__boundary" vectorEffect="non-scaling-stroke" />)}
                {visible.map((h, i) => (
                  <rect key={i} x={x(h.served ?? h.t) - 1.5} width={3} y={h.served != null ? 6 : 20} height={h.served != null ? 12 : 10}
                    className={h.served != null ? 'rl__ok' : 'rl__no'} />
                ))}
              </svg>
            </div>
          )
        })}
      </div>
      <p className="rl__legend">Dashed lines mark fixed-window boundaries. Timeline shows the last 10 s; a “peak” above the limit means more than {limit} requests got through inside one {windowMs / 1000}s span.</p>
    </DemoFrame>
  )
}
