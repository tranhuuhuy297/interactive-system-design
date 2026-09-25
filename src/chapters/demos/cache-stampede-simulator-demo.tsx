import { useMemo, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { simulateStampede, summarize, type Mode } from './cache-stampede-model'
import './cache-demos.css'

const MODES: { id: Mode; label: string; note: string }[] = [
  { id: 'none', label: 'No protection', note: 'Every miss queries the DB until the first refill lands.' },
  { id: 'coalesce', label: 'Request coalescing', note: 'Single-flight: one fetch, everyone else waits on it.' },
  { id: 'early', label: 'Probabilistic early refresh', note: 'XFetch: one lucky request refreshes before expiry, so nobody waits.' },
]
const W = 600
const H = 90

export function CacheStampedeSimulatorDemo() {
  const [rps, setRps] = useState(2000)
  const [ttl, setTtl] = useState(8)
  const [lat, setLat] = useState(600)
  const [dbCap, setDbCap] = useState(500)

  const runs = useMemo(() => MODES.map((m) => {
    const buckets = simulateStampede({ rps, ttlMs: ttl * 1000, dbLatencyMs: lat, mode: m.id })
    return { ...m, buckets, sum: summarize(buckets) }
  }), [rps, ttl, lat])
  const maxY = Math.max(dbCap * 1.2, ...runs.map((r) => r.sum.peakDbPerSec))

  return (
    <DemoFrame title="Cache stampede on one hot key" onReset={() => { setRps(2000); setTtl(8); setLat(600); setDbCap(500) }}
      hint="A popular key expires every TTL. Watch DB queries per second in each strategy. The dashed line is what your DB can take.">
      <div className="cst__controls">
        <Slider label="Requests / s on the key" min={50} max={5000} step={50} value={rps} onChange={setRps} />
        <Slider label="TTL" min={2} max={15} value={ttl} onChange={setTtl} format={(v) => `${v}s`} />
        <Slider label="DB recompute latency" min={50} max={2000} step={50} value={lat} onChange={setLat} format={(v) => `${v} ms`} />
        <Slider label="DB capacity" min={50} max={3000} step={50} value={dbCap} onChange={setDbCap} format={(v) => `${v} q/s`} />
      </div>
      <div className="cst__charts">
        {runs.map((r) => {
          const over = r.sum.peakDbPerSec > dbCap
          const bw = W / r.buckets.length
          const capY = H - (dbCap / maxY) * H
          return (
            <div key={r.id} className={`cst__run ${over ? 'is-over' : ''}`}>
              <div className="cst__head">
                <strong>{r.label}</strong>
                <span className="mono">peak {Math.round(r.sum.peakDbPerSec).toLocaleString()} q/s · {r.sum.totalDb.toLocaleString()} queries</span>
                {over ? <span className="badge badge--danger">DB overloaded</span> : <span className="badge badge--success">safe</span>}
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="cst__svg" role="img"
                aria-label={`${r.label}: peak ${Math.round(r.sum.peakDbPerSec)} DB queries per second`}>
                {r.buckets.map((b, i) => {
                  const h = ((b.db * 10) / maxY) * H
                  const wait = b.waiting > 0
                  return (
                    <g key={i}>
                      {wait && <rect x={i * bw} y={H - 4} width={bw} height={4} className="cst__wait" />}
                      {h > 0 && <rect x={i * bw} y={H - Math.max(h, 1.5)} width={Math.max(bw - 0.5, 0.5)} height={Math.max(h, 1.5)} className="cst__bar" />}
                    </g>
                  )
                })}
                <line x1={0} x2={W} y1={capY} y2={capY} className="cst__cap" />
              </svg>
              <p className="cst__note">{r.note}{r.sum.waited > 0 && ` ${r.sum.waited.toLocaleString()} request-waits (yellow).`}</p>
            </div>
          )
        })}
      </div>
      <p className="cst__foot">Toy model over 30 s in 100 ms buckets. In the “no protection” case, DB load ≈ rps × recompute latency per expiry, which is why slow queries make stampedes worse.</p>
    </DemoFrame>
  )
}
