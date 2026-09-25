import { Fragment } from 'react'
import { ArrowRight } from 'lucide-react'

interface FlowStep {
  label: string
  sub?: string
}

/** Horizontal pipeline of steps with an animated pulse travelling along the arrows. */
export function FlowDiagram({ steps, caption }: { steps: FlowStep[]; caption?: string }) {
  return (
    <figure className="flow">
      <div className="flow__row">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 && (
              <span className="flow__arrow" style={{ ['--i' as string]: i }} aria-hidden>
                <ArrowRight size={16} />
              </span>
            )}
            <div className="flow__node" style={{ ['--i' as string]: i }}>
              <strong>{s.label}</strong>
              {s.sub && <small>{s.sub}</small>}
            </div>
          </Fragment>
        ))}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
