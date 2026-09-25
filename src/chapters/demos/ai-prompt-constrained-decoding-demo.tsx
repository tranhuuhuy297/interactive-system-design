import { useMemo, useState } from 'react'
import { Badge, Button, DemoFrame, Segmented } from '../../components/ui'
import { decode, render, validate } from './ai-prompt-constrained-model'
import './ai-prompt-demos.css'

type Mode = 'free' | 'constrained'

const show = (t: string) => (t === '\n' ? '⏎' : t)

export function AiPromptConstrainedDecodingDemo() {
  const [mode, setMode] = useState<Mode>('free')
  const [k, setK] = useState(0)
  const steps = useMemo(() => decode(mode === 'constrained'), [mode])
  const done = k >= steps.length
  const current = done ? null : steps[k]
  const output = render(steps.slice(0, k).map((s) => s.chosen))
  const verdict = done ? validate(output) : null

  const pick = (m: Mode) => { setMode(m); setK(0) }

  return (
    <DemoFrame title="Constrained decoding: masking tokens the schema forbids" onReset={() => setK(0)}
      hint='Target schema: {"status": "ok" | "error", "count": integer}. The "model" here is a scripted toy that likes chatty preambles and invents enum values.'>
      <div className="aip-cd">
        <div className="aip-cd__bar">
          <Segmented label="Decoding mode" value={mode} onChange={pick}
            options={[{ value: 'free', label: 'Free generation' }, { value: 'constrained', label: 'Grammar-constrained' }]} />
          <div className="aip-cd__btns">
            <Button size="sm" variant="primary" onClick={() => setK((x) => Math.min(steps.length, x + 1))} disabled={done}>Next token</Button>
            <Button size="sm" onClick={() => setK(steps.length)} disabled={done}>Run to end</Button>
          </div>
        </div>

        <div className="aip-cd__grid">
          <div>
            <div className="demo-label">Step {Math.min(k + 1, steps.length)} · candidate next tokens</div>
            {current ? (
              <ol className="aip-cd__cands" aria-live="polite">
                {current.candidates.filter((c) => c.score > 0.02 || !c.masked).slice(0, 8).map((c) => (
                  <li key={c.tok} className={`${c.masked ? 'is-masked' : ''} ${c.tok === current.chosen ? 'is-chosen' : ''}`}>
                    <code>{show(c.tok)}</code>
                    <span className="aip-cd__bar-track"><i style={{ width: `${c.score * 100}%` }} /></span>
                    <span className="aip-cd__score mono">{c.masked ? 'masked' : c.score.toFixed(2)}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="aip-cd__empty">Generation finished.</p>}
          </div>

          <div>
            <div className="demo-label">Output so far</div>
            <pre className="aip-cd__out">{output || ' '}<span className="aip-cd__caret" aria-hidden>▍</span></pre>
            {verdict && (
              <div className="aip-cd__verdict">
                <Badge tone={verdict.ok ? 'success' : 'danger'}>{verdict.ok ? 'Valid' : 'Invalid'}</Badge>
                <span>{verdict.reason}</span>
              </div>
            )}
          </div>
        </div>
        <p className="aip-cd__note">
          Constrained mode never changes the model’s scores. It only sets forbidden tokens to −∞ before sampling, so the best
          <em> allowed</em> token wins. The grammar here is a tiny hand-written state machine; real libraries compile a JSON schema or
          regex into one.
        </p>
      </div>
    </DemoFrame>
  )
}
