import { useMemo, useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import { formatBytes, rawCpuSeries, rollup, storageTiers, type Agg } from './metrics-model'
import './metrics-demos.css'

type Res = 'raw' | '1m' | '1h'
const BUCKET: Record<Res, number> = { raw: 1, '1m': 6, '1h': 360 }
const SERIES_OPTS = ['100K', '1M', '10M', '100M'] as const
type SeriesOpt = (typeof SERIES_OPTS)[number]
const SERIES_N: Record<SeriesOpt, number> = { '100K': 1e5, '1M': 1e6, '10M': 1e7, '100M': 1e8 }

function path(values: number[], w: number, h: number) {
  const step = values.length > 1 ? w / (values.length - 1) : w
  return values.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`).join(' ')
}

/** Rollups trade resolution for storage; the aggregate you keep decides what survives. */
export function MetricsDownsamplingDemo() {
  const raw = useMemo(() => rawCpuSeries(), [])
  const [res, setRes] = useState<Res>('1m')
  const [agg, setAgg] = useState<Agg>('avg')
  const [series, setSeries] = useState<SeriesOpt>('10M')
  const [compressed, setCompressed] = useState<'16' | '1.37'>('1.37')

  const values = useMemo(() => rollup(raw, BUCKET[res], agg), [raw, res, agg])
  const peak = Math.max(...values)
  const st = storageTiers({ series: SERIES_N[series], bytesPerSample: Number(compressed) })
  const tiers = [
    { label: 'Raw 10 s · 15 d', v: st.raw },
    { label: '1 m rollup · 90 d', v: st.minute },
    { label: '1 h rollup · 2 y', v: st.hour },
  ]
  const maxTier = Math.max(...tiers.map((t) => t.v))

  return (
    <DemoFrame title="Downsampling & retention" onReset={() => { setRes('1m'); setAgg('avg'); setSeries('10M'); setCompressed('1.37') }}
      hint="There is a two-minute CPU spike in this 6-hour series. Find the settings that hide it.">
      <div className="mt-ds__controls">
        <Segmented label="Resolution" value={res} onChange={setRes} options={[{ value: 'raw', label: 'Raw 10 s' }, { value: '1m', label: '1 min' }, { value: '1h', label: '1 hour' }]} />
        <Segmented label="Aggregate" value={agg} onChange={setAgg} options={[{ value: 'avg', label: 'avg' }, { value: 'max', label: 'max' }]} />
      </div>
      <svg viewBox="0 0 600 160" className="mt-ds__chart" role="img" aria-label={`CPU chart, ${values.length} points, peak ${peak.toFixed(0)}%`}>
        {[25, 50, 75].map((g) => <line key={g} x1={0} x2={600} y1={160 - g * 1.6} y2={160 - g * 1.6} className="mt-grid" />)}
        <path d={path(values, 600, 160)} className="mt-ds__line" />
      </svg>
      <div className="mt-ds__meta">
        <span>{values.length.toLocaleString()} points</span>
        <span>peak {peak.toFixed(0)}%</span>
        <span className={peak > 80 ? 'mt-ok' : 'mt-bad'}>{peak > 80 ? 'spike visible' : 'spike averaged away'}</span>
      </div>

      <div className="mt-ds__storage">
        <div className="mt-ds__controls">
          <Segmented label="Active series" value={series} onChange={setSeries} options={SERIES_OPTS} />
          <Segmented label="Encoding" value={compressed} onChange={setCompressed}
            options={[{ value: '16', label: '16 B/sample raw' }, { value: '1.37', label: '~1.37 B (Gorilla-style)' }]} />
        </div>
        {tiers.map((t) => (
          <div key={t.label} className="mt-ds__tier">
            <span>{t.label}</span>
            <div className="mt-ds__bar"><span style={{ width: `${(t.v / maxTier) * 100}%` }} /></div>
            <strong className="mono">{formatBytes(t.v)}</strong>
          </div>
        ))}
        <div className="mt-ds__total">
          <span>Tiered total <strong className="mono">{formatBytes(st.total)}</strong></span>
          <span>Keeping raw for 2 y instead <strong className="mono">{formatBytes(st.noDownsample)}</strong></span>
        </div>
        <p className="mt-note">Rollups store 4 aggregates (min, max, sum, count) so avg and max both survive. Numbers exclude replication and index overhead.</p>
      </div>
    </DemoFrame>
  )
}
