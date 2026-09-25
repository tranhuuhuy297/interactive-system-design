import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { timeToFirstSound, type StartInputs } from './episode-spotify-start-model'
import './episode-spotify-demos.css'

const DEFAULTS: StartInputs = {
  rttMs: 120, mbps: 5, bitrateKbps: 160, warmConnection: false,
  prefetchNext: false, cacheKeys: false, lowBitrateStart: false, predictable: true,
}
const TOGGLES: { key: keyof StartInputs; label: string }[] = [
  { key: 'warmConnection', label: 'Keep connection warm' },
  { key: 'cacheKeys', label: 'Cache keys' },
  { key: 'lowBitrateStart', label: 'Low-bitrate first chunk' },
  { key: 'prefetchNext', label: 'Prefetch next track' },
]
const BUDGET_MS = 250 // rough "feels instant" line used for illustration

export function EpisodeSpotifyInstantStartDemo() {
  const [inp, setInp] = useState<StartInputs>(DEFAULTS)
  const set = <K extends keyof StartInputs>(k: K, v: StartInputs[K]) => setInp((p) => ({ ...p, [k]: v }))
  const { phases, totalMs, bytesKb } = timeToFirstSound(inp)
  const scale = Math.max(totalMs, BUDGET_MS * 1.6)

  return (
    <DemoFrame title="Time to first sound: where the milliseconds go" onReset={() => setInp(DEFAULTS)}
      hint="Turn on techniques one at a time and watch each phase disappear. Toy model with illustrative numbers.">
      <div className="spf-start">
        <div className="demo-controls">
          <Segmented label="What the user plays" value={inp.predictable ? 'next' : 'jump'}
            onChange={(v) => set('predictable', v === 'next')}
            options={[{ value: 'next', label: 'Next in queue' }, { value: 'jump', label: 'Random search result' }]} />
          <Slider label="Round-trip time" min={20} max={400} step={10} value={inp.rttMs} onChange={(v) => set('rttMs', v)} format={(v) => `${v} ms`} />
          <Slider label="Bandwidth" min={0.5} max={50} step={0.5} value={inp.mbps} onChange={(v) => set('mbps', v)} format={(v) => `${v} Mbps`} />
          <Slider label="Normal bitrate" min={96} max={320} step={32} value={inp.bitrateKbps} onChange={(v) => set('bitrateKbps', v)} format={(v) => `${v} kbps`} />
          <div className="spf-start__toggles" role="group" aria-label="Techniques">
            {TOGGLES.map((t) => (
              <button key={t.key} className={`spf-start__toggle ${inp[t.key] ? 'is-on' : ''}`} aria-pressed={Boolean(inp[t.key])}
                onClick={() => set(t.key, !inp[t.key] as StartInputs[typeof t.key])}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="spf-start__out">
          <div className="spf-start__total">
            <span>Time to first sound</span>
            <strong className={totalMs <= BUDGET_MS ? 'is-good' : 'is-bad'}>{Math.round(totalMs)} ms</strong>
            <small>{totalMs <= BUDGET_MS ? 'Feels instant' : 'Noticeable delay'} · first chunk {bytesKb.toFixed(0)} KB</small>
          </div>
          <div className="spf-start__track" aria-hidden>
            {phases.filter((p) => p.ms > 0).map((p) => (
              <i key={p.id} className={`spf-start__seg spf-start__seg--${p.id}`} style={{ width: `${(p.ms / scale) * 100}%` }} />
            ))}
            <b className="spf-start__budget" style={{ left: `${(BUDGET_MS / scale) * 100}%` }} />
          </div>
          <ul className="spf-start__list">
            {phases.map((p) => (
              <li key={p.id} className={p.ms === 0 ? 'is-zero' : ''}>
                <i className={`spf-start__dot spf-start__seg--${p.id}`} />
                <span>{p.label}</span>
                <span className="mono">{p.ms === 0 ? 'skipped' : `${Math.round(p.ms)} ms`}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DemoFrame>
  )
}
