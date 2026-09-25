import { useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { allocateContiguous, allocatePaged, sampleLengths } from './ai-kv-paging-model'
import type { AllocResult } from './ai-kv-paging-model'
import './ai-kv-demos.css'

const CAPACITY = 32_768 // tokens of KV the GPU can hold (illustrative)
const CELL = 64 // tokens per rendered cell

function Grid({ label, r }: { label: string; r: AllocResult }) {
  const reserved = r.usedTokens + r.wastedTokens
  return (
    <figure className="aikv__grid-wrap">
      <figcaption>
        <strong>{label}</strong>
        <span>{r.admitted} sequences · {Math.round((r.usedTokens / CAPACITY) * 100)}% holds real tokens · {reserved ? Math.round((r.wastedTokens / reserved) * 100) : 0}% of reserved is wasted</span>
      </figcaption>
      <div className="aikv__grid" role="img" aria-label={`${label}: ${r.admitted} sequences admitted`}>
        {r.cells.map((c, i) => (
          <i key={i} className={c.seq < 0 ? 'is-free' : c.waste ? 'is-waste' : ''}
            style={c.seq >= 0 ? { ['--h' as string]: (c.seq * 47) % 360 } : undefined} />
        ))}
      </div>
    </figure>
  )
}

export function AiKvPagingDemo() {
  const [maxLen, setMaxLen] = useState<'2048' | '4096' | '8192'>('4096')
  const [mean, setMean] = useState(700)
  const [spread, setSpread] = useState(0.6)
  const [block, setBlock] = useState<'16' | '64' | '256'>('16')
  const [seed, setSeed] = useState(7)

  const lengths = useMemo(() => sampleLengths(200, mean, spread, Number(maxLen), seed), [mean, spread, maxLen, seed])
  const contiguous = allocateContiguous(lengths, CAPACITY, Number(maxLen), CELL)
  const paged = allocatePaged(lengths, CAPACITY, Number(block), CELL)
  const gain = contiguous.admitted ? paged.admitted / contiguous.admitted : 0

  const reset = () => { setMaxLen('4096'); setMean(700); setSpread(0.6); setBlock('16'); setSeed(7) }

  return (
    <DemoFrame title="Contiguous reservation vs paged KV cache" onReset={reset}
      hint="Same GPU memory (32K tokens of KV), same request stream. Colored = real tokens, pale = reserved but empty. Toy allocator.">
      <div className="aikv">
        <div className="demo-controls">
          <Segmented label="Max context reserved per sequence" value={maxLen} onChange={setMaxLen} options={['2048', '4096', '8192'] as const} />
          <Slider label="Average actual length (tokens)" min={100} max={3000} step={50} value={mean} onChange={setMean} />
          <Slider label="Length spread" min={0} max={1} step={0.05} value={spread} onChange={setSpread} format={(v) => `±${Math.round(v * 100)}%`} />
          <Segmented label="Page (block) size, tokens" value={block} onChange={setBlock} options={['16', '64', '256'] as const} />
          <button className="btn btn--secondary btn--sm" onClick={() => setSeed((s) => s + 1)}>Resample requests</button>
          <div className="aikv__gain">
            <span>Concurrent sequences, paged vs contiguous</span>
            <strong>{gain ? `${gain.toFixed(1)}×` : '—'}</strong>
          </div>
        </div>
        <div className="aikv__grids">
          <Grid label="Contiguous (reserve max length)" r={contiguous} />
          <Grid label={`Paged (${block}-token blocks)`} r={paged} />
        </div>
      </div>
    </DemoFrame>
  )
}
