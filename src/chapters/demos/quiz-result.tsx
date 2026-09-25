import { useEffect, useState } from 'react'
import { animate, motion } from 'motion/react'
import { RotateCcw, Trophy, XCircle } from 'lucide-react'
import { Button } from '../../components/ui'
import { isCorrect, type SessionItem } from './quiz-session'

interface QuizResultProps {
  items: SessionItem[]
  best: number
  isNewBest: boolean
  onRetry: () => void
}

export function QuizResult({ items, best, isNewBest, onRetry }: QuizResultProps) {
  const correct = items.filter(isCorrect).length
  const pct = Math.round((correct / items.length) * 100)
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const c = animate(0, pct, { duration: 1.2, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(Math.round(v)) })
    return () => c.stop()
  }, [pct])
  const wrong = items.filter((it) => !isCorrect(it))
  const verdict = pct >= 90 ? 'Interview ready' : pct >= 70 ? 'Strong — polish the gaps' : pct >= 50 ? 'Getting there' : 'Revisit the chapters'
  const r = 54
  const c = 2 * Math.PI * r

  return (
    <div className="quiz-result">
      <div className="quiz-result__hero">
        <svg viewBox="0 0 128 128" width="148" height="148" aria-hidden>
          <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
          <motion.circle cx="64" cy="64" r={r} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} transform="rotate(-90 64 64)" />
        </svg>
        <div className="quiz-result__pct"><span className="mono">{shown}%</span><small>{correct}/{items.length}</small></div>
      </div>
      <h3 className="quiz-result__verdict">{verdict}</h3>
      <p className="quiz-result__best">
        {isNewBest ? <><Trophy size={15} /> New personal best!</> : <>Best: {best}%</>}
      </p>
      <Button variant="primary" onClick={onRetry}><RotateCcw size={15} /> Try again</Button>

      {wrong.length > 0 && (
        <div className="quiz-review">
          <div className="demo-label">Review your misses</div>
          {wrong.map((it) => (
            <div key={it.question.id} className="quiz-review__item">
              <p className="quiz-review__q"><XCircle size={15} /> {it.question.q}</p>
              <p><span className="quiz-review__label">You:</span> {it.picked == null ? '— (time ran out)' : it.question.options[it.picked]}</p>
              <p><span className="quiz-review__label is-ok">Correct:</span> {it.question.options[it.question.answer]}</p>
              <p className="quiz-review__why">{it.question.explain}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
