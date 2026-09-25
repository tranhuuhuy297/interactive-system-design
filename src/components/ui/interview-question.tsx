import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, MessageCircleQuestion } from 'lucide-react'

interface InterviewQuestionProps {
  q: string
  /** Solid, correct answer — what a strong senior says. */
  senior: ReactNode
  /** What a staff engineer adds: org scope, trade-offs, second-order effects. */
  staff: ReactNode
  followUps?: string[]
}

/** Collapsible interview prompt with a Senior ↔ Staff answer toggle. */
export function InterviewQuestion({ q, senior, staff, followUps }: InterviewQuestionProps) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<'senior' | 'staff'>('staff')
  return (
    <div className={`iq ${open ? 'is-open' : ''}`}>
      <button className="iq__q" aria-expanded={open} onClick={() => setOpen(!open)}>
        <MessageCircleQuestion size={18} className="iq__icon" aria-hidden />
        <span>{q}</span>
        <ChevronDown size={18} className="iq__chev" aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="iq__a" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <div className="iq__inner">
              <div className="iq__levels" role="radiogroup" aria-label="Answer level">
                {(['senior', 'staff'] as const).map((l) => (
                  <button key={l} role="radio" aria-checked={level === l}
                    className={`iq__level ${level === l ? 'is-active' : ''}`} onClick={() => setLevel(l)}>
                    {l === 'senior' ? 'Senior answer' : 'Staff answer'}
                  </button>
                ))}
              </div>
              <div className="iq__body" key={level}>{level === 'senior' ? senior : staff}</div>
              {followUps && followUps.length > 0 && (
                <div className="iq__follow">
                  <span>Likely follow-ups</span>
                  <ul>{followUps.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
