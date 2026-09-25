import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import './episode-netflix-demos.css'

// Toy model: bitrate needed for the same perceived quality scales with visual complexity.
const RUNGS = [
  { res: '240p', fixed: 235 }, { res: '480p', fixed: 750 }, { res: '720p', fixed: 1750 },
  { res: '1080p', fixed: 3000 }, { res: '1080p HQ', fixed: 5800 },
]
const PRESETS = { cartoon: 0.15, drama: 0.45, action: 0.9 } as const
type Preset = keyof typeof PRESETS | 'custom'

const perTitle = (fixed: number, c: number) => Math.round(fixed * (0.3 + 0.85 * c))

export function EpisodeNetflixPerTitleDemo() {
  const [preset, setPreset] = useState<Preset>('cartoon')
  const [complexity, setComplexity] = useState<number>(PRESETS.cartoon)
  const pick = (p: Preset) => { setPreset(p); if (p !== 'custom') setComplexity(PRESETS[p]) }

  const rows = RUNGS.map((r) => ({ ...r, tuned: perTitle(r.fixed, complexity) }))
  const fixedTotal = RUNGS.reduce((s, r) => s + r.fixed, 0)
  const tunedTotal = rows.reduce((s, r) => s + r.tuned, 0)
  const saving = Math.round((1 - tunedTotal / fixedTotal) * 100)
  const top = rows[rows.length - 1]
  const gbPer2h = (kbps: number) => ((kbps * 1000 * 7200) / 8 / 1e9).toFixed(1)

  return (
    <DemoFrame title="Fixed ladder vs per-title ladder" onReset={() => pick('cartoon')}
      hint="Simple animation needs far fewer bits than grainy action for the same perceived quality. Toy model, illustrative numbers.">
      <div className="nfx-pt">
        <div className="demo-controls">
          <Segmented label="Title type" value={preset} onChange={pick}
            options={[{ value: 'cartoon', label: 'Animation' }, { value: 'drama', label: 'Drama' }, { value: 'action', label: 'Action' }, { value: 'custom', label: 'Custom' }]} />
          <Slider label="Visual complexity" min={0} max={1} step={0.05} value={complexity}
            onChange={(v) => { setPreset('custom'); setComplexity(v) }} format={(v) => v.toFixed(2)} />
          <div className="nfx-pt__stats">
            <div><span>Ladder bits vs fixed</span><strong className={saving >= 0 ? 'is-good' : 'is-bad'}>{saving >= 0 ? `−${saving}%` : `+${-saving}%`}</strong></div>
            <div><span>2h at top rung</span><strong>{gbPer2h(top.tuned)} GB</strong><small>fixed: {gbPer2h(top.fixed)} GB</small></div>
          </div>
        </div>
        <div className="nfx-pt__chart" role="table" aria-label="Bitrate per rung">
          {rows.map((r) => (
            <div key={r.res} className="nfx-pt__row" role="row">
              <span role="rowheader">{r.res}</span>
              <div className="nfx-pt__bars" role="cell">
                <i className="nfx-fixed" style={{ width: `${(r.fixed / 7000) * 100}%` }} />
                <i className="nfx-tuned" style={{ width: `${Math.min(100, (r.tuned / 7000) * 100)}%` }} />
              </div>
              <span className="mono" role="cell">{r.tuned.toLocaleString('en-US')} <small>/ {r.fixed.toLocaleString('en-US')} kbps</small></span>
            </div>
          ))}
          <div className="nfx-pt__legend"><span><i className="nfx-fixed" /> Fixed ladder</span><span><i className="nfx-tuned" /> Per-title</span></div>
        </div>
      </div>
    </DemoFrame>
  )
}
