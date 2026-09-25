import { useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { computeCost, type CostInputs } from './ai-prod-cost-model'
import './ai-prod-demos.css'

// Illustrative defaults only: a "large" and a "small" model tier, not any vendor's price list.
const DEFAULTS: CostInputs = {
  requestsPerDay: 100_000, inputTokens: 2_000, outputTokens: 400, smallModelShare: 0,
  largePriceIn: 3, largePriceOut: 15, smallPriceIn: 0.25, smallPriceOut: 1.25,
  exactHit: 0.1, semanticHit: 0, semanticFalseHit: 0.02,
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const pct = (n: number) => `${Math.round(n * 100)}%`

export function AiProdCostDemo() {
  const [v, setV] = useState<CostInputs>(DEFAULTS)
  const set = <K extends keyof CostInputs>(k: K) => (x: CostInputs[K]) => setV((p) => ({ ...p, [k]: x }))
  const r = computeCost(v)
  const saving = r.monthlyCostNoCache > 0 ? 1 - r.monthlyCost / r.monthlyCostNoCache : 0

  const price = (k: 'largePriceIn' | 'largePriceOut' | 'smallPriceIn' | 'smallPriceOut', label: string) => (
    <label className="aip__price">
      <span>{label}</span>
      <input type="number" min={0} step={0.05} value={v[k]} aria-label={`${label} price per 1M tokens`}
        onChange={(e) => set(k)(Math.max(0, Number(e.target.value) || 0))} />
    </label>
  )

  return (
    <DemoFrame title="Cost and latency of an LLM feature, with caching and model routing" onReset={() => setV(DEFAULTS)}
      hint="Prices and latencies are illustrative defaults; edit them to match your provider. Toy model.">
      <div className="aip">
        <div className="demo-controls">
          <Slider label="Requests / day" min={10_000} max={1_000_000} step={10_000} value={v.requestsPerDay}
            onChange={set('requestsPerDay')} format={(x) => x.toLocaleString('en-US')} />
          <Slider label="Input tokens / request" min={100} max={8_000} step={100} value={v.inputTokens} onChange={set('inputTokens')} />
          <Slider label="Output tokens / request" min={50} max={2_000} step={50} value={v.outputTokens} onChange={set('outputTokens')} />
          <Slider label="Exact-cache hit rate" min={0} max={0.6} step={0.01} value={v.exactHit} onChange={set('exactHit')} format={pct} />
          <Slider label="Semantic-cache hit rate (of misses)" min={0} max={0.6} step={0.01} value={v.semanticHit} onChange={set('semanticHit')} format={pct} />
          <Slider label="Semantic false-hit rate" min={0} max={0.1} step={0.005} value={v.semanticFalseHit} onChange={set('semanticFalseHit')}
            format={(x) => `${(x * 100).toFixed(1)}%`} />
          <Slider label="Misses routed to small model" min={0} max={1} step={0.05} value={v.smallModelShare} onChange={set('smallModelShare')} format={pct} />
          <fieldset className="aip__prices">
            <legend>$ per 1M tokens (illustrative)</legend>
            {price('largePriceIn', 'Large in')}{price('largePriceOut', 'Large out')}
            {price('smallPriceIn', 'Small in')}{price('smallPriceOut', 'Small out')}
          </fieldset>
        </div>

        <div className="aip__out">
          <div className="aip__big">
            <span>Monthly model cost</span>
            <strong>{usd(r.monthlyCost)}</strong>
            <small>vs {usd(r.monthlyCostNoCache)} with no cache, all large model ({saving >= 0 ? '−' : '+'}{pct(Math.abs(saving))})</small>
          </div>
          <div className="aip__share" aria-label="Where requests are served">
            {(['exact', 'semantic', 'small', 'large'] as const).map((k) => (
              <i key={k} className={`aip__seg aip__seg--${k}`} style={{ flexGrow: r.shares[k] }} title={`${k}: ${pct(r.shares[k])}`} />
            ))}
          </div>
          <ul className="aip__legend">
            <li><i className="aip__seg--exact" /> Exact cache {pct(r.shares.exact)}</li>
            <li><i className="aip__seg--semantic" /> Semantic cache {pct(r.shares.semantic)}</li>
            <li><i className="aip__seg--small" /> Small model {pct(r.shares.small)}</li>
            <li><i className="aip__seg--large" /> Large model {pct(r.shares.large)}</li>
          </ul>
          <dl className="aip__stats">
            <div><dt>Model calls / day</dt><dd>{Math.round(r.modelCalls).toLocaleString('en-US')}</dd></div>
            <div><dt>Avg time to full answer</dt><dd>{(r.avgLatencyMs / 1000).toFixed(1)} s</dd></div>
            <div className={r.wrongAnswersPerDay > 0 ? 'is-risk' : ''}>
              <dt>Wrong cached answers / day</dt><dd>{Math.round(r.wrongAnswersPerDay).toLocaleString('en-US')}</dd>
            </div>
          </dl>
          <p className="aip__note">
            The semantic cache trades cost for correctness: every false hit serves an answer to a question the user
            didn’t ask. Tune its similarity threshold against a labeled set, not by intuition.
          </p>
        </div>
      </div>
    </DemoFrame>
  )
}
