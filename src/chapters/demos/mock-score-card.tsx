import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '../../components/ui'
import type { MockPrompt } from '../../data/mock-prompts-data'
import { RUBRIC_DIMENSIONS } from './mock-phases'
import type { MockHistoryEntry, RubricId } from './mock-phases'

const LEVELS = ['Missing', 'Weak', 'Senior', 'Staff']

interface ScoreCardProps {
  prompt: MockPrompt
  minutes: number
  onSave: (entry: MockHistoryEntry) => void
}

/** 1–4 self-rating per rubric dimension; the saved entry feeds the history chart. */
export function MockScoreCard({ prompt, minutes, onSave }: ScoreCardProps) {
  const [scores, setScores] = useState<Partial<Record<RubricId, number>>>({})
  const done = RUBRIC_DIMENSIONS.every((d) => scores[d.id])
  const total = RUBRIC_DIMENSIONS.reduce((s, d) => s + (scores[d.id] ?? 0), 0)
  const pct = Math.round((total / (RUBRIC_DIMENSIONS.length * 4)) * 100)
  const verdict = pct >= 85 ? 'Strong staff signal' : pct >= 70 ? 'Solid senior, reaching for staff' : pct >= 50 ? 'Senior with gaps' : 'Keep practicing'

  const save = () => onSave({ at: Date.now(), promptId: prompt.id, title: prompt.title, minutes, scores: scores as Record<RubricId, number>, pct })

  return (
    <div className="mk-score">
      <p className="mk-score__lead">
        <strong>{prompt.title}</strong> · {minutes} min. Rate yourself honestly. “Staff” means you did what the note describes without being prompted.
      </p>
      <div className="mk-score__rows">
        {RUBRIC_DIMENSIONS.map((d) => (
          <fieldset key={d.id} className="mk-score__row">
            <legend>
              <span>{d.label}</span>
              <small>Staff = {d.staff}</small>
            </legend>
            <div className="mk-score__opts" role="radiogroup" aria-label={d.label}>
              {LEVELS.map((l, i) => (
                <button key={l} role="radio" aria-checked={scores[d.id] === i + 1}
                  className={`mk-score__opt ${scores[d.id] === i + 1 ? 'is-on' : ''} lvl-${i + 1}`}
                  onClick={() => setScores((s) => ({ ...s, [d.id]: i + 1 }))}>{l}</button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mk-score__foot">
        <div>
          <span className="mk-score__pct mono">{done ? `${pct}%` : '—'}</span>
          <span className="mk-score__verdict">{done ? verdict : 'Rate every dimension to see your result'}</span>
        </div>
        <Button variant="primary" onClick={save} disabled={!done}><Save size={14} /> Save to history</Button>
      </div>
    </div>
  )
}
