import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CheckCircle2, Play, Timer, XCircle } from 'lucide-react'
import { Button, DemoFrame, Segmented } from '../../components/ui'
import { QUIZ } from '../../data/quiz-data'
import { useLocalStorageState } from '../../lib/use-local-storage-state'
import { QuizResult } from './quiz-result'
import { buildSession, isCorrect, type SessionItem } from './quiz-session'
import './quiz.css'

const SECONDS = 30
type Count = '10' | 'all'

export function QuizRunner() {
  const [phase, setPhase] = useState<'setup' | 'play' | 'done'>('setup')
  const [count, setCount] = useState<Count>('10')
  const [timed, setTimed] = useState<'off' | 'on'>('off')
  const [items, setItems] = useState<SessionItem[]>([])
  const [i, setI] = useState(0)
  const [left, setLeft] = useState(SECONDS)
  const [best, setBest] = useLocalStorageState<number>('sdh:quiz-best', 0)
  const [newBest, setNewBest] = useState(false)

  const cur = items[i]
  const answered = cur?.picked != null || (timed === 'on' && left === 0)

  const start = () => { setItems(buildSession(count === 'all' ? 'all' : 10)); setI(0); setLeft(SECONDS); setPhase('play') }

  const pick = useCallback((opt: number) => {
    if (phase !== 'play' || answered) return
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, picked: opt } : it)))
  }, [phase, answered, i])

  const next = useCallback(() => {
    if (!answered) return
    if (i + 1 < items.length) { setI(i + 1); setLeft(SECONDS); return }
    const pct = Math.round((items.filter(isCorrect).length / items.length) * 100)
    setNewBest(pct > best)
    if (pct > best) setBest(pct)
    setPhase('done')
  }, [answered, i, items, best, setBest])

  useEffect(() => {
    if (phase !== 'play' || timed === 'off' || answered) return
    const t = setTimeout(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => clearTimeout(t)
  }, [phase, timed, answered, left])

  useEffect(() => {
    if (phase !== 'play') return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      const n = Number(e.key)
      if (n >= 1 && n <= (cur?.order.length ?? 0)) pick(cur.order[n - 1])
      else if (e.key === 'Enter' && answered) { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, cur, pick, next, answered])

  return (
    <DemoFrame title="Knowledge quiz" onReset={() => setPhase('setup')}
      hint={phase === 'play' ? 'Keys 1–4 to answer, Enter for next.' : undefined}>
      {phase === 'setup' && (
        <div className="quiz-setup">
          <p className="quiz-setup__lead">{QUIZ.length} questions in the pool. Options are shuffled every run.</p>
          <div className="quiz-setup__row"><span className="demo-label">Questions</span>
            <Segmented label="Question count" options={[{ value: '10', label: '10 random' }, { value: 'all', label: `All ${QUIZ.length}` }] as { value: Count; label: string }[]} value={count} onChange={setCount} /></div>
          <div className="quiz-setup__row"><span className="demo-label">Timer ({SECONDS}s each)</span>
            <Segmented label="Timer" options={['off', 'on'] as const} value={timed} onChange={setTimed} /></div>
          <div className="quiz-setup__row"><span className="demo-label">Best score</span><strong className="mono">{best}%</strong></div>
          <Button variant="primary" onClick={start}><Play size={15} /> Start quiz</Button>
        </div>
      )}

      {phase === 'play' && cur && (
        <div className="quiz-play">
          <div className="quiz-play__top">
            <span className="mono">Q{i + 1}/{items.length}</span>
            <span className="quiz-play__topic">{cur.question.topic}</span>
            {timed === 'on' && <span className={`quiz-play__timer mono ${left <= 5 ? 'is-low' : ''}`}><Timer size={13} /> {left}s</span>}
          </div>
          <div className="quiz-play__progress" aria-hidden><span style={{ width: `${(i / items.length) * 100}%` }} /></div>
          <AnimatePresence mode="wait">
            <motion.div key={cur.question.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
              <p className="quiz-play__q">{cur.question.q}</p>
              <div className="quiz-opts" role="radiogroup" aria-label="Answer options">
                {cur.order.map((opt, k) => {
                  const state = !answered ? '' : opt === cur.question.answer ? 'is-right' : opt === cur.picked ? 'is-wrong' : 'is-dim'
                  return (
                    <button key={opt} role="radio" aria-checked={cur.picked === opt} disabled={answered}
                      className={`quiz-opt ${state}`} onClick={() => pick(opt)}>
                      <kbd>{k + 1}</kbd><span>{cur.question.options[opt]}</span>
                      {state === 'is-right' && <CheckCircle2 size={17} />}
                      {state === 'is-wrong' && <XCircle size={17} />}
                    </button>
                  )
                })}
              </div>
              {answered && (
                <motion.div className={`quiz-explain ${isCorrect(cur) ? 'is-ok' : 'is-bad'}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} role="status">
                  <strong>{isCorrect(cur) ? 'Correct.' : cur.picked == null ? 'Time’s up.' : 'Not quite.'}</strong> {cur.question.explain}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="quiz-play__nav">
            <Button variant="primary" onClick={next} disabled={!answered}>
              {i + 1 < items.length ? 'Next' : 'See results'} <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {phase === 'done' && <QuizResult items={items} best={best} isNewBest={newBest} onRetry={start} />}
    </DemoFrame>
  )
}
