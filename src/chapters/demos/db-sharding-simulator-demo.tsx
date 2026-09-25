import { useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { generateOps, movedFraction, shardLoad, type Strategy, type Workload } from './db-sharding-model'
import { imbalancePct } from './lb-hash-ring-math'
import './db-demos.css'

const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: 'range', label: 'Range' },
  { value: 'hash-mod', label: 'Hash % N' },
  { value: 'consistent', label: 'Consistent hash' },
]
const WORKLOADS: { value: Workload; label: string }[] = [
  { value: 'uniform', label: 'Uniform user IDs' },
  { value: 'celebrity', label: 'Celebrity hot key' },
  { value: 'time-series', label: 'Time-series inserts' },
]

const VERDICT: Record<Workload, Record<Strategy, string>> = {
  uniform: {
    range: 'Fine for uniform keys, and range scans stay on one shard.',
    'hash-mod': 'Even spread, but adding a shard reshuffles almost everything.',
    consistent: 'Even spread, and only about 1/N of keys move on resize.',
  },
  celebrity: {
    range: 'The celebrity key pins one shard. Range cannot split a single key.',
    'hash-mod': 'Hashing spreads keys, not requests. One key still means one shard. Try salting.',
    consistent: 'Same problem: a single hot key always has one owner. Salting splits it.',
  },
  'time-series': {
    range: 'All current writes land on the newest range: a classic write hot spot.',
    'hash-mod': 'Writes spread evenly, but “last hour” queries now hit every shard.',
    consistent: 'Even writes, cheap resizes. Time-range reads scatter-gather across shards.',
  },
}

export function DbShardingSimulatorDemo() {
  const [strategy, setStrategy] = useState<Strategy>('range')
  const [workload, setWorkload] = useState<Workload>('celebrity')
  const [shards, setShards] = useState(4)
  const [salt, setSalt] = useState(false)

  const ops = useMemo(() => generateOps(workload, salt), [workload, salt])
  const load = useMemo(() => shardLoad(strategy, ops, shards), [strategy, ops, shards])
  const moved = useMemo(() => movedFraction(strategy, ops, shards), [strategy, ops, shards])
  const max = Math.max(...load, 1)
  const mean = load.reduce((a, b) => a + b, 0) / load.length

  return (
    <DemoFrame title="Sharding simulator: strategy × workload" onReset={() => { setStrategy('range'); setWorkload('celebrity'); setShards(4); setSalt(false) }}
      hint="The bars show where current traffic lands. Try each workload against each strategy, then turn on key salting for the celebrity.">
      <div className="dbs__controls">
        <Segmented label="Partitioning strategy" value={strategy} onChange={setStrategy} options={STRATEGIES} />
        <Segmented label="Workload" value={workload} onChange={setWorkload} options={WORKLOADS} />
        <div className="dbs__row">
          <div className="dbs__slider"><Slider label="Shards" min={2} max={10} value={shards} onChange={setShards} /></div>
          <label className={`dbs__check ${workload !== 'celebrity' ? 'is-disabled' : ''}`}>
            <input type="checkbox" checked={salt} disabled={workload !== 'celebrity'} onChange={(e) => setSalt(e.target.checked)} />
            Salt hot key across 8 sub-keys
          </label>
        </div>
      </div>

      <div className="dbs__bars" role="img" aria-label={`Shard load: ${load.join(', ')}`}>
        {load.map((l, i) => {
          const hot = l > mean * 1.8
          return (
            <div key={i} className="dbs__col">
              <span className="mono">{l}</span>
              <i style={{ height: `${(l / max) * 100}%` }} className={hot ? 'is-hot' : ''} />
              <b>S{i}</b>
            </div>
          )
        })}
      </div>

      <div className="dbs__stats">
        <div><span className="demo-label">Imbalance</span><strong className="mono">{imbalancePct(load).toFixed(0)}%</strong></div>
        <div><span className="demo-label">Hottest / average</span><strong className="mono">{(max / mean).toFixed(1)}×</strong></div>
        <div><span className="demo-label">Keys moved adding S{shards}</span><strong className="mono">{(moved * 100).toFixed(0)}%</strong></div>
      </div>
      <p className="dbs__verdict">{VERDICT[workload][strategy]}</p>
    </DemoFrame>
  )
}
