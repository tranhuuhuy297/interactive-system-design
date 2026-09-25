import type { MockHistoryEntry } from './mock-phases'

const W = 560
const H = 150
const PAD = 26

/** Score trend across saved mock sessions (last 12). */
export function MockHistoryChart({ history }: { history: MockHistoryEntry[] }) {
  const data = history.slice(-12)
  if (data.length === 0) return <p className="mk-hist__empty">No saved sessions yet. Finish a mock and save your score to start a trend line.</p>

  const x = (i: number) => (data.length === 1 ? W / 2 : PAD + (i / (data.length - 1)) * (W - PAD * 2))
  const y = (pct: number) => H - PAD - (pct / 100) * (H - PAD * 2)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.pct)}`).join(' ')
  const area = `${line} L${x(data.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z`
  const avg = Math.round(data.reduce((s, d) => s + d.pct, 0) / data.length)

  return (
    <figure className="mk-hist">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Score history: ${data.map((d) => `${d.pct}%`).join(', ')}`}>
        {[50, 70, 85].map((g) => (
          <g key={g} className="mk-hist__grid">
            <line x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} />
            <text x={W - PAD + 4} y={y(g) + 3}>{g}</text>
          </g>
        ))}
        <path d={area} className="mk-hist__area" />
        <path d={line} className="mk-hist__line" />
        {data.map((d, i) => (
          <circle key={d.at} cx={x(i)} cy={y(d.pct)} r="4.5" className="mk-hist__dot"><title>{`${d.title}: ${d.pct}%`}</title></circle>
        ))}
      </svg>
      <figcaption>{data.length} session{data.length > 1 ? 's' : ''} · average {avg}% · latest {data[data.length - 1].pct}% on “{data[data.length - 1].title}”</figcaption>
    </figure>
  )
}
