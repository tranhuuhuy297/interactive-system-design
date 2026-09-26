import { useState } from 'react'
import { Flame, Play, RotateCcw, Sparkles } from 'lucide-react'
import { MATURE_DAYS, addDays, type SrsState, type SrsStats } from '../../lib/spaced-repetition'
import { useNow } from '../../lib/use-now'
import { useSpacedRepetition } from '../../lib/use-spaced-repetition'

interface Props {
  state: SrsState
  stats: SrsStats
  poolIds: Set<string>
  dueCount: number
  newCount: number
  deckSize: number
  onStart: () => void
  onStudyAhead: () => void
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SrsOverview({ state, stats, poolIds, dueCount, newCount, deckSize, onStart, onStudyAhead }: Props) {
  const { settings, reset } = useSpacedRepetition()
  const [confirmReset, setConfirmReset] = useState(false)
  const now = useNow()
  const cards = Object.entries(state.cards).filter(([id]) => poolIds.has(id)).map(([, c]) => c)

  // 7-day forecast: today includes anything already overdue.
  const forecast = Array.from({ length: 7 }, (_, d) => {
    const end = addDays(now, d + 1)
    const startT = d === 0 ? -Infinity : addDays(now, d)
    return { label: d === 0 ? 'Today' : DAY_NAMES[new Date(addDays(now, d)).getDay()], n: cards.filter((c) => c.due >= startT && c.due < end).length }
  })
  const peak = Math.max(1, ...forecast.map((f) => f.n))

  const learning = cards.filter((c) => c.step >= 0).length
  const mature = cards.filter((c) => c.step === -1 && c.interval >= MATURE_DAYS).length
  const young = cards.length - learning - mature
  const unseen = Math.max(0, deckSize - cards.length)
  const parts = [
    { label: 'Not seen', n: unseen, cls: 'new' }, { label: 'Learning', n: learning, cls: 'learning' },
    { label: 'Young', n: young, cls: 'young' }, { label: `Mature (${MATURE_DAYS}d+)`, n: mature, cls: 'mature' },
  ]
  const total = Math.max(1, deckSize)
  const queued = dueCount + newCount

  return (
    <section className="srs-overview" aria-label="Review overview">
      <div className="srs-stats">
        <div><span>Due now</span><strong>{dueCount}</strong><small>{stats.dueTomorrow} tomorrow</small></div>
        <div><span>New today</span><strong>{stats.newToday}<em>/{settings.newPerDay}</em></strong><small>{newCount} ready</small></div>
        <div><span>Streak</span><strong><Flame size={18} aria-hidden className={stats.streak ? 'srs-flame is-on' : 'srs-flame'} />{stats.streak}</strong><small>{stats.streak === 1 ? 'day' : 'days'}</small></div>
        <div><span>Retention</span><strong>{stats.retention === null ? '—' : `${Math.round(stats.retention * 100)}%`}</strong><small>{stats.retention === null ? 'after 10 reviews' : 'last 200 reviews'}</small></div>
      </div>

      <div className="srs-start">
        {queued > 0 ? (
          <button className="btn btn--primary btn--md" onClick={onStart}>
            <Play size={15} /> Start review · {Math.min(queued, settings.maxPerSession)} cards
          </button>
        ) : (
          <>
            <p className="srs-start__done"><Sparkles size={15} aria-hidden /> All caught up for today.</p>
            <button className="btn btn--secondary btn--md" onClick={onStudyAhead}>Study ahead</button>
          </>
        )}
        <span className="srs-start__hint">{dueCount} due · {newCount} new · max {settings.maxPerSession} per session</span>
      </div>

      <div className="srs-panels">
        <figure className="srs-forecast">
          <figcaption>Next 7 days</figcaption>
          <div className="srs-forecast__bars">
            {forecast.map((f) => (
              <div key={f.label} className="srs-forecast__day">
                <span className="mono">{f.n}</span>
                <i style={{ height: `${Math.max(4, (f.n / peak) * 72)}px` }} />
                <small>{f.label}</small>
              </div>
            ))}
          </div>
        </figure>
        <figure className="srs-maturity">
          <figcaption>Your deck · {deckSize} cards</figcaption>
          <div className="srs-maturity__bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.n}`).join(', ')}>
            {parts.map((p) => p.n > 0 && <span key={p.cls} className={`srs-m--${p.cls}`} style={{ width: `${(p.n / total) * 100}%` }} />)}
          </div>
          <ul className="srs-maturity__legend">
            {parts.map((p) => <li key={p.cls}><i className={`srs-m--${p.cls}`} />{p.label}<b className="mono">{p.n}</b></li>)}
          </ul>
        </figure>
      </div>

      <div className="srs-reset">
        {confirmReset ? (
          <>
            <span>Erase all review history in this browser?</span>
            <button className="btn btn--sm srs-danger" onClick={() => { reset(); setConfirmReset(false) }}>Yes, reset</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setConfirmReset(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn btn--ghost btn--sm" onClick={() => setConfirmReset(true)} disabled={!cards.length && !state.log.length}>
            <RotateCcw size={14} /> Reset progress
          </button>
        )}
      </div>
    </section>
  )
}
