import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { PRESETS, TARGETS, loraParams, memoryGB, projShape, type Target } from './ai-ft-model'
import './ai-ft-demos.css'

const RANKS = ['4', '8', '16', '32', '64', '128'] as const
type Rank = (typeof RANKS)[number]

const fmtParams = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`)
const fmtGB = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(2)} TB` : `${g.toFixed(0)} GB`)

export function AiFtLoraCalculatorDemo() {
  const [modelIdx, setModelIdx] = useState(0)
  const [rank, setRank] = useState<Rank>('16')
  const [targets, setTargets] = useState<Target[]>(['q', 'k', 'v', 'o'])
  const [gpuGB, setGpuGB] = useState(80)
  const m = PRESETS[modelIdx]
  const trainable = loraParams(m, Number(rank), targets)
  const mem = memoryGB(m, trainable)
  const gpus = (gb: number) => Math.ceil(gb / gpuGB)

  const toggle = (t: Target) => setTargets((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  return (
    <DemoFrame title="LoRA calculator: trainable parameters and training memory"
      onReset={() => { setModelIdx(0); setRank('16'); setTargets(['q', 'k', 'v', 'o']); setGpuGB(80) }}
      hint="Each adapted matrix W (d_in × d_out) gets A (r × d_in) and B (d_out × r): r·(d_in + d_out) trainable parameters. Memory excludes activations, so treat it as a lower bound.">
      <div className="aift-lora">
        <div className="demo-controls">
          <Segmented label="Model" value={String(modelIdx)} onChange={(v) => setModelIdx(Number(v))}
            options={PRESETS.map((p, i) => ({ value: String(i), label: p.name }))} />
          <div>
            <div className="demo-label">Rank r</div>
            <Segmented label="LoRA rank" value={rank} onChange={setRank} options={RANKS} />
          </div>
          <div>
            <div className="demo-label">Adapted projections</div>
            <div className="aift-lora__targets" role="group" aria-label="Adapted projections">
              {TARGETS.map((t) => {
                const [i, o] = projShape(m, t)
                return (
                  <button key={t} className={`aift-lora__t ${targets.includes(t) ? 'is-on' : ''}`} aria-pressed={targets.includes(t)} onClick={() => toggle(t)}>
                    <b>{t}</b><small>{i}×{o}</small>
                  </button>
                )
              })}
            </div>
          </div>
          <Slider label="GPU memory" min={24} max={192} step={8} value={gpuGB} onChange={setGpuGB} format={(v) => `${v} GB`} />
        </div>

        <div className="aift-lora__out">
          <div className="aift-lora__big">
            <span>Trainable parameters</span>
            <strong>{fmtParams(trainable)}</strong>
            <small>{((trainable / m.totalParams) * 100).toFixed(3)}% of ~{fmtParams(m.totalParams)}</small>
          </div>
          <table className="aift-lora__mem">
            <thead><tr><th>Method</th><th>Memory</th><th>GPUs</th></tr></thead>
            <tbody>
              <tr><td>Full fine-tune (Adam, mixed precision)</td><td className="mono">{fmtGB(mem.full)}</td><td className="mono">{gpus(mem.full)}</td></tr>
              <tr><td>LoRA (bf16 frozen base)</td><td className="mono">{fmtGB(mem.lora)}</td><td className="mono">{gpus(mem.lora)}</td></tr>
              <tr><td>QLoRA (4-bit frozen base)</td><td className="mono">{fmtGB(mem.qlora)}</td><td className="mono">{gpus(mem.qlora)}</td></tr>
            </tbody>
          </table>
          <p className="aift-lora__note">Full fine-tuning ≈ 16 bytes/param (weights, gradients, fp32 master copy, two Adam moments). LoRA stores the base once and optimizer state only for adapters.</p>
        </div>
      </div>
    </DemoFrame>
  )
}
