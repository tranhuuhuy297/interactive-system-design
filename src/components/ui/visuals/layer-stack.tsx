import type { LucideIcon } from 'lucide-react'

interface Layer {
  label: string
  sub?: string
  icon?: LucideIcon
  /** Relative bar width 0–1 (e.g. speed, size, or cost). */
  size?: number
  /** Right-aligned value, e.g. "~1 ns" or "80 GB". */
  value?: string
  highlight?: boolean
}

/** Stacked layers (hierarchies, pyramids, budgets); bar width encodes a quantity. */
export function LayerStack({ layers, caption, legend }: { layers: Layer[]; caption?: string; legend?: string }) {
  return (
    <figure className="stack">
      {legend && <div className="stack__legend">{legend}</div>}
      <ol className="stack__list">
        {layers.map((l, i) => (
          <li key={l.label} className={`stack__layer ${l.highlight ? 'is-hl' : ''}`} style={{ ['--i' as string]: i }}>
            <div className="stack__track">
              <div className="stack__bar" style={{ width: `${Math.max(18, (l.size ?? 1) * 100)}%` }}>
                {l.icon && <l.icon size={15} aria-hidden />}
                <span className="stack__label">{l.label}{l.sub && <small>{l.sub}</small>}</span>
              </div>
            </div>
            {l.value && <span className="stack__value mono">{l.value}</span>}
          </li>
        ))}
      </ol>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
