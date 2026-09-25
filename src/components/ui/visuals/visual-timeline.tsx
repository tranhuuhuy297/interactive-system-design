import type { LucideIcon } from 'lucide-react'

interface Moment {
  when: string
  title: string
  note?: string
  icon?: LucideIcon
}

/** Vertical timeline with icon dots; easier to recall than a table of dates. */
export function VisualTimeline({ items, caption }: { items: Moment[]; caption?: string }) {
  return (
    <figure className="vtl">
      <ol className="vtl__list">
        {items.map((m, i) => (
          <li key={`${m.when}-${m.title}`} className="vtl__item" style={{ ['--i' as string]: i }}>
            <span className="vtl__dot" aria-hidden>{m.icon ? <m.icon size={14} /> : null}</span>
            <span className="vtl__when mono">{m.when}</span>
            <div className="vtl__body"><strong>{m.title}</strong>{m.note && <p>{m.note}</p>}</div>
          </li>
        ))}
      </ol>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
