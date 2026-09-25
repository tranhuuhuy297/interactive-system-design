import { useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import { QUESTIONS, recommend, type Answers, type QId } from './ai-ft-model'
import './ai-ft-demos.css'

type YN = 'yes' | 'no'

export function AiFtDecisionWizardDemo() {
  const [answers, setAnswers] = useState<Answers>({})
  const verdict = recommend(answers)
  const pending = 'pending' in verdict ? verdict.pending : null
  // Show questions up to the first unanswered one the rules actually need.
  const lastIdx = pending ? QUESTIONS.findIndex((q) => q.id === pending) : QUESTIONS.findLastIndex((q) => answers[q.id] !== undefined)

  const set = (id: QId, v: YN) => {
    // Changing an earlier answer invalidates later ones.
    const idx = QUESTIONS.findIndex((q) => q.id === id)
    const next: Answers = {}
    QUESTIONS.slice(0, idx).forEach((q) => { if (answers[q.id] !== undefined) next[q.id] = answers[q.id] })
    next[id] = v === 'yes'
    setAnswers(next)
  }

  return (
    <DemoFrame title="Should you fine-tune? A decision walk-through" onReset={() => setAnswers({})}
      hint="Rules are ordered by cost: the cheapest fix that addresses the gap wins.">
      <div className="aift-wiz">
        <ol className="aift-wiz__qs">
          {QUESTIONS.slice(0, lastIdx + 1).map((q, i) => (
            <li key={q.id}>
              <span className="aift-wiz__n">{i + 1}</span>
              <p>{q.text}</p>
              <Segmented label={q.text} value={answers[q.id] === undefined ? ('' as YN) : answers[q.id] ? 'yes' : 'no'}
                onChange={(v) => set(q.id, v)} options={['yes', 'no'] as const} />
            </li>
          ))}
        </ol>
        {'title' in verdict && (
          <div className="aift-wiz__verdict" role="status">
            <span>Recommendation</span>
            <strong>{verdict.title}</strong>
            <p>{verdict.why}</p>
          </div>
        )}
      </div>
    </DemoFrame>
  )
}
