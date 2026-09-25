import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { planParallelism } from './ai-par-planner-model'
import './ai-par-demos.css'

const PRESETS = {
  '70b': { label: '70B dense', total: 70, active: 70 },
  '405b': { label: '405B dense', total: 405, active: 405 },
  mixtral: { label: '47B MoE (13B active)', total: 47, active: 13 },
  dsv3: { label: '671B MoE (37B active)', total: 671, active: 37 },
} as const
type PresetId = keyof typeof PRESETS
const PRECISION = { '16-bit': 2, '8-bit': 1, '4-bit': 0.5 } as const
type Prec = keyof typeof PRECISION

export function AiParPlannerDemo() {
  const [preset, setPreset] = useState<PresetId>('70b')
  const [prec, setPrec] = useState<Prec>('16-bit')
  const [gpuMem, setGpuMem] = useState<'80' | '141' | '192'>('80')
  const [reserve, setReserve] = useState(0.3)

  const m = PRESETS[preset]
  const p = planParallelism({ totalParamsB: m.total, activeParamsB: m.active, bytesPerWeight: PRECISION[prec], gpuMemGB: Number(gpuMem), gpusPerNode: 8, kvReserve: reserve })
  const reset = () => { setPreset('70b'); setPrec('16-bit'); setGpuMem('80'); setReserve(0.3) }

  return (
    <DemoFrame title="Parallelism planner: how many GPUs, and how to split?" onReset={reset}
      hint="Simplified: fits weights plus a KV reserve, keeps tensor parallelism inside an 8-GPU node, adds pipeline stages across nodes. Ignores activation peaks and comms time.">
      <div className="aipar">
        <div className="demo-controls">
          <Segmented label="Model" value={preset} onChange={setPreset} options={(Object.keys(PRESETS) as PresetId[]).map((k) => ({ value: k, label: PRESETS[k].label }))} />
          <Segmented label="Weight precision" value={prec} onChange={setPrec} options={Object.keys(PRECISION) as Prec[]} />
          <Segmented label="GPU memory (GB)" value={gpuMem} onChange={setGpuMem} options={['80', '141', '192'] as const} />
          <Slider label="Memory reserved for KV cache" min={0.1} max={0.6} step={0.05} value={reserve} onChange={setReserve} format={(v) => `${Math.round(v * 100)}%`} />
        </div>

        <div className="aipar__out">
          <div className="aipar__stats">
            <div><span>Weights</span><strong>{Math.round(p.weightsGB)} GB</strong></div>
            <div><span>Layout</span><strong>TP {p.tp} × PP {p.pp}</strong></div>
            <div><span>GPUs / replica</span><strong>{p.totalGpus}</strong></div>
            <div><span>KV room / GPU</span><strong>{Math.round(p.perGpuKvGB)} GB</strong></div>
          </div>
          <div className="aipar__nodes" aria-label={`${p.pp} node(s) of 8 GPUs`}>
            {Array.from({ length: p.pp }, (_, n) => (
              <div key={n} className="aipar__node">
                <span>Node {n + 1} · stage {n + 1}</span>
                <div className="aipar__gpus">
                  {Array.from({ length: 8 }, (_, g) => {
                    const used = g < p.tp
                    const w = used ? p.perGpuWeightsGB / Number(gpuMem) : 0
                    return (
                      <div key={g} className={used ? 'aipar__gpu is-used' : 'aipar__gpu'} title={used ? `${Math.round(p.perGpuWeightsGB)} GB weights` : 'idle'}>
                        <i style={{ height: `${Math.min(100, w * 100)}%` }} />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="aipar__legend"><i className="is-w" /> weights share of GPU memory · remaining space holds KV cache and activations</p>
          {p.warnings.length > 0 && <ul className="aipar__warn">{p.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
      </div>
    </DemoFrame>
  )
}
