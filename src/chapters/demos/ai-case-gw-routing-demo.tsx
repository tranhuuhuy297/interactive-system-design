import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { PROVIDERS, simulateGateway, type FailureMode, type Policy } from './ai-case-gw-routing-model'
import './ai-case-gw-demos.css'

const POLICIES: { value: Policy; label: string }[] = [
  { value: 'primary', label: 'Primary only' },
  { value: 'weighted', label: 'Weighted split' },
  { value: 'adaptive', label: 'Latency-aware + fallback' },
]

const DEFAULT_FAIL = { a: 0.6, b: 0, c: 0 }

export function AiCaseGwRoutingDemo() {
  const [policy, setPolicy] = useState<Policy>('primary')
  const [mode, setMode] = useState<FailureMode>('timeout')
  const [fail, setFail] = useState<Record<string, number>>(DEFAULT_FAIL)
  const r = simulateGateway({ policy, failureMode: mode, failRate: fail })
  const reset = () => { setPolicy('primary'); setMode('timeout'); setFail(DEFAULT_FAIL) }

  return (
    <DemoFrame title="Route 1,000 requests while a provider misbehaves" onReset={reset}
      hint="Deterministic toy simulation. Prices and latencies are illustrative, not any vendor’s real numbers.">
      <div className="gwr">
        <div className="demo-controls">
          <Segmented label="Routing policy" options={POLICIES} value={policy} onChange={setPolicy} />
          <Segmented label="Failure mode" value={mode} onChange={setMode}
            options={[{ value: 'timeout', label: 'Timeouts (5xx)' }, { value: 'rate-limit', label: '429 rate limits' }]} />
          {PROVIDERS.map((p) => (
            <Slider key={p.id} label={`${p.name} failure rate`} min={0} max={1} step={0.05} value={fail[p.id]}
              onChange={(v) => setFail((f) => ({ ...f, [p.id]: v }))} format={(v) => `${Math.round(v * 100)}%`} />
          ))}
        </div>

        <div className="gwr__stage">
          <div className="gwr__stats">
            <div className={r.successRate < 0.99 ? 'is-bad' : 'is-good'}><span>Success</span><strong>{(r.successRate * 100).toFixed(1)}%</strong></div>
            <div className={r.p95Ms > 2000 ? 'is-bad' : ''}><span>p95 latency</span><strong>{r.p95Ms.toLocaleString('en-US')} ms</strong></div>
            <div><span>Cost (illustrative)</span><strong>${r.cost.toFixed(2)}</strong></div>
            <div><span>Attempts / request</span><strong>{r.attemptsPerRequest.toFixed(2)}</strong></div>
          </div>
          <div className="gwr__served">
            <span className="demo-label">Requests served by</span>
            {PROVIDERS.map((p) => (
              <div key={p.id} className="gwr__row">
                <span>{p.name}<small className="mono"> · p50 {p.p50Ms} ms · ${p.pricePerMTok}/M tok</small></span>
                <div className="gwr__bar"><i style={{ width: `${(r.served[p.id] / 1000) * 100}%` }} /></div>
                <span className="mono">{r.served[p.id]}</span>
              </div>
            ))}
          </div>
          <p className="gwr__note">
            {policy === 'primary' && 'Every failure reaches the user. With timeouts, each failed request also burns the full timeout.'}
            {policy === 'weighted' && 'Spreading traffic limits the blast radius but still sends a fixed share into the failing provider.'}
            {policy === 'adaptive' && 'A circuit breaker stops sending to the failing provider after a few errors and fails over to the next one, probing periodically to detect recovery.'}
          </p>
        </div>
      </div>
    </DemoFrame>
  )
}
