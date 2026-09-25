interface QuadrantItem {
  label: string
  /** 0 = left, 1 = right. */
  x: number
  /** 0 = bottom, 1 = top. */
  y: number
  highlight?: boolean
}

interface QuadrantProps {
  items: QuadrantItem[]
  /** [left, right] axis labels. */
  x: [string, string]
  /** [bottom, top] axis labels. */
  y: [string, string]
  /** Optional name for the best corner, shown in the top-right. */
  sweetSpot?: string
  caption?: string
}

/** 2×2 trade-off map: where each option sits between two competing qualities. */
export function Quadrant({ items, x, y, sweetSpot, caption }: QuadrantProps) {
  return (
    <figure className="quad">
      <div className="quad__wrap">
        <span className="quad__y quad__y--top">{y[1]} ↑</span>
        <div className="quad__plot" role="img" aria-label={`Trade-off map: ${items.map((i) => i.label).join(', ')}`}>
          {sweetSpot && <span className="quad__sweet">{sweetSpot}</span>}
          {items.map((it) => (
            <span key={it.label} className={`quad__dot ${it.highlight ? 'is-hl' : ''} ${it.x < 0.34 ? 'is-left' : it.x > 0.66 ? 'is-right' : ''}`}
              style={{ left: `${Math.min(92, Math.max(8, it.x * 100))}%`, bottom: `${Math.min(90, Math.max(8, it.y * 100))}%` }}>
              <i aria-hidden />{it.label}
            </span>
          ))}
        </div>
        <span className="quad__y quad__y--bottom">{y[0]}</span>
        <div className="quad__x"><span>{x[0]}</span><span>{x[1]} →</span></div>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
