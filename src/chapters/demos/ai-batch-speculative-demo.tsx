import { useEffect, useRef, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { bestGamma, expectedTokens, seededRandom, simulateIteration, speedup } from './ai-batch-speculative-model'
import type { Iteration } from './ai-batch-speculative-model'
import './ai-batch-demos.css'

const MAX_G = 12
const W = 320
const H = 140

export function AiBatchSpeculativeDemo() {
  const [alpha, setAlpha] = useState(0.8)
  const [gamma, setGamma] = useState(4)
  const [c, setC] = useState(0.05)
  const [log, setLog] = useState<Iteration[]>([])
  const [stats, setStats] = useState({ iters: 0, tokens: 0 })
  const [auto, setAuto] = useState(false)
  const rnd = useRef(seededRandom(42))

  const step = () => {
    const it = simulateIteration(alpha, gamma, rnd.current)
    setLog((l) => [it, ...l].slice(0, 6))
    setStats((s) => ({ iters: s.iters + 1, tokens: s.tokens + it.emitted }))
  }
  const stepRef = useRef(step)
  useEffect(() => { stepRef.current = step })
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => stepRef.current(), 450)
    return () => clearInterval(t)
  }, [auto])

  const clearRun = () => { setLog([]); setStats({ iters: 0, tokens: 0 }) }
  const reset = () => { setAlpha(0.8); setGamma(4); setC(0.05); setAuto(false); clearRun(); rnd.current = seededRandom(42) }
  // Parameters changed: old samples no longer match the expectation shown.
  const change = (fn: (v: number) => void) => (v: number) => { fn(v); clearRun() }

  const exp = expectedTokens(alpha, gamma)
  const sp = speedup(alpha, gamma, c)
  const best = bestGamma(alpha, c, MAX_G)
  const curve = Array.from({ length: MAX_G }, (_, k) => speedup(alpha, k + 1, c))
  const yMax = Math.max(2, Math.ceil(Math.max(...curve)))
  const sx = (g: number) => ((g - 1) / (MAX_G - 1)) * W
  const sy = (v: number) => H - (v / yMax) * H
  const path = curve.map((v, k) => `${k ? 'L' : 'M'}${sx(k + 1).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')

  return (
    <DemoFrame title="Speculative decoding: draft, verify, accept" onReset={reset}
      hint="A small draft model guesses γ tokens; the target model verifies them in one pass. Assumes each token is accepted independently with probability α.">
      <div className="aisp">
        <div className="demo-controls">
          <Slider label="Acceptance rate α" min={0.3} max={0.95} step={0.05} value={alpha} onChange={change(setAlpha)} format={(v) => v.toFixed(2)} />
          <Slider label="Draft tokens per step γ" min={1} max={10} value={gamma} onChange={change(setGamma)} />
          <Slider label="Draft cost c (draft step ÷ target step)" min={0.01} max={0.3} step={0.01} value={c} onChange={setC} format={(v) => v.toFixed(2)} />
          <div className="aisp__stats">
            <div><span>Expected tokens / target call</span><strong>{exp.toFixed(2)}</strong></div>
            <div><span>Expected speedup</span><strong className={sp >= 1 ? 'aisp-ok' : 'aisp-bad'}>{sp.toFixed(2)}×</strong></div>
            <div><span>Best γ for this α, c</span><strong>{best}</strong></div>
            <div><span>Simulated tokens / call</span><strong>{stats.iters ? (stats.tokens / stats.iters).toFixed(2) : '—'}</strong><small>{stats.iters} runs</small></div>
          </div>
        </div>

        <div className="aisp__right">
          <svg viewBox={`-28 -10 ${W + 40} ${H + 32}`} className="aisp__plot" role="img" aria-label={`Speedup versus gamma; best gamma ${best}`}>
            <line x1={0} y1={sy(1)} x2={W} y2={sy(1)} className="aisp__base" />
            <text x={-6} y={sy(1) + 3} textAnchor="end" className="aisp__tick">1×</text>
            <text x={-6} y={sy(yMax) + 8} textAnchor="end" className="aisp__tick">{yMax}×</text>
            <path d={path} className="aisp__curve" />
            {curve.map((v, k) => (
              <circle key={k} cx={sx(k + 1)} cy={sy(v)} r={k + 1 === gamma ? 5 : 2.5}
                className={k + 1 === gamma ? 'aisp__dot is-cur' : k + 1 === best ? 'aisp__dot is-best' : 'aisp__dot'} />
            ))}
            <text x={W / 2} y={H + 18} textAnchor="middle" className="aisp__tick">γ (draft tokens) 1 → {MAX_G}</text>
          </svg>

          <div className="aisp__run">
            <div className="aisp__btns">
              <button className="btn btn--primary btn--sm" onClick={step}>Run one step</button>
              <button className="btn btn--secondary btn--sm" onClick={() => setAuto((a) => !a)} aria-pressed={auto}>{auto ? 'Pause' : 'Auto-run'}</button>
            </div>
            <ol className="aisp__log" aria-live="off">
              {log.length === 0 && <li className="aisp__empty">Run a step to see drafts get verified.</li>}
              {log.map((it, i) => (
                <li key={stats.iters - i}>
                  {Array.from({ length: gamma }, (_, k) => {
                    const d = it.drafts[k]
                    const cls = d === undefined ? 'is-skip' : d ? 'is-ok' : 'is-no'
                    return <i key={k} className={cls} title={d === undefined ? 'discarded' : d ? 'accepted' : 'rejected'} />
                  })}
                  <b title="token from target model">+1</b>
                  <span>{it.emitted} tokens</span>
                </li>
              ))}
            </ol>
            <p className="aisp__legend"><i className="is-ok" /> accepted <i className="is-no" /> rejected <i className="is-skip" /> discarded <b>+1</b> target’s own token</p>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
