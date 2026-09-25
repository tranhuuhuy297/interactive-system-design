import { useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import './estimation-demos.css'

const YEAR_MIN = 365.25 * 24 * 60

function fmtMinutes(m: number): string {
  if (m >= 1440) return `${(m / 1440).toFixed(1)} days`
  if (m >= 60) return `${(m / 60).toFixed(1)} h`
  if (m >= 1) return `${m.toFixed(1)} min`
  return `${(m * 60).toFixed(1)} s`
}

const pct = (a: number) => `${(a * 100).toFixed(a > 0.9999 ? 4 : 3).replace(/0+$/, '').replace(/\.$/, '')}%`

export function EstimationNinesCalculator() {
  const [nines, setNines] = useState(3)
  const [deps, setDeps] = useState(4)
  const [replicas, setReplicas] = useState(1)

  const a = 1 - 10 ** -nines
  const component = 1 - (1 - a) ** replicas // redundant copies of each dependency, independent failures assumed
  const system = component ** deps // serial chain: every dependency must be up
  const down = (x: number) => (1 - x) * YEAR_MIN

  const reset = () => { setNines(3); setDeps(4); setReplicas(1) }

  return (
    <DemoFrame title="Availability math: serial chains and redundancy" onReset={reset}
      hint="Serial dependencies multiply availability, which makes it worse. Redundant replicas multiply failure probability, which makes it better. Failures are assumed independent, which real ones often are not.">
      <div className="est-nines">
        <div className="demo-controls">
          <Slider label="Each dependency's availability" min={1} max={5} step={0.5} value={nines} onChange={setNines} format={() => pct(a)} />
          <Slider label="Serial dependencies on the request path" min={1} max={12} value={deps} onChange={setDeps} />
          <Slider label="Redundant replicas per dependency" min={1} max={3} value={replicas} onChange={setReplicas} />
        </div>
        <div className="est-nines__out">
          <div className="est-nines__big">
            <span className="demo-label">End-to-end availability</span>
            <strong className="mono">{pct(system)}</strong>
            <span>≈ {fmtMinutes(down(system))} down / year</span>
          </div>
          <table>
            <thead><tr><th>Level</th><th>Per year</th><th>Per month</th><th>Per day</th></tr></thead>
            <tbody>
              {[0.99, 0.999, 0.9999, 0.99999].map((x) => (
                <tr key={x} className={system >= x ? 'is-met' : ''}>
                  <td className="mono">{pct(x)}</td>
                  <td className="mono">{fmtMinutes(down(x))}</td>
                  <td className="mono">{fmtMinutes(down(x) / 12)}</td>
                  <td className="mono">{fmtMinutes(down(x) / 365.25)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DemoFrame>
  )
}
