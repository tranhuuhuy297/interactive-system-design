import { useMemo, useState } from 'react'
import { Callout, H2, KeyTakeaways, TLDR } from '../components/ui'
import { stats } from '../lib/spaced-repetition'
import { useNow } from '../lib/use-now'
import { useSpacedRepetition } from '../lib/use-spaced-repetition'
import { buildDeck, filterDeck, type SrsCard } from './demos/srs-deck'
import { SrsOverview } from './demos/srs-overview'
import { SrsSession } from './demos/srs-session'
import { SrsSettingsPanel } from './demos/srs-settings-panel'
import './demos/srs.css'

/** Round-robin by source so a session mixes questions, pictures, and terms. */
function interleave(cards: SrsCard[]): SrsCard[] {
  const by = { qb: [] as SrsCard[], mm: [] as SrsCard[], gl: [] as SrsCard[] }
  cards.forEach((c) => by[c.source].push(c))
  const out: SrsCard[] = []
  for (let i = 0; out.length < cards.length; i++) (['mm', 'qb', 'gl'] as const).forEach((s) => { if (by[s][i]) out.push(by[s][i]) })
  return out
}

export default function DailyReviewChapter() {
  const deck = useMemo(() => buildDeck(), [])
  const byId = useMemo(() => new Map(deck.map((c) => [c.id, c])), [deck])
  const { state, settings } = useSpacedRepetition()
  const [session, setSession] = useState<{ key: number; queue: string[] } | null>(null)

  const pool = filterDeck(deck, settings)
  const poolIds = new Set(pool.map((c) => c.id))
  const now = useNow()
  const s = stats(state, pool.map((c) => c.id), now, settings.newPerDay)
  const dueIds = Object.entries(state.cards).filter(([id, c]) => poolIds.has(id) && c.due <= now).sort((a, b) => a[1].due - b[1].due).map(([id]) => id)
  const newIds = interleave(pool.filter((c) => !state.cards[c.id])).slice(0, s.newAvailable).map((c) => c.id)

  const start = (queue: string[]) => setSession({ key: Date.now(), queue: queue.slice(0, settings.maxPerSession) })
  const studyAhead = () => {
    const upcoming = Object.entries(state.cards).filter(([id, c]) => poolIds.has(id) && c.due > now).sort((a, b) => a[1].due - b[1].due).map(([id]) => id)
    const extraNew = interleave(pool.filter((c) => !state.cards[c.id])).slice(0, 10).map((c) => c.id)
    start(upcoming.length ? upcoming.slice(0, 20) : extraNew)
  }

  if (session) {
    return (
      <div className="srs-page">
        <SrsSession key={session.key} initialQueue={session.queue} cards={byId} onExit={() => setSession(null)} />
      </div>
    )
  }

  return (
    <div className="srs-page">
      <p>
        Reading a chapter once is not enough to recall it in an interview. This page brings back interview questions,
        mental-model pictures, and glossary terms just before you would forget them, and less often each time you
        remember.
      </p>
      <TLDR items={[
        'A few minutes a day beats one long cram session.',
        'Grade honestly: Again if you blanked, Good if you recalled it with effort, Easy if it was instant.',
        'Cards you know move out to weeks and months; cards you miss come back in minutes.',
        'Progress is stored only in this browser.',
      ]} />

      <SrsOverview state={state} stats={s} poolIds={poolIds} dueCount={dueIds.length} newCount={newIds.length}
        deckSize={pool.length} onStart={() => start([...dueIds, ...newIds])} onStudyAhead={studyAhead} />

      <H2 id="settings">Deck & settings</H2>
      <SrsSettingsPanel deck={deck} />

      <H2 id="how-it-works">How the schedule works</H2>
      <p>
        The scheduler is a variant of SM-2, the algorithm behind SuperMemo and Anki. A new card is shown again after
        10 minutes, then after a day, then graduates to a 3-day interval. Each successful review multiplies the
        interval by the card's ease (starting at 2.5). A miss resets the card to relearning and lowers its ease, so
        hard cards come back more often.
      </p>
      <Callout kind="tip">
        Keyboard: <kbd>Space</kbd> shows the answer, <kbd>1</kbd>–<kbd>4</kbd> grade it (Again, Hard, Good, Easy), and{' '}
        <kbd>U</kbd> undoes the last grade.
      </Callout>

      <KeyTakeaways items={[
        'Retrieval practice (trying to recall) strengthens memory far more than re-reading.',
        'Spacing reviews out, and growing the gaps, makes recall durable.',
        'Keep daily new cards modest; reviews of past cards grow with every new card you add.',
      ]} />
    </div>
  )
}
