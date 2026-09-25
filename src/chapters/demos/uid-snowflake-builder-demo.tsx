import { useRef, useState } from 'react'
import { Button, DemoFrame, Slider } from '../../components/ui'
import { SNOWFLAKE_EPOCH, composeSnowflake, layoutStats, toBits, type Layout } from './uid-helpers'
import './uid-demos.css'

interface Issued { id: bigint; ts: number; worker: number; seq: number }

const fmt = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n))

export function UidSnowflakeBuilderDemo() {
  const [tsBits, setTsBits] = useState(41)
  const [workerBits, setWorkerBits] = useState(10)
  const seqBits = 63 - tsBits - workerBits
  const layout: Layout = { ts: tsBits, worker: workerBits, seq: seqBits }
  const stats = layoutStats(layout)
  const valid = seqBits >= 1

  const [worker, setWorker] = useState(7)
  const [issued, setIssued] = useState<Issued[]>([])
  const [warning, setWarning] = useState('')
  const last = useRef({ ts: -1, seq: 0 })
  const skew = useRef(0)

  const generate = (count = 1) => {
    if (!valid) return
    setWarning('')
    const out: Issued[] = []
    for (let i = 0; i < count; i++) {
      const ts = Date.now() - SNOWFLAKE_EPOCH - skew.current
      if (ts < last.current.ts) {
        setWarning(`Clock moved backwards by ${last.current.ts - ts} ms. A real generator refuses to issue IDs (or waits) until time catches up; issuing now could duplicate IDs.`)
        break
      }
      if (ts >= 2 ** tsBits) {
        setWarning(`Timestamp overflow: ${tsBits} bits of milliseconds ran out ${((ts - 2 ** tsBits) / 86_400_000).toFixed(0)} days ago (epoch 2020-01-01). IDs would wrap and stop being unique or sortable.`)
        break
      }
      let seq = 0
      if (ts === last.current.ts) {
        seq = last.current.seq + 1
        if (seq >= stats.perMs) { setWarning(`Sequence exhausted for this ms (${stats.perMs} IDs). Generator must spin until the next millisecond.`); break }
      }
      last.current = { ts, seq }
      out.push({ id: composeSnowflake(layout, ts, worker % stats.workers, seq), ts, worker: worker % stats.workers, seq })
    }
    if (out.length) setIssued((p) => [...out.reverse(), ...p].slice(0, 6))
  }

  const clockBack = () => { skew.current += 50; generate(); skew.current -= 50 }
  const reset = () => { setTsBits(41); setWorkerBits(10); setIssued([]); setWarning(''); last.current = { ts: -1, seq: 0 } }

  return (
    <DemoFrame title="Snowflake bit budget: 63 bits, three trade-offs" onReset={reset}
      hint="Move bits between timestamp, worker ID and sequence. Then generate IDs and decode them.">
      <div className="uid__grid">
        <div className="demo-controls">
          <Slider label="Timestamp bits (ms)" min={32} max={45} value={tsBits} onChange={(v) => { setTsBits(v); last.current = { ts: -1, seq: 0 } }} />
          <Slider label="Worker bits" min={4} max={16} value={workerBits} onChange={(v) => { setWorkerBits(v); last.current = { ts: -1, seq: 0 } }} />
          <Slider label="This node's worker ID" min={0} max={Math.min(stats.workers - 1, 1023)} value={Math.min(worker, stats.workers - 1)} onChange={setWorker} />
          <div className="uid__buttons">
            <Button variant="primary" size="sm" onClick={() => generate(1)} disabled={!valid}>Generate</Button>
            <Button size="sm" onClick={() => generate(5)} disabled={!valid}>×5 same ms</Button>
            <Button size="sm" onClick={clockBack} disabled={!valid}>Clock jumps back 50 ms</Button>
          </div>
        </div>
        <div className="uid__stats">
          <div><span>Lifetime</span><strong>{stats.years >= 1 ? `${stats.years.toFixed(1)} yrs` : `${(stats.years * 365).toFixed(0)} days`}</strong></div>
          <div><span>Max workers</span><strong>{fmt(stats.workers)}</strong></div>
          <div><span>IDs / ms / worker</span><strong className={valid ? '' : 'is-bad'}>{valid ? fmt(stats.perMs) : '—'}</strong></div>
          <div><span>IDs / s cluster-wide</span><strong>{valid ? fmt(stats.perMs * stats.workers * 1000) : '—'}</strong></div>
        </div>
      </div>

      <div className="uid__layout" aria-label="Bit layout">
        <span className="seg seg--sign" style={{ flex: 1 }}>0</span>
        <span className="seg seg--ts" style={{ flex: tsBits }}>timestamp · {tsBits}</span>
        <span className="seg seg--worker" style={{ flex: workerBits }}>worker · {workerBits}</span>
        <span className="seg seg--seq" style={{ flex: Math.max(seqBits, 1) }}>seq · {seqBits}</span>
      </div>

      {warning && <p className="uid__warn" role="status">{warning}</p>}

      <ul className="uid__list">
        {issued.map((it) => {
          const bits = toBits(it.id)
          return (
            <li key={it.id.toString()}>
              <code className="uid__dec">{it.id.toString()}</code>
              <code className="uid__bits">
                <span className="b-sign">{bits.slice(0, 1)}</span>
                <span className="b-ts">{bits.slice(1, 1 + tsBits)}</span>
                <span className="b-worker">{bits.slice(1 + tsBits, 1 + tsBits + workerBits)}</span>
                <span className="b-seq">{bits.slice(1 + tsBits + workerBits)}</span>
              </code>
              <span className="uid__decoded">t={it.ts} · w={it.worker} · s={it.seq}</span>
            </li>
          )
        })}
      </ul>
    </DemoFrame>
  )
}
