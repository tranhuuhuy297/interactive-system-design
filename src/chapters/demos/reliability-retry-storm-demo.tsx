import { useMemo, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { simulateRetries, type RetryPolicy } from './reliability-sim'
import './reliability-demos.css'

const TICKS = 80
const POLICIES: { key: RetryPolicy; label: string }[] = [
  { key: 'immediate', label: 'Retry immediately' },
  { key: 'exponential', label: 'Exponential backoff' },
  { key: 'jitter', label: 'Exponential + full jitter' },
]

export function ReliabilityRetryStormDemo() {
  const [clients, setClients] = useState(1000)
  const [capacity, setCapacity] = useState(100)
  const [outage, setOutage] = useState(10)
  const runs = useMemo(() => POLICIES.map((p) => ({ ...p, run: simulateRetries(p.key, clients, capacity, outage, TICKS) })), [clients, capacity, outage])
  const maxY = Math.max(capacity * 2, ...runs.flatMap((r) => r.run.attempts))

  return (
    <DemoFrame title="Retry storm: same outage, three retry policies"
      onReset={() => { setClients(1000); setCapacity(100); setOutage(10) }}
      hint="Every client fails during the outage, then retries. Bars = attempts per tick, green = served. The dashed line is server capacity. Toy model: above 2× capacity, goodput collapses because the server wastes work on requests that time out.">
      <div className="rs__controls">
        <Slider label="Clients" min={200} max={2000} step={100} value={clients} onChange={setClients} />
        <Slider label="Capacity / tick" min={50} max={400} step={10} value={capacity} onChange={setCapacity} />
        <Slider label="Outage length" min={3} max={20} value={outage} onChange={setOutage} format={(v) => `${v} ticks`} />
      </div>
      <div className="rs__charts">
        {runs.map(({ key, label, run }) => (
          <figure key={key} className="rs__chart">
            <figcaption>
              <strong>{label}</strong>
              <span className={`mono ${run.doneAt === null ? 'is-bad' : 'is-good'}`}>
                {run.doneAt === null ? `never recovers in ${TICKS} ticks` : `all clients served by tick ${run.doneAt}`}
              </span>
            </figcaption>
            <svg viewBox={`0 0 ${TICKS * 5} 100`} preserveAspectRatio="none" role="img" aria-label={`${label} load over time`}>
              <rect x="0" y="0" width={outage * 5} height="100" className="rs__outage" />
              {run.attempts.map((a, t) => {
                const h = (a / maxY) * 96
                const s = (run.served[t] / maxY) * 96
                return (
                  <g key={t}>
                    <rect x={t * 5 + 0.5} y={100 - h} width={4} height={h} className="rs__attempt" />
                    <rect x={t * 5 + 0.5} y={100 - s} width={4} height={s} className="rs__served" />
                  </g>
                )
              })}
              <line x1="0" x2={TICKS * 5} y1={100 - (capacity / maxY) * 96} y2={100 - (capacity / maxY) * 96} className="rs__cap" vectorEffect="non-scaling-stroke" />
            </svg>
          </figure>
        ))}
      </div>
      <p className="rs__note">
        Without backoff, the recovering server is buried under retries forever. That is a <b>metastable failure</b>: the trigger is gone, but the load it caused keeps the system down.
        Plain exponential backoff keeps clients synchronized, so they hit in waves. Jitter spreads them out.
      </p>
    </DemoFrame>
  )
}
