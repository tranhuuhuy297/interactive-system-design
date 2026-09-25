import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { Button, DemoFrame, Segmented } from '../../components/ui'
import { UPGRADE_SCENARIOS } from './staff-upgrader-data'
import './staff-signals.css'

/** Start from a solid senior answer and reveal staff-level additions one at a time, each annotated. */
export function StaffAnswerUpgrader() {
  const [id, setId] = useState(UPGRADE_SCENARIOS[0].id)
  const [shown, setShown] = useState(0)
  const sc = UPGRADE_SCENARIOS.find((s) => s.id === id) ?? UPGRADE_SCENARIOS[0]
  const all = shown >= sc.upgrades.length

  return (
    <DemoFrame title="Answer upgrader: senior → staff" onReset={() => setShown(0)}
      hint="Read the senior answer and predict what's missing. Then reveal the upgrades one by one.">
      <Segmented label="Scenario" value={id} onChange={(v) => { setId(v); setShown(0) }}
        options={UPGRADE_SCENARIOS.map((s) => ({ value: s.id, label: s.label }))} />

      <p className="st-up__q">“{sc.question}”</p>

      <div className="st-up__senior">
        <span className="demo-label">Senior answer · correct, but not yet staff</span>
        <p>{sc.senior}</p>
      </div>

      <ol className="st-up__list">
        <AnimatePresence initial={false}>
          {sc.upgrades.slice(0, shown).map((u, i) => (
            <motion.li key={`${sc.id}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <span className="st-up__signal">+ {u.signal}</span>
              <p className="st-up__says">“{u.says}”</p>
              <p className="st-up__why">{u.why}</p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      <div className="st-up__foot">
        <span className="st-up__count mono">{shown}/{sc.upgrades.length} upgrades</span>
        {all ? (
          <Button variant="secondary" onClick={() => setShown(0)}><RotateCcw size={14} /> Start over</Button>
        ) : (
          <Button variant="primary" onClick={() => setShown(shown + 1)}>Reveal next upgrade <ChevronRight size={14} /></Button>
        )}
      </div>
    </DemoFrame>
  )
}
