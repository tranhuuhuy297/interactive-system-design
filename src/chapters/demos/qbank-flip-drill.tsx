import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, RotateCw, Shuffle, Undo2 } from 'lucide-react'
import { Badge, Button } from '../../components/ui'
import type { BankQuestion } from '../../data/question-bank-data'
import type { QStatus } from './qbank-explorer'

interface FlipDrillProps {
  questions: BankQuestion[]
  status: Record<string, QStatus>
  onMark: (id: string, s: QStatus) => void
  onShuffle: () => void
}

/** One card at a time: front = question, back = senior + staff answers. Parent remounts it via `key` when filters change. */
export function QbankFlipDrill({ questions, status, onMark, onShuffle }: FlipDrillProps) {
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (!questions.length) return <p className="qb-empty">No questions match these filters.</p>
  const idx = Math.min(i, questions.length - 1)
  const q = questions[idx]
  const go = (n: number) => { setFlipped(false); setI((n + questions.length) % questions.length) }
  const mark = (s: QStatus) => { onMark(q.id, s); go(idx + 1) }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f) }
    else if (e.key === 'ArrowRight') go(idx + 1)
    else if (e.key === 'ArrowLeft') go(idx - 1)
  }

  return (
    <div className="qb-drill">
      <div className="qb-drill__meta">
        <span className="mono">{idx + 1} / {questions.length}</span>
        {status[q.id] && <Badge tone={status[q.id] === 'got' ? 'success' : 'warning'}>{status[q.id] === 'got' ? 'Got it' : 'Review'}</Badge>}
        <Button size="sm" variant="ghost" onClick={onShuffle}><Shuffle size={13} /> Shuffle</Button>
      </div>

      <div className={`qb-card ${flipped ? 'is-flipped' : ''}`} tabIndex={0} role="button" aria-pressed={flipped}
        aria-label={flipped ? 'Answer side. Press Space to flip back.' : 'Question side. Press Space to reveal the answer.'}
        onClick={() => setFlipped((f) => !f)} onKeyDown={onKey}>
        <div className="qb-card__inner">
          <div className="qb-card__face qb-card__front" aria-hidden={flipped}>
            <div className="qb-card__tags"><Badge tone="neutral">{q.category}</Badge><Badge tone={q.level === 'staff' ? 'warning' : 'accent'}>{q.level}</Badge></div>
            <p className="qb-card__q">{q.q}</p>
            <span className="qb-card__hint"><RotateCw size={13} /> Answer out loud, then click or press Space</span>
          </div>
          <div className="qb-card__face qb-card__back" aria-hidden={!flipped}>
            <div className="demo-label">Senior answer</div>
            <p className="qb-card__senior">{q.senior}</p>
            <div className="demo-label qb-card__staff-label">Staff adds</div>
            <ul className="qb-card__staff">{q.staff.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        </div>
      </div>

      <div className="qb-drill__nav">
        <Button variant="ghost" onClick={() => go(idx - 1)} aria-label="Previous card"><ArrowLeft size={15} /></Button>
        <Button variant="secondary" onClick={() => mark('review')}><Undo2 size={14} /> Review again</Button>
        <Button variant="primary" onClick={() => mark('got')}><Check size={14} /> Got it</Button>
        <Button variant="ghost" onClick={() => go(idx + 1)} aria-label="Next card"><ArrowRight size={15} /></Button>
      </div>
    </div>
  )
}
