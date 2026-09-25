import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { GPUS, MODELS, roofline } from './ai-infer-roofline-model'
import './ai-infer-demos.css'

const W = 360
const H = 200
const X_MIN = -1 // log10 FLOP/byte
const X_MAX = 4
const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d })

export function AiInferRooflineDemo() {
  const [gpuId, setGpuId] = useState('h100')
  const [gpus, setGpus] = useState<'1' | '2' | '4' | '8'>('1')
  const [modelId, setModelId] = useState('8b')
  const [prec, setPrec] = useState<'16-bit' | '8-bit'>('16-bit')
  const [batchExp, setBatchExp] = useState(0) // log2(batch)
  const [ctx, setCtx] = useState(4096)

  const gpu = GPUS.find((g) => g.id === gpuId) ?? GPUS[1]
  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0]
  const batch = 2 ** batchExp
  const r = roofline({ gpu, gpus: Number(gpus), model, weightBytes: prec === '8-bit' ? 1 : 2, batch, context: ctx, promptTokens: 1000 })

  const peakT = gpu.bf16Tflops * (prec === '8-bit' ? 2 : 1) * Number(gpus)
  const bwTB = gpu.bwTBs * Number(gpus)
  const yMax = Math.log10(peakT * 2)
  const yMin = yMax - 4
  const sx = (logI: number) => ((logI - X_MIN) / (X_MAX - X_MIN)) * W
  const sy = (logT: number) => H - ((logT - yMin) / (yMax - yMin)) * H
  const roof = Array.from({ length: 51 }, (_, k) => {
    const li = X_MIN + (k / 50) * (X_MAX - X_MIN)
    const t = Math.min(peakT, bwTB * 10 ** li) // TB/s × FLOP/B = TFLOPS
    return `${k ? 'L' : 'M'}${sx(li).toFixed(1)},${sy(Math.log10(t)).toFixed(1)}`
  }).join(' ')
  const achieved = (2 * model.paramsB * 1e9 * batch) / (r.stepMs / 1e3) / 1e12
  const px = sx(Math.min(X_MAX, Math.max(X_MIN, Math.log10(r.intensity))))
  const py = sy(Math.max(yMin, Math.log10(achieved)))

  const reset = () => { setGpuId('h100'); setGpus('1'); setModelId('8b'); setPrec('16-bit'); setBatchExp(0); setCtx(4096) }

  return (
    <DemoFrame title="Roofline: is this decode step memory- or compute-bound?" onReset={reset}
      hint="Spec-sheet peaks (dense), ideal scaling across GPUs, no comms or kernel overhead: a best-case lower bound on latency.">
      <div className="aiinf">
        <div className="demo-controls">
          <Segmented label="GPU" value={gpuId} onChange={setGpuId} options={GPUS.map((g) => ({ value: g.id, label: g.label }))} />
          <Segmented label="GPU count" value={gpus} onChange={setGpus} options={['1', '2', '4', '8'] as const} />
          <Segmented label="Model" value={modelId} onChange={setModelId} options={MODELS.map((m) => ({ value: m.id, label: m.label }))} />
          <Segmented label="Weight precision" value={prec} onChange={setPrec} options={['16-bit', '8-bit'] as const} />
          <Slider label="Batch size (concurrent sequences)" min={0} max={8} value={batchExp} onChange={setBatchExp} format={() => String(batch)} />
          <Slider label="Context per sequence (tokens)" min={512} max={32768} step={512} value={ctx} onChange={setCtx} format={(v) => fmt(v)} />
        </div>

        <div className="aiinf__out">
          <svg viewBox={`-34 -8 ${W + 44} ${H + 34}`} className="aiinf__plot" role="img"
            aria-label={`Roofline plot. Arithmetic intensity ${fmt(r.intensity, 1)} FLOP per byte; ${r.memoryBound ? 'memory-bound' : 'compute-bound'}.`}>
            <line x1={0} y1={H} x2={W} y2={H} className="aiinf__axis" />
            <line x1={0} y1={0} x2={0} y2={H} className="aiinf__axis" />
            {[0, 1, 2, 3, 4].map((d) => (
              <text key={d} x={sx(d - 1)} y={H + 14} textAnchor="middle" className="aiinf__tick">{10 ** (d - 1)}</text>
            ))}
            <text x={W / 2} y={H + 28} textAnchor="middle" className="aiinf__tick">arithmetic intensity (FLOP/byte, log)</text>
            <text x={-8} y={sy(Math.log10(peakT)) + 4} textAnchor="end" className="aiinf__tick">{fmt(peakT)}</text>
            <line x1={sx(Math.log10(r.ridge))} y1={0} x2={sx(Math.log10(r.ridge))} y2={H} className="aiinf__ridge" />
            <path d={roof} className="aiinf__roof" />
            <circle cx={px} cy={py} r={6} className={r.memoryBound ? 'aiinf__pt is-mem' : 'aiinf__pt'} />
          </svg>

          <div className="aiinf__stats">
            <div><span>Bound</span><strong className={r.memoryBound ? 'aiinf-warn' : 'aiinf-ok'}>{r.memoryBound ? 'Memory bandwidth' : 'Compute'}</strong></div>
            <div><span>Decode step</span><strong>{fmt(r.stepMs, 2)} ms</strong></div>
            <div><span>Per-user speed</span><strong>{fmt(r.perUserTokS)} tok/s</strong></div>
            <div><span>Aggregate</span><strong>{fmt(r.aggregateTokS)} tok/s</strong></div>
            <div><span>Weights + KV</span><strong className={r.fits ? '' : 'aiinf-bad'}>{fmt(r.weightGB)} + {fmt(r.kvGB, 1)} GB</strong></div>
            <div><span>Prefill 1K tokens</span><strong>{fmt(r.ttftMs, 1)} ms</strong></div>
          </div>
          {!r.fits && <p className="aiinf__note aiinf-bad" role="status">Doesn’t fit in {Number(gpus) * gpu.memGB} GB (90% usable). Add GPUs, quantize, or shrink batch × context.</p>}
          <p className="aiinf__note">Ridge point {fmt(r.ridge)} FLOP/byte. Decode at batch 1 does ~2 FLOPs per weight byte read, so it sits far left of the ridge.</p>
        </div>
      </div>
    </DemoFrame>
  )
}
