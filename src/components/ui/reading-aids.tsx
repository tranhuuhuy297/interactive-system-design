import { useId, type ReactNode } from 'react'
import { Timer } from 'lucide-react'

/** "In 60 seconds" summary shown at the top of a chapter. */
export function TLDR({ items, title = 'In 60 seconds' }: { items: ReactNode[]; title?: string }) {
  return (
    <aside className="tldr" aria-label={title}>
      <div className="tldr__head"><Timer size={14} aria-hidden /> {title}</div>
      <ul>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </aside>
  )
}

/** Inline jargon with a plain-language definition on hover or keyboard focus. */
export function Term({ children, def }: { children: ReactNode; def: ReactNode }) {
  const id = useId()
  return (
    <span className="term" tabIndex={0} aria-describedby={id}>
      {children}
      <span role="tooltip" id={id} className="term__tip">{def}</span>
    </span>
  )
}
