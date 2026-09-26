import { useEffect, useState } from 'react'
import { Eye, Undo2 } from 'lucide-react'
import { GRADE_LABELS, formatInterval, previewInterval, schedule, type Grade } from '../../lib/spaced-repetition'
import { useNow } from '../../lib/use-now'
import { useSpacedRepetition } from '../../lib/use-spaced-repetition'
import { SrsCardView } from './srs-card-view'
import type { SrsCard } from './srs-deck'

// Cards that come back within this window (learning steps) are shown again before the session ends.
const REQUEUE_MS = 20 * 60_000

interface Step { pos: number; grade: Grade; appended: boolean }

export function SrsSession({ initialQueue, cards, onExit }: { initialQueue: string[]; cards: Map<string, SrsCard>; onExit: () => void }) {
  const { state, grade, undo } = useSpacedRepetition()
  const [queue, setQueue] = useState(initialQueue)
  const [pos, setPos] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [history, setHistory] = useState<Step[]>([])
  const clock = useNow(15_000)

  const id = queue[pos]
  const card = id ? cards.get(id) : undefined
  const done = pos >= queue.length

  const rate = (g: Grade) => {
    if (!id || !revealed) return
    const now = Date.now()
    const back = schedule(state.cards[id], g, now).due - now <= REQUEUE_MS
    grade(id, g, now)
    if (back) setQueue((q) => [...q, id])
    setHistory((h) => [...h, { pos, grade: g, appended: back }])
    setPos((p) => p + 1)
    setRevealed(false)
  }

  const undoLast = () => {
    const last = history[history.length - 1]
    if (!last) return
    undo()
    if (last.appended) setQueue((q) => q.slice(0, -1))
    setHistory((h) => h.slice(0, -1))
    setPos(last.pos)
    setRevealed(true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return
      if ((e.key === ' ' || e.key === 'Enter') && !revealed && !done) { e.preventDefault(); setRevealed(true) }
      else if (revealed && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); rate((Number(e.key) - 1) as Grade) }
      else if (e.key.toLowerCase() === 'u') { e.preventDefault(); undoLast() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (done) {
    const counts = [0, 1, 2, 3].map((g) => history.filter((h) => h.grade === g).length)
    const now = clock
    const next = Object.values(state.cards).map((c) => c.due).filter((d) => d > now).sort((a, b) => a - b)[0]
    return (
      <div className="srs-summary" role="status">
        <strong className="srs-summary__title">Session complete</strong>
        <p>{history.length} reviews. {next ? `Next card is due in ${formatInterval(next - now)}.` : 'Nothing scheduled yet.'}</p>
        <div className="srs-summary__grades">
          {GRADE_LABELS.map((l, g) => <div key={l} className={`srs-grade-pill srs-grade-pill--${g}`}><span>{l}</span><strong>{counts[g]}</strong></div>)}
        </div>
        <div className="srs-summary__actions">
          {history.length > 0 && <button className="btn btn--ghost btn--sm" onClick={undoLast}><Undo2 size={14} /> Undo last</button>}
          <button className="btn btn--primary btn--sm" onClick={onExit}>Back to overview</button>
        </div>
      </div>
    )
  }

  const now = clock
  return (
    <div className="srs-session">
      <div className="srs-session__bar">
        <span className="mono">{pos + 1} / {queue.length}</span>
        <div className="srs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={pos}>
          <span style={{ width: `${(pos / queue.length) * 100}%` }} />
        </div>
        <button className="btn btn--ghost btn--sm" onClick={undoLast} disabled={!history.length} title="Undo (U)"><Undo2 size={14} /> Undo</button>
        <button className="btn btn--ghost btn--sm" onClick={onExit}>End</button>
      </div>
      {card && <SrsCardView key={`${id}-${pos}`} card={card} revealed={revealed} />}
      <div className="srs-session__actions">
        {!revealed ? (
          <button className="btn btn--primary btn--md srs-reveal" onClick={() => setRevealed(true)}><Eye size={15} /> Show answer <kbd>Space</kbd></button>
        ) : (
          <div className="srs-grades" role="group" aria-label="How well did you recall it?">
            {GRADE_LABELS.map((label, g) => (
              <button key={label} className={`srs-grade srs-grade--${g}`} onClick={() => rate(g as Grade)}>
                <span className="srs-grade__label">{label}</span>
                <span className="srs-grade__next mono">{previewInterval(state.cards[id], g as Grade, now)}</span>
                <kbd>{g + 1}</kbd>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
