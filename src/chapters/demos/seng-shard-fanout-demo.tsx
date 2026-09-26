import { useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import { QUERIES, SLOW_MS, fanout, type Partitioning } from './seng-shard-model'
import './seng-demos.css'

type Slow = 'none' | '0' | '1' | '2' | '3'

/** Scatter-gather across 4 shards: partition by document or by term, with an optional slow shard and hedging. */
export function SengShardFanoutDemo() {
  const [mode, setMode] = useState<Partitioning>('doc')
  const [query, setQuery] = useState(QUERIES[0])
  const [slow, setSlow] = useState<Slow>('none')
  const [hedge, setHedge] = useState(false)
  const r = fanout(query, mode, slow === 'none' ? null : Number(slow), hedge)
  const max = SLOW_MS + 80

  const reset = () => { setMode('doc'); setQuery(QUERIES[0]); setSlow('none'); setHedge(false) }

  return (
    <DemoFrame title="Scatter-gather: the slowest shard sets the latency" onReset={reset}
      hint="Toy model with illustrative numbers. Make one shard slow, then compare partitioning schemes and hedged requests.">
      <div className="seng-fo__controls">
        <Segmented label="Partitioning" value={mode} onChange={setMode}
          options={[{ value: 'doc', label: 'By document' }, { value: 'term', label: 'By term' }]} />
        <Segmented label="Query" value={query} onChange={setQuery} options={QUERIES} />
        <Segmented label="Slow shard" value={slow} onChange={setSlow}
          options={[{ value: 'none', label: 'All healthy' }, { value: '0', label: 'S0 slow' }, { value: '1', label: 'S1 slow' }, { value: '2', label: 'S2 slow' }, { value: '3', label: 'S3 slow' }]} />
        <label className="seng-fo__check"><input type="checkbox" checked={hedge} onChange={(e) => setHedge(e.target.checked)} /> Hedge to a replica after 40 ms</label>
      </div>

      <div className="seng-fo__shards">
        {r.shards.map((s) => (
          <div key={s.shard} className={`seng-fo__shard ${s.touched ? 'is-on' : ''} ${String(s.shard) === slow ? 'is-slow' : ''}`}>
            <div className="seng-fo__head"><strong>S{s.shard}</strong><span className="seng-small">{s.note}</span></div>
            <div className="seng-fo__track"><span style={{ width: `${Math.min(100, (s.ms / max) * 100)}%` }} /></div>
            <span className="mono seng-small">{s.touched ? `${s.ms} ms` : '—'}</span>
          </div>
        ))}
      </div>

      <div className="seng-fo__summary" role="status">
        <div><span>Shards asked</span><strong>{r.touched} of 4</strong></div>
        <div><span>Query latency</span><strong className={r.totalMs > 150 ? 'is-bad' : ''}>{r.totalMs} ms</strong></div>
        <p>
          {mode === 'doc'
            ? 'Every shard must answer, so any slow shard delays every query. Hedging hides it.'
            : 'Only term owners answer, but they ship whole posting lists, and a hot term makes its shard a hotspot.'}
        </p>
      </div>
    </DemoFrame>
  )
}
