import { QUIZ } from '../../data/quiz-data'
import type { QuizQuestion } from '../../data/quiz-data'

export interface SessionItem {
  question: QuizQuestion
  /** Option indices in display order; shuffled so the correct answer isn't positionally guessable. */
  order: number[]
  picked: number | null
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}

export function buildSession(count: number | 'all'): SessionItem[] {
  const picked = shuffle(QUIZ).slice(0, count === 'all' ? QUIZ.length : count)
  return picked.map((q) => ({ question: q, order: shuffle(q.options.map((_, i) => i)), picked: null }))
}

export const isCorrect = (it: SessionItem) => it.picked === it.question.answer
