import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { planContext, type BudgetInputs, type Strategy, type TurnFate } from './episode-chatgpt-context-model'
import './episode-chatgpt-demos.css'

const DEFAULTS: BudgetInputs = {
  windowTokens: 8192, systemTokens: 600, toolTokens: 800, docChunks: 4, chunkTokens: 400,
  turns: 40, tokensPerTurn: 250, reservedOutput: 1000, strategy: 'truncate',
}
const WINDOWS = ['8192', '32768', '131072'] as const
const LABELS: Record<string, string> = {
  system: 'System prompt', tools: 'Tool definitions', docs: 'Retrieved docs', summary: 'Summary of old turns',
  history: 'Conversation turns', output: 'Reserved for answer', free: 'Unused',
}
const FATE_LABEL: Record<TurnFate, string> = { kept: 'kept verbatim', summarized: 'summarized', retrieved: 'retrieved', dropped: 'dropped' }
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`)

export function EpisodeChatgptContextBudgetDemo() {
  const [inp, setInp] = useState<BudgetInputs>(DEFAULTS)
  const set = <K extends keyof BudgetInputs>(k: K, v: BudgetInputs[K]) => setInp((p) => ({ ...p, [k]: v }))
  const r = planContext(inp)
  const count = (f: TurnFate) => r.fates.filter((x) => x === f).length

  return (
    <DemoFrame title="Context window budget: what the model actually sees" onReset={() => setInp(DEFAULTS)}
      hint="Grow the conversation and compare strategies. Every prompt token is paid for on every request. Illustrative token counts.">
      <div className="gpt-ctx">
        <div className="demo-controls">
          <Segmented label="Context window" value={String(inp.windowTokens) as (typeof WINDOWS)[number]}
            onChange={(v) => set('windowTokens', Number(v))}
            options={[{ value: '8192', label: '8K' }, { value: '32768', label: '32K' }, { value: '131072', label: '128K' }]} />
          <Segmented<Strategy> label="When history doesn't fit" value={inp.strategy} onChange={(v) => set('strategy', v)}
            options={[{ value: 'truncate', label: 'Drop oldest' }, { value: 'summarize', label: 'Summarize' }, { value: 'retrieve', label: 'Retrieve' }]} />
          <Slider label="Conversation turns" min={0} max={80} value={inp.turns} onChange={(v) => set('turns', v)} />
          <Slider label="Tokens per turn" min={50} max={1500} step={50} value={inp.tokensPerTurn} onChange={(v) => set('tokensPerTurn', v)} />
          <Slider label="Retrieved doc chunks" min={0} max={20} value={inp.docChunks} onChange={(v) => set('docChunks', v)} format={(v) => `${v} × ${inp.chunkTokens}`} />
          <Slider label="Reserved for answer" min={256} max={4096} step={256} value={inp.reservedOutput} onChange={(v) => set('reservedOutput', v)} />
        </div>

        <div className="gpt-ctx__out">
          <div className="gpt-ctx__stats">
            <div><span>Prompt tokens / request</span><strong>{fmt(r.promptTokens)}</strong></div>
            <div><span>Window used</span><strong>{Math.min(100, Math.round(((inp.windowTokens - r.segments[6].tokens) / inp.windowTokens) * 100))}%</strong></div>
          </div>
          {r.overflow > 0 && <p className="gpt-ctx__warn" role="status">Fixed parts alone exceed the window by {fmt(r.overflow)} tokens. Cut retrieved docs or the reserved answer.</p>}
          <div className="gpt-ctx__bar" role="img" aria-label="Context window composition">
            {r.segments.filter((s) => s.tokens > 0).map((s) => (
              <i key={s.id} className={`gpt-ctx__seg gpt-ctx__seg--${s.id}`}
                style={{ flexGrow: s.tokens }} title={`${LABELS[s.id]}: ${s.tokens} tokens`} />
            ))}
          </div>
          <ul className="gpt-ctx__legend">
            {r.segments.map((s) => (
              <li key={s.id}><i className={`gpt-ctx__seg--${s.id}`} />{LABELS[s.id]}<span className="mono">{fmt(s.tokens)}</span></li>
            ))}
          </ul>
          <div>
            <div className="demo-label">Conversation turns, oldest → newest</div>
            <div className="gpt-ctx__turns" aria-label={`${count('kept')} kept, ${count('summarized')} summarized, ${count('retrieved')} retrieved, ${count('dropped')} dropped`}>
              {r.fates.map((f, k) => <i key={k} className={`gpt-ctx__turn gpt-ctx__turn--${f}`} title={`Turn ${k + 1}: ${FATE_LABEL[f]}`} />)}
              {r.fates.length === 0 && <span className="gpt-ctx__empty">New chat, no history yet</span>}
            </div>
            <div className="gpt-ctx__fates">
              {(['kept', 'summarized', 'retrieved', 'dropped'] as TurnFate[]).map((f) => (
                <span key={f}><i className={`gpt-ctx__turn gpt-ctx__turn--${f}`} />{count(f)} {FATE_LABEL[f]}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
