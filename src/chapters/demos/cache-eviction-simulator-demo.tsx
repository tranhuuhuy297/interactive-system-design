import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, SkipForward } from 'lucide-react'
import { Button, DemoFrame, Segmented, Slider } from '../../components/ui'
import { PRESETS, simulate, type Policy } from './cache-eviction-policies'
import './cache-demos.css'

const POLICIES: Policy[] = ['LRU', 'LFU', 'FIFO']

export function CacheEvictionSimulatorDemo() {
  const [preset, setPreset] = useState('mixed')
  const [text, setText] = useState(PRESETS[0].seq)
  const [capacity, setCapacity] = useState(3)
  const [pos, setPos] = useState(0)
  const [playing, setPlaying] = useState(false)

  const seq = useMemo(() => text.toUpperCase().split(/[\s,]+/).filter(Boolean).slice(0, 40), [text])
  const traces = useMemo(() => POLICIES.map((p) => simulate(p, seq, capacity)), [seq, capacity])
  const at = Math.min(pos, seq.length)

  // Playback stops by itself at the end of the sequence.
  const ticking = playing && at < seq.length
  useEffect(() => {
    if (!ticking) return
    const t = setTimeout(() => setPos((p) => p + 1), 550)
    return () => clearTimeout(t)
  }, [ticking, at])

  const pick = (id: string) => { setPreset(id); setText(PRESETS.find((p) => p.id === id)!.seq); setPos(0); setPlaying(false) }

  return (
    <DemoFrame title="Eviction policies, side by side" onReset={() => { pick('mixed'); setCapacity(3) }}
      hint="Step through the same access sequence under LRU, LFU and FIFO. Try “Scan pollution” (LFU wins) and “Popularity shift” (LRU wins).">
      <div className="cev__top">
        <Segmented label="Preset" value={preset} onChange={pick} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
        <input className="cev__input mono" value={text} aria-label="Access sequence"
          onChange={(e) => { setText(e.target.value); setPreset('custom'); setPos(0) }} />
        <div className="cev__row">
          <div className="cev__slider"><Slider label="Capacity" min={1} max={6} value={capacity} onChange={(v) => { setCapacity(v); setPos(0) }} /></div>
          <Button size="sm" variant="primary" onClick={() => { if (at >= seq.length) { setPos(0); setPlaying(true) } else setPlaying(!ticking) }}>
            {ticking ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
          </Button>
          <Button size="sm" onClick={() => setPos((p) => Math.min(seq.length, p + 1))} disabled={at >= seq.length}><SkipForward size={14} /> Step</Button>
        </div>
      </div>

      <div className="cev__seq" aria-label="Access sequence progress">
        {seq.map((k, i) => (
          <button key={i} className={`cev__tok ${i < at ? 'is-done' : ''} ${i === at - 1 ? 'is-now' : ''}`} onClick={() => setPos(i + 1)}
            aria-label={`Jump to access ${i + 1}: ${k}`}>{k}</button>
        ))}
      </div>

      <div className="cev__grid">
        {POLICIES.map((p, pi) => {
          const done = traces[pi].slice(0, at)
          const hits = done.filter((s) => s.hit).length
          const last = done[done.length - 1]
          return (
            <div key={p} className="cev__col">
              <div className="cev__head"><strong>{p}</strong><span className="mono">{at ? Math.round((hits / at) * 100) : 0}% hit</span></div>
              <div className="cev__slots">
                {Array.from({ length: capacity }, (_, i) => {
                  const c = last?.contents[i]
                  const isNew = c && last && c.key === last.key
                  return (
                    <div key={i} className={`cev__slot ${c ? '' : 'is-empty'} ${isNew ? (last.hit ? 'is-hit' : 'is-miss') : ''}`}>
                      {c ? <><b>{c.key}</b><small className="mono">{c.meta}</small></> : '·'}
                    </div>
                  )
                })}
              </div>
              <div className="cev__status">
                {last ? (last.hit ? <span className="is-hit">HIT {last.key}</span> : <span className="is-miss">MISS {last.key}{last.evicted && ` · evict ${last.evicted}`}</span>) : <span>—</span>}
              </div>
              <div className="cev__strip" aria-hidden>{done.map((s, i) => <i key={i} className={s.hit ? 'is-hit' : 'is-miss'} />)}</div>
            </div>
          )
        })}
      </div>
    </DemoFrame>
  )
}
