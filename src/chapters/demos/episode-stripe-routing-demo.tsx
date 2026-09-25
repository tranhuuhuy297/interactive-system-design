import { useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { DemoFrame, Segmented } from '../../components/ui'
import { PER_TICK, initialState, step, type Outage, type Policy } from './episode-stripe-routing-model'
import './episode-stripe-demos.css'

const POLICIES: { value: Policy; label: string }[] = [
  { value: 'primary', label: 'A only' },
  { value: 'split', label: '50/50 split' },
  { value: 'smart', label: 'Health-aware' },
  { value: 'blind', label: 'Retry anything on B' },
]
const OUTAGES: { value: Outage; label: string }[] = [
  { value: 'none', label: 'Healthy' },
  { value: 'down', label: 'A refuses connections' },
  { value: 'timeout', label: 'A times out' },
]

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—')

export function EpisodeStripeRoutingDemo() {
  const [policy, setPolicy] = useState<Policy>('primary')
  const [outage, setOutage] = useState<Outage>('none')
  const [running, setRunning] = useState(true)
  const [sim, setSim] = useState(initialState)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setSim((s) => step(s, policy, outage)), 450)
    return () => clearInterval(t)
  }, [running, policy, outage])

  const reset = () => { setSim(initialState()); setPolicy('primary'); setOutage('none'); setRunning(true) }
  const choosePolicy = (p: Policy) => { setPolicy(p); setSim(initialState()) }
  const { totals: tt } = sim
  const resolved = tt.ok + tt.declined + tt.failed

  return (
    <DemoFrame title="Processor failover: which retries are safe?" onReset={reset}
      hint="Break processor A, then compare policies. A refused connection means no charge happened. A timeout means you don't know. Toy model, illustrative rates.">
      <div className="str-rt__controls">
        <div><span className="demo-label">Routing policy</span>
          <Segmented label="Routing policy" options={POLICIES} value={policy} onChange={choosePolicy} /></div>
        <div><span className="demo-label">Processor A</span>
          <Segmented label="Processor A health" options={OUTAGES} value={outage} onChange={setOutage} /></div>
        <button className="btn btn--secondary btn--sm" onClick={() => setRunning((r) => !r)} aria-pressed={running}>
          {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Run</>}
        </button>
      </div>

      <div className="str-rt__stats" aria-live="off">
        <div><span>Succeeded</span><strong>{pct(tt.ok, resolved + tt.pending)}</strong></div>
        <div><span>Failed</span><strong className={tt.failed ? 'str-rt__bad' : ''}>{tt.failed}</strong></div>
        <div><span>Awaiting status check</span><strong className={tt.pending ? 'str-rt__warn' : ''}>{tt.pending}</strong></div>
        <div><span>Double charges</span><strong className={tt.doubled ? 'str-rt__bad' : ''}>{tt.doubled}</strong></div>
        <div><span>Calls to B</span><strong>{pct(tt.callsB, tt.callsA + tt.callsB)}</strong></div>
        <div><span>Breaker on A</span><strong className={sim.breakerOpen ? 'str-rt__warn' : ''}>{policy === 'smart' ? (sim.breakerOpen ? 'open' : 'closed') : 'n/a'}</strong></div>
      </div>

      <div className="str-rt__chart" role="img" aria-label="Outcome per tick, most recent on the right">
        {sim.history.map((h, i) => (
          <div key={sim.tick - sim.history.length + i} className="str-rt__col">
            {(['ok', 'declined', 'pending', 'failed', 'doubled'] as const).map((k) =>
              h[k] ? <i key={k} className={`str-rt__seg str-rt__seg--${k}`} style={{ height: `${(h[k] / PER_TICK) * 100}%` }} /> : null)}
          </div>
        ))}
      </div>
      <div className="str-rt__legend">
        <span><i className="str-rt__seg--ok" /> Succeeded</span><span><i className="str-rt__seg--declined" /> Declined by bank</span>
        <span><i className="str-rt__seg--pending" /> Timed out, checking status</span><span><i className="str-rt__seg--failed" /> Failed</span>
        <span><i className="str-rt__seg--doubled" /> Double charge</span>
      </div>
    </DemoFrame>
  )
}
