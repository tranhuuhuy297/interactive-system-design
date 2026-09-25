import { useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Button, DemoFrame } from '../../components/ui'
import type { MockPrompt } from '../../data/mock-prompts-data'
import { useLocalStorageState } from '../../lib/use-local-storage-state'
import { MockHistoryChart } from './mock-history-chart'
import type { MockHistoryEntry } from './mock-phases'
import { MockPromptPicker } from './mock-prompt-picker'
import { MockScoreCard } from './mock-score-card'
import { MockSessionRunner } from './mock-session-runner'
import './mock-simulator.css'

type Stage = 'pick' | 'run' | 'score'

/** Pick a prompt, run a timed session, then self-score into a persisted history. */
export function MockSimulator() {
  const [stage, setStage] = useState<Stage>('pick')
  const [prompt, setPrompt] = useState<MockPrompt | null>(null)
  const [minutes, setMinutes] = useState(0)
  const [history, setHistory] = useLocalStorageState<MockHistoryEntry[]>('sdh:mock-history', [])

  const reset = () => { setStage('pick'); setPrompt(null) }

  return (
    <DemoFrame title="Mock interview simulator" onReset={reset}
      hint={stage === 'pick' ? 'Choose a prompt or draw one at random. The clock starts immediately.' : undefined}>
      {stage !== 'pick' && (
        <Button size="sm" variant="ghost" onClick={reset} className="mk-back"><ArrowLeft size={13} /> Choose another prompt</Button>
      )}
      {stage === 'pick' && <MockPromptPicker onPick={(p) => { setPrompt(p); setStage('run') }} />}
      {stage === 'run' && prompt && (
        <MockSessionRunner key={prompt.id} prompt={prompt} onFinish={(m) => { setMinutes(m); setStage('score') }} />
      )}
      {stage === 'score' && prompt && (
        <MockScoreCard prompt={prompt} minutes={minutes}
          onSave={(e) => { setHistory((h) => [...h, e].slice(-50)); reset() }} />
      )}

      <div className="mk-history">
        <div className="mk-history__head">
          <span className="demo-label">Your progress</span>
          {history.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setHistory([])}><Trash2 size={13} /> Clear history</Button>
          )}
        </div>
        <MockHistoryChart history={history} />
      </div>
    </DemoFrame>
  )
}
