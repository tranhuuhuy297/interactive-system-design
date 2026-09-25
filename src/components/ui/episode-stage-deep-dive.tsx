import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { References, type Reference } from './references-list'

/** Optional long-form detail for one episode stage; every field is independent. */
export interface StageDeepDive {
  /** Numbered walk-through of how a request flows at this stage. */
  walkthrough?: ReactNode[]
  /** Key figures at this stage; label estimates as such in the value or note. */
  numbers?: { label: string; value: string; note?: string }[]
  /** Components introduced or changed, and why each exists. */
  components?: { name: string; role: ReactNode }[]
  /** Options considered and why they lost at this stage. */
  alternatives?: { option: string; verdict: ReactNode }[]
  /** Teaser for the pressure that forces the next stage. */
  breaksNext?: ReactNode
  /** One interview-style question with a compact model answer. */
  interview?: { q: string; a: ReactNode }
  /** Sources specific to this stage. */
  sources?: Reference[]
}

const hasDeepDive = (s: StageDeepDive) =>
  Boolean(s.walkthrough?.length || s.numbers?.length || s.components?.length || s.alternatives?.length || s.breaksNext || s.interview || s.sources?.length)

export function EpisodeStageDeepDive({ stage, open, onToggle }: { stage: StageDeepDive; open: boolean; onToggle: () => void }) {
  if (!hasDeepDive(stage)) return null
  return (
    <div className={`ep-deep ${open ? 'is-open' : ''}`}>
      <button className="ep-deep__toggle" onClick={onToggle} aria-expanded={open}>
        <span>Go deeper into this stage</span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <div className="ep-deep__body">
          {stage.walkthrough && stage.walkthrough.length > 0 && (
            <section className="ep-deep__sec ep-deep__sec--wide">
              <h4>How it works now</h4>
              <ol className="ep-deep__steps">{stage.walkthrough.map((w, k) => <li key={k}>{w}</li>)}</ol>
            </section>
          )}
          {stage.numbers && stage.numbers.length > 0 && (
            <section className="ep-deep__sec ep-deep__sec--wide">
              <h4>Key numbers</h4>
              <div className="ep-deep__nums">
                {stage.numbers.map((n) => (
                  <div key={n.label}><span>{n.label}</span><strong className="mono">{n.value}</strong>{n.note && <small>{n.note}</small>}</div>
                ))}
              </div>
            </section>
          )}
          {stage.components && stage.components.length > 0 && (
            <section className="ep-deep__sec">
              <h4>What we added</h4>
              <dl className="ep-deep__dl">{stage.components.map((c) => <div key={c.name}><dt>{c.name}</dt><dd>{c.role}</dd></div>)}</dl>
            </section>
          )}
          {stage.alternatives && stage.alternatives.length > 0 && (
            <section className="ep-deep__sec">
              <h4>Alternatives considered</h4>
              <dl className="ep-deep__dl">{stage.alternatives.map((a) => <div key={a.option}><dt>{a.option}</dt><dd>{a.verdict}</dd></div>)}</dl>
            </section>
          )}
          {stage.breaksNext && (
            <section className="ep-deep__sec"><h4>What breaks next</h4><div className="ep-deep__text">{stage.breaksNext}</div></section>
          )}
          {stage.interview && (
            <section className="ep-deep__sec">
              <h4>Interview angle</h4>
              <p className="ep-deep__q">“{stage.interview.q}”</p>
              <div className="ep-deep__text">{stage.interview.a}</div>
            </section>
          )}
          {stage.sources && stage.sources.length > 0 && (
            <section className="ep-deep__sec ep-deep__sec--wide"><h4>Sources for this stage</h4><References items={stage.sources} /></section>
          )}
        </div>
      )}
    </div>
  )
}
