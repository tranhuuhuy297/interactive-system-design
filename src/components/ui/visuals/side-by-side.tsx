import type { ReactNode } from 'react'
import { Check, Minus, X, type LucideIcon } from 'lucide-react'

export interface SidePanel {
  title: string
  icon?: LucideIcon
  /** Colour cue: good = recommended, bad = anti-pattern. */
  tone?: 'good' | 'bad' | 'neutral'
  /** Optional mini picture (e.g. chips or a tiny diagram). */
  picture?: ReactNode
  /** Short points; prefix "+" for a pro, "-" for a con, otherwise neutral. */
  points: string[]
  verdict?: string
}

const mark = (p: string) =>
  p.startsWith('+') ? { Icon: Check, cls: 'is-pro', text: p.slice(1).trim() }
  : p.startsWith('-') ? { Icon: X, cls: 'is-con', text: p.slice(1).trim() }
  : { Icon: Minus, cls: '', text: p }

/** Two or three options compared as picture cards instead of a text table. */
export function SideBySide({ panels, caption }: { panels: SidePanel[]; caption?: string }) {
  return (
    <figure className="sbs">
      <div className="sbs__grid" style={{ ['--cols' as string]: panels.length }}>
        {panels.map((p) => (
          <div key={p.title} className={`sbs__panel sbs__panel--${p.tone ?? 'neutral'}`}>
            <div className="sbs__head">
              {p.icon && <span className="sbs__icon"><p.icon size={18} aria-hidden /></span>}
              <strong>{p.title}</strong>
            </div>
            {p.picture && <div className="sbs__picture">{p.picture}</div>}
            <ul className="sbs__points">
              {p.points.map((pt) => {
                const { Icon, cls, text } = mark(pt)
                return <li key={pt} className={cls}><Icon size={13} aria-hidden /><span>{text}</span></li>
              })}
            </ul>
            {p.verdict && <div className="sbs__verdict">{p.verdict}</div>}
          </div>
        ))}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

/** Tiny inline chips for SidePanel pictures, e.g. <Chips items={['Writer', '→', '1M inboxes']} />. */
export function Chips({ items }: { items: string[] }) {
  return <div className="chips">{items.map((c, i) => c === '→' ? <span key={i} className="chips__arrow">→</span> : <span key={i} className="chips__chip">{c}</span>)}</div>
}
