import { useState } from 'react'
import { Crown, Skull } from 'lucide-react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { initState, killLeader, reviveAll, tick, type Acks, type ReplConfig, type ReplState } from './mqd-replication-model'
import './mqd-replication-demo.css'

const SHOW = 24

export function MqdReplicationDemo() {
  const [cfg, setCfg] = useState<ReplConfig>({ acks: '1', minIsr: 2, maxLag: 5, unclean: false })
  const [rates, setRates] = useState<[number, number]>([0.8, 0.5])
  const [s, setS] = useState<ReplState>(() => initState([0.8, 0.5]))

  const reset = (r = rates) => setS(initState(r))
  const produce = (n: number) => setS((p) => { let x = p; for (let i = 0; i < n; i++) x = tick(x, cfg); return x })
  const setRate = (i: 0 | 1, v: number) => {
    const next: [number, number] = [...rates] as [number, number]
    next[i] = v
    setRates(next)
    setS((p) => ({ ...p, replicas: p.replicas.map((r) => (r.id === `B${i + 2}` && r.id !== p.leader ? { ...r, rate: v } : r)) }))
  }
  const leaderLeo = s.replicas.find((r) => r.id === s.leader)?.leo ?? 0
  const offset0 = Math.max(0, Math.max(leaderLeo, ...s.replicas.map((r) => r.leo)) - SHOW)

  return (
    <DemoFrame title="Replication: acks, ISR, and the high watermark" onReset={() => { setCfg({ acks: '1', minIsr: 2, maxLag: 5, unclean: false }); setRates([0.8, 0.5]); reset([0.8, 0.5]) }}
      hint="Produce some records, then kill the leader. Compare acks=1 with acks=all. Follower speeds are records fetched per tick; the model is simplified.">
      <div className="mqd">
        <div className="demo-controls">
          <Segmented label="Producer acks" value={cfg.acks} onChange={(a: Acks) => setCfg({ ...cfg, acks: a })}
            options={[{ value: '0', label: 'acks=0' }, { value: '1', label: 'acks=1' }, { value: 'all', label: 'acks=all' }]} />
          <Slider label="min.insync.replicas" min={1} max={3} value={cfg.minIsr} onChange={(v) => setCfg({ ...cfg, minIsr: v })} />
          <Slider label="Max follower lag to stay in ISR" min={1} max={10} value={cfg.maxLag} onChange={(v) => setCfg({ ...cfg, maxLag: v })} format={(v) => `${v} records`} />
          <Slider label="B2 fetch speed" min={0} max={1} step={0.1} value={rates[0]} onChange={(v) => setRate(0, v)} format={(v) => `${v}/tick`} />
          <Slider label="B3 fetch speed" min={0} max={1} step={0.1} value={rates[1]} onChange={(v) => setRate(1, v)} format={(v) => `${v}/tick`} />
          <label className="mqd__toggle">
            <input type="checkbox" checked={cfg.unclean} onChange={(e) => setCfg({ ...cfg, unclean: e.target.checked })} />
            Allow unclean leader election
          </label>
          <div className="mqd__buttons">
            <button className="btn btn--primary btn--sm" onClick={() => produce(5)} disabled={s.offline}>Produce 5</button>
            <button className="btn btn--secondary btn--sm" onClick={() => setS((p) => killLeader(p, cfg))} disabled={!s.leader}><Skull size={14} /> Kill leader</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setS((p) => reviveAll(p, cfg))}>Restart brokers</button>
          </div>
        </div>

        <div className="mqd__stage">
          {s.replicas.map((r) => (
            <div key={r.id} className={`mqd__row ${r.alive ? '' : 'is-dead'}`}>
              <span className="mqd__name">
                {r.id === s.leader && <Crown size={13} aria-label="leader" />}{r.id}
                <small>{!r.alive ? 'dead' : r.id === s.leader ? 'leader' : s.isr.includes(r.id) ? 'in ISR' : 'lagging'}</small>
              </span>
              <div className="mqd__log" aria-label={`${r.id} holds ${r.leo} records`}>
                {Array.from({ length: SHOW }, (_, i) => {
                  const off = offset0 + i
                  const has = off < r.leo
                  const cls = !has ? '' : s.acked.has(off) ? off < s.hw ? 'is-committed' : 'is-acked' : off < s.hw ? 'is-committed' : 'is-held'
                  return <i key={off} className={cls} title={`offset ${off}`} />
                })}
              </div>
              <span className="mqd__leo mono">{r.leo}</span>
            </div>
          ))}
          <div className="mqd__legend">
            <span><i className="is-committed" /> below high watermark (safe, readable)</span>
            <span><i className="is-acked" /> acked but not yet replicated</span>
            <span><i className="is-held" /> written, not acked</span>
          </div>
          <div className="mqd__kpis">
            <div><span>High watermark</span><strong className="mono">{s.hw}</strong></div>
            <div><span>Acked records</span><strong className="mono">{s.acked.size}</strong></div>
            <div><span>Acked then lost</span><strong className={`mono ${s.lostAcked ? 'is-bad' : ''}`}>{s.lostAcked}</strong></div>
            <div><span>Writes refused</span><strong className="mono">{s.rejected}</strong></div>
          </div>
          <ol className="mqd__events" aria-live="polite">
            {s.events.slice(-3).map((e, i) => <li key={`${s.events.length}-${i}`}>{e}</li>)}
            {!s.events.length && <li>No failures yet. Produce, then kill the leader.</li>}
          </ol>
        </div>
      </div>
    </DemoFrame>
  )
}
