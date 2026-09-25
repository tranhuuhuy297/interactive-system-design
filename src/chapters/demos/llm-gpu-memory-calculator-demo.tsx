import { useState } from 'react'
import { Badge, DemoFrame, Segmented, Slider } from '../../components/ui'
import { BYTES, OVERHEAD, PRESETS, memory, type MemoryInput, type Precision } from './llm-memory-model'
import './llm-demos.css'

const INITIAL: MemoryInput = {
  ...PRESETS['70B-class'], weightPrecision: 'fp16', kvPrecision: 'fp16', context: 8192, batch: 32, gpuGb: 80, gpus: 4,
}

const fmt = (gb: number) => (gb >= 100 ? gb.toFixed(0) : gb >= 10 ? gb.toFixed(1) : gb.toFixed(2))

export function LlmGpuMemoryCalculatorDemo() {
  const [s, setS] = useState<MemoryInput>(INITIAL)
  const [preset, setPreset] = useState('70B-class')
  const set = <K extends keyof MemoryInput>(k: K) => (v: MemoryInput[K]) => setS((p) => ({ ...p, [k]: v }))
  const m = memory(s)
  const pct = (gb: number) => `${Math.min(100, (gb / Math.max(m.usableGb, m.needGb)) * 100)}%`

  return (
    <DemoFrame title="GPU memory: weights + KV cache" onReset={() => { setS(INITIAL); setPreset('70B-class') }}
      hint="Shapes follow public Llama 3 configs (grouped-query attention, 8 KV heads). Real engines differ in overhead.">
      <div className="llm-mem">
        <div className="demo-controls">
          <div>
            <span className="demo-label">Model shape</span>
            <Segmented label="Model preset" value={preset} options={Object.keys(PRESETS)}
              onChange={(k) => { setPreset(k); setS((p) => ({ ...p, ...PRESETS[k] })) }} />
          </div>
          <div>
            <span className="demo-label">Weight precision</span>
            <Segmented label="Weight precision" value={s.weightPrecision} options={Object.keys(BYTES) as Precision[]} onChange={set('weightPrecision')} />
          </div>
          <div>
            <span className="demo-label">KV cache precision</span>
            <Segmented label="KV cache precision" value={s.kvPrecision} options={['fp16', 'fp8'] as const} onChange={set('kvPrecision')} />
          </div>
          <Slider label="Context length (tokens)" min={1024} max={131072} step={1024} value={s.context} onChange={set('context')}
            format={(v) => `${(v / 1024).toFixed(0)}K`} />
          <Slider label="Concurrent sequences" min={1} max={256} value={s.batch} onChange={set('batch')} />
          <Slider label="GPUs (80 GB each)" min={1} max={16} value={s.gpus} onChange={set('gpus')} />
        </div>

        <div className="llm-mem__out">
          <div className="llm-mem__formula mono">
            KV/token = 2 × {s.layers} layers × {s.kvHeads} kv heads × {s.headDim} dim × {BYTES[s.kvPrecision]} B
            = <b>{m.kvPerTokenKb.toFixed(0)} KiB</b>
          </div>
          <dl className="llm-mem__grid">
            <div><dt>Weights</dt><dd>{fmt(m.weightsGb)} GB</dd></div>
            <div><dt>KV per sequence</dt><dd>{fmt(m.kvPerSeqGb)} GB</dd></div>
            <div><dt>KV for {s.batch} seqs</dt><dd>{fmt(m.kvTotalGb)} GB</dd></div>
            <div><dt>Usable ({Math.round((1 - OVERHEAD) * 100)}% of HBM)</dt><dd>{fmt(m.usableGb)} GB</dd></div>
          </dl>
          <div className="llm-mem__bar" role="img" aria-label={`Weights ${fmt(m.weightsGb)} GB plus KV ${fmt(m.kvTotalGb)} GB against ${fmt(m.usableGb)} GB usable`}>
            <span className="llm-mem__w" style={{ width: pct(m.weightsGb) }} />
            <span className="llm-mem__kv" style={{ width: pct(m.kvTotalGb) }} />
            <i style={{ left: pct(m.usableGb) }} />
          </div>
          <div className="llm-mem__legend"><span className="llm-mem__sw llm-mem__sw--w" /> weights <span className="llm-mem__sw llm-mem__sw--kv" /> KV cache <span className="llm-mem__cap" /> usable capacity</div>
          <div className="llm-mem__verdict" role="status">
            {m.fits ? <Badge tone="success">Fits on {s.gpus} GPU{s.gpus > 1 ? 's' : ''}</Badge> : <Badge tone="danger">Needs ≥ {m.minGpus} GPUs</Badge>}
            <span>
              {m.maxSeqs > 0
                ? <>At this context, the KV budget holds about <b>{m.maxSeqs}</b> concurrent sequences.</>
                : <>The weights alone exceed usable memory.</>}
            </span>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
