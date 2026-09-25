import { useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import { fmtDuration } from './estimation-format'
import './estimation-demos.css'

type Tier = 'cpu' | 'memory' | 'storage' | 'network'

// Order-of-magnitude figures for recent server hardware; exact values vary by generation and workload.
const OPS: { op: string; ns: number; tier: Tier }[] = [
  { op: 'L1 cache reference', ns: 1, tier: 'cpu' },
  { op: 'Branch mispredict', ns: 3, tier: 'cpu' },
  { op: 'L2 cache reference', ns: 4, tier: 'cpu' },
  { op: 'Mutex lock/unlock (uncontended)', ns: 17, tier: 'cpu' },
  { op: 'Main memory reference', ns: 100, tier: 'memory' },
  { op: 'Compress 1 KB (Snappy-class)', ns: 2_000, tier: 'cpu' },
  { op: 'Read 1 MB sequentially from RAM', ns: 50_000, tier: 'memory' },
  { op: 'Random 4 KB read, NVMe SSD', ns: 100_000, tier: 'storage' },
  { op: 'Read 1 MB sequentially, NVMe SSD', ns: 300_000, tier: 'storage' },
  { op: 'Round trip within a datacenter', ns: 500_000, tier: 'network' },
  { op: 'Read 1 MB sequentially, HDD', ns: 5_000_000, tier: 'storage' },
  { op: 'HDD seek', ns: 10_000_000, tier: 'storage' },
  { op: 'Round trip US East ↔ US West', ns: 70_000_000, tier: 'network' },
  { op: 'Round trip California ↔ Europe', ns: 150_000_000, tier: 'network' },
]
const MAX_LOG = Math.log10(OPS[OPS.length - 1].ns)

export function EstimationLatencyVisualizer() {
  const [scale, setScale] = useState<'real' | 'human'>('real')
  const [hover, setHover] = useState<number | null>(null)
  return (
    <DemoFrame title="Latency numbers on a log scale"
      hint="Switch to human scale, where 1 ns becomes 1 second, to feel the gaps. Hover a row to compare it with a memory reference.">
      <div className="est-lat__top">
        <Segmented label="Scale" value={scale} onChange={setScale}
          options={[{ value: 'real', label: 'Real time' }, { value: 'human', label: 'Human scale (1 ns = 1 s)' }]} />
        <div className="est-lat__legend">
          {(['cpu', 'memory', 'storage', 'network'] as Tier[]).map((t) => <span key={t} className={`est-lat__dot est-lat__dot--${t}`}>{t}</span>)}
        </div>
      </div>
      <ul className="est-lat">
        {OPS.map((o, i) => {
          const w = Math.max(2, (Math.log10(o.ns) / MAX_LOG) * 100)
          const label = scale === 'real' ? fmtDuration(o.ns) : fmtDuration(o.ns * 1e9)
          return (
            <li key={o.op} className={`est-lat__row est-lat__row--${o.tier}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              tabIndex={0} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              <span className="est-lat__op">{o.op}</span>
              <span className="est-lat__track"><span className="est-lat__bar" style={{ width: `${w}%` }} /></span>
              <span className="est-lat__val mono">{label}</span>
              {hover === i && o.ns > 100 && <span className="est-lat__ratio mono">{Math.round(o.ns / 100).toLocaleString('en-US')}× a RAM reference</span>}
            </li>
          )
        })}
      </ul>
      <p className="est-lat__note">Order-of-magnitude values for current server hardware. Memorize the ratios, not the digits.</p>
    </DemoFrame>
  )
}
