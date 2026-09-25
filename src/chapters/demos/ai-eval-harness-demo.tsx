import { useMemo, useState } from 'react'
import { Badge, Button, DemoFrame, Segmented, Slider } from '../../components/ui'
import { makeResults, summarize } from './ai-eval-harness-model'
import './ai-eval-demos.css'

const SIZES = ['30', '100', '300', '1000'] as const
type Size = (typeof SIZES)[number]
const SHOWN = 300
const AXIS = 0.15 // ±15 points on the difference axis

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const pts = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}`

export function AiEvalHarnessDemo() {
  const [size, setSize] = useState<Size>('100')
  const [lift, setLift] = useState(0.04)
  const [seed, setSeed] = useState(1)
  const n = Number(size)
  const { a, b } = useMemo(() => makeResults(n, seed, 0.7, lift), [n, seed, lift])
  const s = useMemo(() => summarize(a, b, seed + 1), [a, b, seed])

  const counts = { both: 0, onlyB: 0, onlyA: 0, none: 0 }
  a.forEach((x, i) => { if (x && b[i]) counts.both++; else if (b[i]) counts.onlyB++; else if (x) counts.onlyA++; else counts.none++ })
  const pos = (x: number) => `${((Math.max(-AXIS, Math.min(AXIS, x)) + AXIS) / (2 * AXIS)) * 100}%`

  return (
    <DemoFrame title="Is prompt B actually better? Paired eval with a bootstrap CI"
      onReset={() => { setSize('100'); setLift(0.04); setSeed(1) }}
      hint="Each square is one labeled test case graded under both prompt versions. The true lift is known here; in real life it isn’t, which is why you need the interval.">
      <div className="aiev">
        <div className="aiev__controls">
          <div><div className="demo-label">Eval set size</div><Segmented label="Eval set size" value={size} onChange={setSize} options={SIZES} /></div>
          <Slider label="True lift of B" min={0} max={0.1} step={0.01} value={lift} onChange={setLift} format={(v) => `+${Math.round(v * 100)} pts`} />
          <Button size="sm" onClick={() => setSeed((x) => x + 1)}>Re-sample test set</Button>
        </div>

        <div className="aiev__grid" aria-label={`${n} test cases`}>
          {a.slice(0, SHOWN).map((x, i) => (
            <i key={i} className={x && b[i] ? 'is-both' : b[i] ? 'is-b' : x ? 'is-a' : 'is-none'} />
          ))}
        </div>
        <div className="aiev__legend">
          <span><i className="is-both" /> both pass · {counts.both}</span>
          <span><i className="is-b" /> only B passes · {counts.onlyB}</span>
          <span><i className="is-a" /> only A passes · {counts.onlyA}</span>
          <span><i className="is-none" /> both fail · {counts.none}</span>
          {n > SHOWN && <em>showing {SHOWN} of {n}</em>}
        </div>

        <div className="aiev__result">
          <div className="aiev__scores">
            <div><span>Prompt A</span><strong>{pct(s.scoreA)}</strong></div>
            <div><span>Prompt B</span><strong>{pct(s.scoreB)}</strong></div>
          </div>
          <div className="aiev__ci">
            <div className="demo-label">B − A, 95% bootstrap interval (points)</div>
            <div className="aiev__axis">
              <span className="aiev__zero" style={{ left: pos(0) }} />
              <span className="aiev__range" style={{ left: pos(s.lo), width: `calc(${pos(s.hi)} - ${pos(s.lo)})` }} />
              <span className="aiev__dot" style={{ left: pos(s.diff) }} />
            </div>
            <div className="aiev__ticks"><span>−15</span><span>0</span><span>+15</span></div>
            <p className="aiev__verdict">
              <Badge tone={s.significant ? 'success' : 'warning'}>{s.significant ? 'Difference is real' : 'Could be noise'}</Badge>
              <span>{pts(s.diff)} pts, interval [{pts(s.lo)}, {pts(s.hi)}]</span>
            </p>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
