interface Stat { value: string; label: string; note?: string }

/** A row of big, memorable numbers. */
export function StatRow({ stats, caption }: { stats: Stat[]; caption?: string }) {
  return (
    <figure className="stats">
      <div className="stats__row">
        {stats.map((s) => (
          <div key={s.label} className="stats__item">
            <strong>{s.value}</strong>
            <span>{s.label}</span>
            {s.note && <small>{s.note}</small>}
          </div>
        ))}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
