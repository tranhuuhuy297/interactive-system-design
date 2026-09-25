import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Globe2, Pause, Play } from 'lucide-react'
import { ArchitectureDiagram, type ArchEdge, type ArchFlow, type ArchNode } from './architecture-diagram'

export interface EpisodeStage {
  /** Short label for the timeline, e.g. "v0 · MVP". */
  title: string
  /** Scale at this point in the story, e.g. "10K users · 50 req/s". */
  scale: string
  /** What broke or what new requirement arrived. */
  problem: ReactNode
  /** What we built in response. */
  decision: ReactNode
  /** What the decision costs us. */
  tradeoff?: ReactNode
  /** How the real company approached this (publicly documented). */
  realWorld?: ReactNode
  nodes: ArchNode[]
  edges: ArchEdge[]
  flows?: ArchFlow[]
  /** Node ids introduced in this stage (highlighted as "new"). */
  added?: string[]
}

const AUTOPLAY_MS = 9000

/** Story-driven build-up of an architecture, one stage at a time. */
export function EpisodePlayer({ stages, height = 380 }: { stages: EpisodeStage[]; height?: number }) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const stage = stages[i]
  const last = stages.length - 1

  // Autoplay stops by itself on the last stage; derived rather than reset in an effect.
  const isPlaying = playing && i < last

  useEffect(() => {
    if (!isPlaying) return
    const t = setTimeout(() => setI((x) => Math.min(last, x + 1)), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [isPlaying, i, last])

  const go = (n: number) => setI(Math.max(0, Math.min(last, n)))
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1) }
  }

  return (
    <section className="ep" aria-label="Episode player" onKeyDown={onKey}>
      <header className="ep__head">
        <ol className="ep__timeline" style={{ ['--progress' as string]: last ? i / last : 1 }}>
          {stages.map((s, k) => (
            <li key={s.title}>
              <button className={`ep__dot ${k === i ? 'is-active' : ''} ${k < i ? 'is-done' : ''}`}
                onClick={() => go(k)} aria-current={k === i ? 'step' : undefined} aria-label={`Stage ${k + 1}: ${s.title}`}>
                <span className="ep__dot-num">{k + 1}</span>
                <span className="ep__dot-title">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </header>

      <div className="ep__meta">
        <div>
          <span className="ep__eyebrow">Stage {i + 1} of {stages.length}</span>
          <h3 className="ep__title">{stage.title}</h3>
        </div>
        <span className="ep__scale mono">{stage.scale}</span>
      </div>

      <ArchitectureDiagram key={i} nodes={stage.nodes} edges={stage.edges} flows={stage.flows} added={stage.added} height={height} />

      <div className="ep__story" key={`story-${i}`}>
        <div className="ep__card ep__card--problem"><span>The problem</span><div>{stage.problem}</div></div>
        <div className="ep__card ep__card--decision"><span>The decision</span><div>{stage.decision}</div></div>
        {stage.tradeoff && <div className="ep__card"><span>The trade-off</span><div>{stage.tradeoff}</div></div>}
      </div>
      {stage.realWorld && (
        <div className="ep__real"><Globe2 size={15} aria-hidden /><div><span>In the real world</span>{stage.realWorld}</div></div>
      )}

      <footer className="ep__controls">
        <button className="btn btn--secondary btn--sm" onClick={() => go(i - 1)} disabled={i === 0}><ChevronLeft size={15} /> Back</button>
        <button className="btn btn--ghost btn--sm" onClick={() => { if (i >= last) { setI(0); setPlaying(true) } else setPlaying(!isPlaying) }}
          aria-pressed={isPlaying}>
          {isPlaying ? <><Pause size={14} /> Pause</> : <><Play size={14} /> {i >= last ? 'Replay' : 'Autoplay'}</>}
        </button>
        <span className="ep__hint">← → to step</span>
        <button className="btn btn--primary btn--sm" onClick={() => go(i + 1)} disabled={i === last}>Next stage <ChevronRight size={15} /></button>
      </footer>
    </section>
  )
}
