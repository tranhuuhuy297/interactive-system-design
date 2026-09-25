import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import './crawler-demos.css'

const N_OPTIONS = [
  { value: '1e6', label: '1M' }, { value: '1e8', label: '100M' },
  { value: '1e9', label: '1B' }, { value: '1e10', label: '10B' },
] as const
type NKey = (typeof N_OPTIONS)[number]['value']

const fmtBytes = (b: number) => {
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(b < 10 ? 1 : 0)} ${u[i]}`
}
const fmtP = (p: number) => (p < 0.0001 ? p.toExponential(1) : `${(p * 100).toFixed(p < 0.01 ? 3 : 2)}%`)

/** False-positive rate p ≈ (1 − e^(−kn/m))^k for a Bloom filter with m bits, n items, k hashes. */
export function CrawlerBloomCalculator() {
  const [nKey, setNKey] = useState<NKey>('1e9')
  const [bitsPerItem, setBitsPerItem] = useState(10)
  const [k, setK] = useState(7)

  const n = Number(nKey)
  const m = n * bitsPerItem
  const p = Math.pow(1 - Math.exp((-k * n) / m), k)
  const kOpt = Math.max(1, Math.round((m / n) * Math.LN2))
  const pOpt = Math.pow(1 - Math.exp((-kOpt * n) / m), kOpt)
  const hashSetBytes = n * 40 // rough: 32-byte digest + overhead per entry in a hash set

  const reset = () => { setNKey('1e9'); setBitsPerItem(10); setK(7) }

  return (
    <DemoFrame title="Bloom filter sizing for the “URL seen?” check" onReset={reset}
      hint="A Bloom filter never gives false negatives. It can say “seen” for a URL that wasn't. For a crawler, that just means skipping a page, which is usually an acceptable loss.">
      <div className="demo-grid">
        <div className="demo-controls">
          <div>
            <div className="demo-label">URLs to track (n)</div>
            <Segmented label="Number of URLs" options={N_OPTIONS as unknown as { value: NKey; label: string }[]} value={nKey} onChange={setNKey} />
          </div>
          <Slider label="Bits per URL (m / n)" min={2} max={24} value={bitsPerItem} onChange={setBitsPerItem} />
          <Slider label="Hash functions (k)" min={1} max={16} value={k} onChange={setK} />
          <button className="btn btn--secondary btn--sm" onClick={() => setK(kOpt)} disabled={k === kOpt}>Use optimal k = {kOpt}</button>
        </div>
        <div className="demo-stage crw__bloom">
          <div className="crw__big">
            <span className="demo-label">False-positive rate</span>
            <strong className={p > 0.05 ? 'is-bad' : p > 0.005 ? 'is-meh' : 'is-good'}>{fmtP(p)}</strong>
          </div>
          <div className="crw__meter" aria-hidden><span style={{ width: `${Math.min(100, Math.max(2, (Math.log10(p) + 8) * 12.5))}%` }} /></div>
          <dl className="crw__facts">
            <div><dt>Filter size</dt><dd>{fmtBytes(m / 8)}</dd></div>
            <div><dt>Exact hash set (~40 B/URL)</dt><dd>{fmtBytes(hashSetBytes)}</dd></div>
            <div><dt>Optimal k = (m/n)·ln 2</dt><dd>{kOpt} → {fmtP(pOpt)}</dd></div>
            <div><dt>Pages wrongly skipped per 1B checks</dt><dd>{Math.round(p * 1e9).toLocaleString('en-US')}</dd></div>
          </dl>
        </div>
      </div>
    </DemoFrame>
  )
}
