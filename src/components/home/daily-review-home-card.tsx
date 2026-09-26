import { useEffect, useState } from 'react'
import { CalendarCheck, Flame, Play } from 'lucide-react'
import { stats } from '../../lib/spaced-repetition'
import { useNow } from '../../lib/use-now'
import { useSpacedRepetition } from '../../lib/use-spaced-repetition'
import './daily-review-home-card.css'

/** Compact "due today" prompt for the home page; links to the Daily Review page. */
export function DailyReviewHomeCard() {
  const { state, settings } = useSpacedRepetition()
  const [deckIds, setDeckIds] = useState<string[] | null>(null)

  // The deck pulls in every card source, so load it lazily to keep the home page light.
  // `settings` is rebuilt every render; key the effect on its value instead.
  const deckKey = JSON.stringify([settings.sources, settings.track])
  useEffect(() => {
    let alive = true
    const [sources, track] = JSON.parse(deckKey) as [typeof settings.sources, typeof settings.track]
    import('../../chapters/demos/srs-deck').then(({ buildDeck, filterDeck }) => {
      if (alive) setDeckIds(filterDeck(buildDeck(), { ...settings, sources, track }).map((c) => c.id))
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckKey])

  const now = useNow()
  const s = stats(state, deckIds ?? [], now, settings.newPerDay)
  const started = Object.keys(state.cards).length > 0
  const queued = s.dueNow + s.newAvailable

  return (
    <section className="srs-home" aria-label="Daily review">
      <span className="srs-home__icon"><CalendarCheck size={20} aria-hidden /></span>
      <div className="srs-home__text">
        <strong>{started ? (s.dueNow ? `${s.dueNow} ${s.dueNow === 1 ? 'card' : 'cards'} due for review` : 'Reviews done for now') : 'Remember what you read'}</strong>
        <p>
          {started
            ? <>{s.newAvailable} new cards ready · <Flame size={12} aria-hidden /> {s.streak}-day streak</>
            : 'Spaced repetition brings back questions, mental models, and terms just before you forget them.'}
        </p>
      </div>
      <a className="btn btn--primary btn--sm" href="#/review"><Play size={14} /> {queued ? 'Start review' : 'Open review'}</a>
    </section>
  )
}
