import { useMemo, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { judgeBias } from './ai-eval-harness-model'
import './ai-eval-demos.css'

const PAIRS = 2000

export function AiEvalJudgeBiasDemo() {
  const [truth, setTruth] = useState(0.6)
  const [bias, setBias] = useState(0.3)
  const r = useMemo(() => judgeBias(PAIRS, truth, bias, 11), [truth, bias])

  const rows = [
    { label: 'B shown first', value: r.bFirst, note: 'inflated by position bias' },
    { label: 'B shown second', value: r.bSecond, note: 'deflated by position bias' },
    { label: 'Swap order, keep consistent verdicts', value: r.swapped, note: `${Math.round(r.tieRate * 100)}% of pairs disagree → ties`, fixed: true },
  ]

  return (
    <DemoFrame title="LLM-as-judge position bias, and the swap fix" onReset={() => { setTruth(0.6); setBias(0.3) }}
      hint={`A simulated pairwise judge over ${PAIRS.toLocaleString('en-US')} answer pairs: with some probability it simply prefers whichever answer it reads first. Toy model.`}>
      <div className="aijb">
        <div className="aijb__controls">
          <Slider label="True share of pairs where B is better" min={0.3} max={0.8} step={0.05} value={truth} onChange={setTruth} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Judge position bias" min={0} max={0.6} step={0.05} value={bias} onChange={setBias} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
        <div className="aijb__bars">
          {rows.map((row) => {
            const off = Math.abs(row.value - truth) * 100
            return (
              <div key={row.label} className={`aijb__row ${row.fixed ? 'is-fixed' : ''}`}>
                <span className="aijb__label">{row.label}<small>{row.note}</small></span>
                <div className="aijb__track">
                  <i style={{ width: `${row.value * 100}%` }} />
                  <b style={{ left: `${truth * 100}%` }} aria-hidden />
                </div>
                <span className="aijb__val mono">{Math.round(row.value * 100)}% <small>{off < 1.5 ? '≈ truth' : `${off.toFixed(0)} pts off`}</small></span>
              </div>
            )
          })}
        </div>
        <p className="aijb__note">The vertical tick is the true win rate. Running each comparison in both orders and discarding inconsistent verdicts removes the bias; the tie rate itself is a useful measure of judge reliability.</p>
      </div>
    </DemoFrame>
  )
}
