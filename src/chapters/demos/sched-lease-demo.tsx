import { useMemo, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { simulate, type SchedConfig } from './sched-lease-model'
import './sched-lease-demo.css'

const DEFAULTS: SchedConfig = { leaseTicks: 3, crashPct: 0, heartbeat: false, idempotent: false, maxAttempts: 3 }
const OUTCOME_LABEL = { done: 'completed', crash: 'worker crashed', dup: 'duplicate run, side effect applied again', skipped: 'duplicate run, side effect skipped by idempotency key' }

export function SchedLeaseDemo() {
  const [cfg, setCfg] = useState<SchedConfig>(DEFAULTS)
  const r = useMemo(() => simulate(cfg), [cfg])
  const toggle = (k: 'heartbeat' | 'idempotent') => setCfg({ ...cfg, [k]: !cfg[k] })

  return (
    <DemoFrame title="Leases, crashes, and duplicate runs" onReset={() => setCfg(DEFAULTS)}
      hint="30 runs come due, one per tick. Three workers claim them with a lease. Jobs take 2–7 ticks. Start with a short lease and no heartbeat, then fix it. Timings are illustrative.">
      <div className="sched">
        <div className="demo-controls">
          <Slider label="Lease (visibility timeout)" min={2} max={10} value={cfg.leaseTicks} onChange={(v) => setCfg({ ...cfg, leaseTicks: v })} format={(v) => `${v} ticks`} />
          <Slider label="Chance a worker crashes mid-job" min={0} max={50} step={5} value={cfg.crashPct} onChange={(v) => setCfg({ ...cfg, crashPct: v })} format={(v) => `${v}%`} />
          <Slider label="Max attempts before dead-letter" min={1} max={5} value={cfg.maxAttempts} onChange={(v) => setCfg({ ...cfg, maxAttempts: v })} />
          <label className="sched__toggle"><input type="checkbox" checked={cfg.heartbeat} onChange={() => toggle('heartbeat')} />
            <span>Heartbeat <small>running workers extend their lease every tick</small></span></label>
          <label className="sched__toggle"><input type="checkbox" checked={cfg.idempotent} onChange={() => toggle('idempotent')} />
            <span>Idempotency key <small>the side effect is recorded once per run id</small></span></label>
        </div>

        <div className="sched__stage">
          <div className="sched__kpis">
            <div><span>Executions for 30 runs</span><strong className="mono">{r.executions}</strong></div>
            <div><span>Overlapping runs</span><strong className={`mono ${r.duplicateExecutions ? 'is-warn' : ''}`}>{r.duplicateExecutions}</strong></div>
            <div><span>Side effects applied twice</span><strong className={`mono ${r.duplicateEffects ? 'is-bad' : 'is-good'}`}>{r.duplicateEffects}</strong></div>
            <div><span>Re-claimed after lease expiry</span><strong className="mono">{r.retriesAfterCrash}</strong></div>
            <div><span>Dead-lettered</span><strong className="mono">{r.deadLettered}</strong></div>
            <div><span>Avg delay from due time</span><strong className="mono">{r.avgDelay.toFixed(1)} t</strong></div>
          </div>
          <div className="sched__lanes" role="img" aria-label={`Worker timelines: ${r.executions} executions, ${r.duplicateEffects} duplicated side effects`}>
            {[0, 1, 2].map((w) => (
              <div key={w} className="sched__lane">
                <span className="sched__lane-name">W{w + 1}</span>
                <div className="sched__track">
                  {r.bars.filter((b) => b.worker === w).map((b) => (
                    <span key={`${b.run}-${b.start}`} className={`sched__bar sched__bar--${b.outcome}`}
                      style={{ left: `${(b.start / r.horizon) * 100}%`, width: `${(Math.max(0.6, b.end - b.start) / r.horizon) * 100}%` }}
                      title={`run ${b.run}: ${OUTCOME_LABEL[b.outcome]} (t${b.start}–t${b.end})`}>
                      <em>{b.run}</em>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="sched__legend">
            <span><i className="sched__bar--done" /> completed</span>
            <span><i className="sched__bar--crash" /> crashed</span>
            <span><i className="sched__bar--dup" /> duplicate, effect applied twice</span>
            <span><i className="sched__bar--skipped" /> duplicate, effect skipped</span>
          </div>
          <p className="sched__note">
            {r.duplicateEffects > 0
              ? 'A lease shorter than the job lets a second worker claim a run that is still going. Without an idempotency key, the side effect happens twice.'
              : r.duplicateExecutions > 0
                ? 'Runs still overlap, but the idempotency key makes the second one harmless. That is at-least-once execution with exactly-once effect.'
                : 'No overlaps: every lease outlived its job. Crashes still cause retries once a lease expires, so keep the idempotency key anyway.'}
          </p>
        </div>
      </div>
    </DemoFrame>
  )
}
