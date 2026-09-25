import { Fragment } from 'react'
import { ArrowRight, Brain, Quote } from 'lucide-react'
import { mentalModelFor, type MentalModelData } from '../../../data/mental-models'

/** "Remember this" card: the chapter's core idea as a picture plus a hook. */
export function MentalModel({ id, compact = false }: { id: string; compact?: boolean }) {
  const m = mentalModelFor(id)
  if (!m) return null
  return <MentalModelView m={m} compact={compact} />
}

export function MentalModelView({ m, compact = false }: { m: MentalModelData; compact?: boolean }) {
  return (
    <figure className={`mm ${compact ? 'mm--compact' : ''}`}>
      {!compact && <div className="mm__label"><Brain size={13} aria-hidden /> Remember this picture</div>}
      <p className="mm__idea">{m.idea}</p>
      <div className="mm__picture" role="img" aria-label={m.picture.map((p) => p.label).join(', then ')}>
        {m.picture.map((p, i) => (
          <Fragment key={p.label}>
            {i > 0 && <ArrowRight size={16} className="mm__arrow" aria-hidden />}
            <div className="mm__step">
              <span className="mm__icon"><p.icon size={compact ? 18 : 22} aria-hidden /></span>
              <span className="mm__step-label">{p.label}</span>
            </div>
          </Fragment>
        ))}
      </div>
      {!compact && m.analogy && <p className="mm__analogy"><strong>Like:</strong> {m.analogy}</p>}
      <figcaption className="mm__hook"><Quote size={13} aria-hidden /> {m.hook}</figcaption>
    </figure>
  )
}
