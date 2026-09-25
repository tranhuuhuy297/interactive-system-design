import { useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { BURN_FAST, SLO_BUDGET, countPages, detectionDelay, errorRateSeries, evaluate, type Rule } from './metrics-model'
import './metrics-demos.css'

const W = 600
const H = 150
const MAX = 5 // y-axis max, % errors
const x = (i: number, n: number) => (i / (n - 1)) * W
// Square-root scale so the healthy 0.05% baseline and a 4% incident are both readable.
const y = (v: number) => H - Math.sqrt(Math.min(v, MAX) / MAX) * H

/** Same data, three alert rules: count pages, false alarms, and time to detect the real incident. */
export function MetricsAlertEvaluatorDemo() {
  const data = useMemo(() => errorRateSeries(), [])
  const [rule, setRule] = useState<Rule>('threshold')
  const [threshold, setThreshold] = useState(0.15)
  const [forMin, setForMin] = useState(5)

  const firing = useMemo(() => evaluate(data, rule, threshold, forMin), [data, rule, threshold, forMin])
  const pages = countPages(firing)
  const falsePages = countPages(firing.map((f, i) => f && (i < 100 || i > 135)))
  const delay = detectionDelay(firing)
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i, data.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const lineY = rule === 'burn' ? y(BURN_FAST * SLO_BUDGET) : y(threshold)

  return (
    <DemoFrame title="Alert rules on noisy data" onReset={() => { setRule('threshold'); setThreshold(0.15); setForMin(5) }}
      hint="Error rate of a 99.9% service over 3 hours (√ scale). A real incident starts at minute 100; the one-minute blips are normal noise.">
      <div className="mt-al__controls">
        <Segmented label="Rule" value={rule} onChange={setRule}
          options={[{ value: 'threshold', label: 'rate > X' }, { value: 'for', label: 'rate > X for N min' }, { value: 'burn', label: 'SLO burn rate (1h & 5m)' }]} />
        {rule !== 'burn' && <Slider label="Threshold X" min={0.05} max={1} step={0.05} value={threshold} onChange={setThreshold} format={(v) => `${v.toFixed(2)}%`} />}
        {rule === 'for' && <Slider label="For N minutes" min={1} max={15} value={forMin} onChange={setForMin} format={(v) => `${v} min`} />}
      </div>

      <svg viewBox={`0 0 ${W} ${H + 22}`} className="mt-al__chart" role="img" aria-label="Error rate with firing periods">
        <rect x={x(100, data.length)} y={0} width={x(130, data.length) - x(100, data.length)} height={H} className="mt-al__incident" />
        <path d={line} className="mt-al__line" />
        <line x1={0} x2={W} y1={lineY} y2={lineY} className="mt-al__thresh" />
        {firing.map((f, i) => f && <rect key={i} x={x(i, data.length)} y={H + 8} width={W / data.length + 0.5} height={10} className="mt-al__fire" />)}
        <text x={4} y={H + 20} className="mt-al__lbl">firing</text>
      </svg>

      <div className="mt-al__stats">
        <div><span>Pages sent</span><strong>{pages}</strong></div>
        <div><span>False pages</span><strong className={falsePages ? 'mt-bad' : 'mt-ok'}>{falsePages}</strong></div>
        <div><span>Time to detect incident</span><strong>{delay == null ? 'missed' : `${delay} min`}</strong></div>
      </div>
      <p className="mt-note">
        {rule === 'burn'
          ? `Pages when both the 1 h and 5 m windows burn the 99.9% SLO budget ≥ ${BURN_FAST}× (error rate ≥ ${(BURN_FAST * SLO_BUDGET).toFixed(2)}%). The long window blocks noise and the short one clears the alert quickly after recovery. Detection time scales inversely with severity: a total outage fires in under a minute, this 4% incident takes ~20. Real setups add a slower tier (e.g. 6× over 6 h / 30 m) for tickets.`
          : rule === 'for'
            ? 'A for-duration suppresses short blips but adds exactly that much delay to every real incident.'
            : 'A raw threshold on noisy data flaps: every wobble above the line is a page at 3 a.m.'}
      </p>
    </DemoFrame>
  )
}
