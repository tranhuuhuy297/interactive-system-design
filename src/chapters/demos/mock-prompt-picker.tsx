import { useState } from 'react'
import { Dices } from 'lucide-react'
import { Badge, Button, Segmented } from '../../components/ui'
import { MOCK_PROMPTS } from '../../data/mock-prompts-data'
import type { MockPrompt, PromptDifficulty } from '../../data/mock-prompts-data'

type Filter = 'all' | PromptDifficulty
const TONE: Record<PromptDifficulty, 'success' | 'accent' | 'warning'> = { 'warm-up': 'success', standard: 'accent', hard: 'warning' }

/** Prompt deck: filter by difficulty, pick one, or draw at random. */
export function MockPromptPicker({ onPick }: { onPick: (p: MockPrompt) => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const list = MOCK_PROMPTS.filter((p) => filter === 'all' || p.difficulty === filter)
  const random = () => onPick(list[Math.floor(Math.random() * list.length)])

  return (
    <div className="mk-pick">
      <div className="mk-pick__bar">
        <Segmented label="Difficulty" value={filter} onChange={setFilter}
          options={[{ value: 'all', label: `All ${MOCK_PROMPTS.length}` }, { value: 'warm-up', label: 'Warm-up' }, { value: 'standard', label: 'Standard' }, { value: 'hard', label: 'Hard' }] as { value: Filter; label: string }[]} />
        <Button variant="primary" onClick={random} disabled={!list.length}><Dices size={15} /> Random prompt</Button>
      </div>
      <div className="mk-pick__grid">
        {list.map((p) => (
          <button key={p.id} className="mk-pick__card" onClick={() => onPick(p)}>
            <Badge tone={TONE[p.difficulty]}>{p.difficulty}</Badge>
            <strong>{p.title}</strong>
            <span>{p.deepDives.slice(0, 2).join(' · ')}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
