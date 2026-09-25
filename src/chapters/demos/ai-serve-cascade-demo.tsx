import { useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { LARGE, evaluatePolicies } from './ai-serve-cascade-model'
import './ai-serve-demos.css'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`

export function AiServeCascadeDemo() {
  const [easyShare, setEasy] = useState(0.7)
  const [routerAccuracy, setRouter] = useState(0.85)
  const [checkRecall, setRecall] = useState(0.8)
  const results = evaluatePolicies({ easyShare, routerAccuracy, checkRecall })
  const large = results.find((r) => r.id === 'large')!
  // "Best" = cheapest policy within 2 quality points of large-only.
  const best = results.filter((r) => r.quality >= large.quality - 0.02).sort((a, b) => a.cost - b.cost)[0]

  const reset = () => { setEasy(0.7); setRouter(0.85); setRecall(0.8) }

  return (
    <DemoFrame title="Model routing: small, large, router, or cascade?" onReset={reset}
      hint="Illustrative units: the large model costs 10× the small one per request and takes 4× longer. Qualities are made up to show the shape of the trade-off.">
      <div className="aisrv">
        <div className="demo-controls">
          <Slider label="Share of easy requests" min={0.1} max={0.95} step={0.05} value={easyShare} onChange={setEasy} format={pct} />
          <Slider label="Router accuracy (upfront difficulty guess)" min={0.5} max={0.99} step={0.01} value={routerAccuracy} onChange={setRouter} format={pct} />
          <Slider label="Cascade check recall (catches small-model misses)" min={0} max={1} step={0.05} value={checkRecall} onChange={setRecall} format={pct} />
          <p className="aisrv__note">
            Highlighted: the cheapest policy within 2 quality points of always using the large model.
          </p>
        </div>

        <div className="aisrv__table" role="table" aria-label="Policy comparison">
          <div className="aisrv__row aisrv__row--head" role="row">
            <span role="columnheader">Policy</span><span role="columnheader">Cost</span><span role="columnheader">Quality</span><span role="columnheader">Latency</span>
          </div>
          {results.map((r) => (
            <div key={r.id} role="row" className={`aisrv__row ${best?.id === r.id ? 'is-best' : ''}`}>
              <span role="cell" className="aisrv__name">{r.label}</span>
              <span role="cell" className="aisrv__cell">
                <i style={{ width: `${(r.cost / LARGE.cost) * 100}%` }} />
                <b>{Math.round((r.cost / LARGE.cost) * 100)}%</b>
              </span>
              <span role="cell" className="aisrv__cell aisrv__cell--q">
                <i style={{ width: `${r.quality * 100}%` }} />
                <b>{pct(r.quality)}</b>
              </span>
              <span role="cell" className="aisrv__cell aisrv__cell--l">
                <i style={{ width: `${(r.latency / LARGE.latency) * 100}%` }} />
                <b>{r.latency.toFixed(2)}s</b>
              </span>
            </div>
          ))}
          <p className="aisrv__foot">Cost and latency shown relative to “large only”. The cascade assumes anything the small model solves, the large model also solves.</p>
        </div>
      </div>
    </DemoFrame>
  )
}
