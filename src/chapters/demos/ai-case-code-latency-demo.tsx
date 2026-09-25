import { useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { completionBudget, type CompletionConfig } from './ai-case-code-latency-model'
import './ai-case-code-demos.css'

const DEFAULTS: CompletionConfig = {
  smallModel: false, speculative: false, prefixCacheHit: false, cancelStale: false,
  promptTokens: 4000, outputTokens: 48, pauseMs: 500,
}

const TOGGLES: { key: 'smallModel' | 'speculative' | 'prefixCacheHit' | 'cancelStale'; label: string; hint: string }[] = [
  { key: 'smallModel', label: 'Small completion model', hint: 'A few-billion-parameter model instead of a large one' },
  { key: 'prefixCacheHit', label: 'Prefix cache hit', hint: 'Most of the file context was already prefilled on the last keystroke' },
  { key: 'speculative', label: 'Speculative decoding', hint: 'A draft model proposes tokens; the main model verifies them in bulk' },
  { key: 'cancelStale', label: 'Cancel on keystroke', hint: 'Abort in-flight requests for prefixes the user already typed past' },
]

export function AiCaseCodeLatencyDemo() {
  const [cfg, setCfg] = useState<CompletionConfig>(DEFAULTS)
  const set = <K extends keyof CompletionConfig>(k: K, v: CompletionConfig[K]) => setCfg((c) => ({ ...c, [k]: v }))
  const { segments, total, inTime } = completionBudget(cfg)
  const scale = Math.max(total, cfg.pauseMs) * 1.08

  return (
    <DemoFrame title="Will the suggestion arrive before the next keystroke?" onReset={() => setCfg(DEFAULTS)}
      hint="Every constant here is illustrative. What matters is which segment dominates and which lever moves it.">
      <div className="cla">
        <div className="demo-controls">
          <div className="cla__toggles" role="group" aria-label="Optimizations">
            {TOGGLES.map((t) => (
              <label key={t.key} className="cla__toggle">
                <input type="checkbox" checked={cfg[t.key]} onChange={(e) => set(t.key, e.target.checked)} />
                <span><strong>{t.label}</strong><small>{t.hint}</small></span>
              </label>
            ))}
          </div>
          <Slider label="Prompt context" min={500} max={8000} step={500} value={cfg.promptTokens}
            onChange={(v) => set('promptTokens', v)} format={(v) => `${v.toLocaleString('en-US')} tokens`} />
          <Slider label="Suggestion length" min={8} max={128} step={8} value={cfg.outputTokens}
            onChange={(v) => set('outputTokens', v)} format={(v) => `${v} tokens`} />
          <Slider label="Developer pause (deadline)" min={200} max={1500} step={50} value={cfg.pauseMs}
            onChange={(v) => set('pauseMs', v)} format={(v) => `${v} ms`} />
        </div>

        <div className="cla__stage">
          <div className={`cla__verdict ${inTime ? 'is-ok' : 'is-late'}`} role="status">
            <strong>{total.toLocaleString('en-US')} ms</strong>
            <span>{inTime ? 'Arrives while the developer is still paused' : `Late by ${(total - cfg.pauseMs).toLocaleString('en-US')} ms, so it is discarded`}</span>
          </div>
          <div className="cla__bar" aria-hidden>
            {segments.map((s) => (
              <span key={s.key} className={`cla__seg cla__seg--${s.key}`} style={{ width: `${(s.ms / scale) * 100}%` }} title={`${s.label}: ${s.ms} ms`} />
            ))}
            <i className="cla__deadline" style={{ left: `${(cfg.pauseMs / scale) * 100}%` }} />
          </div>
          <ul className="cla__legend">
            {segments.map((s) => (
              <li key={s.key}><i className={`cla__seg--${s.key}`} />{s.label}<span className="mono">{s.ms} ms</span></li>
            ))}
          </ul>
        </div>
      </div>
    </DemoFrame>
  )
}
