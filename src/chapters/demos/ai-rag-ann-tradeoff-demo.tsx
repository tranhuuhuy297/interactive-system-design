import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import './ai-rag-demos.css'

type Index = 'flat' | 'hnsw' | 'ivfpq'
const DIMS = ['384', '768', '1536'] as const
type Dim = (typeof DIMS)[number]

const HNSW_M = 16 // neighbors per node on upper layers; layer 0 keeps 2·M

// Memory math follows the index layouts; recall/latency curves are illustrative shapes, not benchmarks.
function estimate(index: Index, n: number, d: number, knob: number) {
  const fp32 = n * d * 4
  if (index === 'flat') return { recall: 1, latencyMs: (n * d) / 2e7, bytes: fp32 }
  if (index === 'hnsw') {
    const links = n * 2 * HNSW_M * 4 * 1.1 // layer-0 links plus ~10% for upper layers
    return { recall: 1 - 0.35 * Math.exp(-knob / 45), latencyMs: 0.02 * (knob / 10) * Math.log10(n), bytes: fp32 + links }
  }
  const m = d / 8 // one byte per sub-quantizer, 8 dims each
  return { recall: 0.92 * (1 - Math.exp(-knob / 10)), latencyMs: 0.004 * knob * Math.sqrt(n / 1e6), bytes: n * (m + 8) }
}

const fmtBytes = (b: number) => (b >= 1e12 ? `${(b / 1e12).toFixed(1)} TB` : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(0)} MB`)
const fmtN = (n: number) => (n >= 1e9 ? `${n / 1e9}B` : `${n / 1e6}M`)

export function AiRagAnnTradeoffDemo() {
  const [index, setIndex] = useState<Index>('hnsw')
  const [logN, setLogN] = useState(7)
  const [dim, setDim] = useState<Dim>('768')
  const [ef, setEf] = useState(64)
  const [nprobe, setNprobe] = useState(16)
  const n = 10 ** logN
  const knob = index === 'hnsw' ? ef : nprobe
  const e = estimate(index, n, Number(dim), knob)

  return (
    <DemoFrame title="Vector index trade-offs: recall vs latency vs memory"
      onReset={() => { setIndex('hnsw'); setLogN(7); setDim('768'); setEf(64); setNprobe(16) }}
      hint="Memory follows the index layout (fp32 vectors, HNSW links, 1-byte PQ codes). Recall and latency curves are illustrative shapes; measure your own data.">
      <div className="aiann">
        <div className="aiann__controls">
          <Segmented label="Index type" value={index} onChange={setIndex}
            options={[{ value: 'flat', label: 'Flat (exact)' }, { value: 'hnsw', label: 'HNSW' }, { value: 'ivfpq', label: 'IVF-PQ' }]} />
          {index === 'hnsw' && <Slider label="efSearch (candidate list size)" min={10} max={400} step={2} value={ef} onChange={setEf} />}
          {index === 'ivfpq' && <Slider label="nprobe (clusters scanned)" min={1} max={128} value={nprobe} onChange={setNprobe} />}
          {index === 'flat' && <p className="aiann__note">Brute force compares the query with every vector: perfect recall, cost grows linearly with N.</p>}
        </div>
        <div className="aiann__controls">
          <Segmented label="Embedding dimensions" value={dim} onChange={setDim} options={DIMS} />
          <Slider label="Vectors indexed" min={6} max={9} step={0.5} value={logN} onChange={setLogN} format={() => fmtN(Math.round(n / 1e6) * 1e6)} />
        </div>
        <div className="aiann__stats">
          <div className="aiann__stat"><span>Recall@10</span><strong>{(e.recall * 100).toFixed(1)}%</strong>
            <div className="aiann__meter"><i style={{ width: `${e.recall * 100}%` }} /></div></div>
          <div className="aiann__stat"><span>Query latency</span><strong>{e.latencyMs < 1 ? `${e.latencyMs.toFixed(2)} ms` : `${Math.round(e.latencyMs).toLocaleString('en-US')} ms`}</strong><small>single node, illustrative</small></div>
          <div className="aiann__stat"><span>Index memory</span><strong>{fmtBytes(e.bytes)}</strong><small>{index === 'ivfpq' ? 'codes only; keep originals for rerank' : 'fp32 vectors included'}</small></div>
          <div className="aiann__stat"><span>Fits in</span><strong>{e.bytes < 256e9 ? 'one big box' : 'a sharded cluster'}</strong><small>vs ~256 GB RAM</small></div>
        </div>
        <p className="aiann__note">
          HNSW buys high recall with RAM (full vectors plus graph links). IVF-PQ compresses each vector to a few dozen bytes
          and caps recall through quantization error; systems usually re-score the top candidates with full-precision vectors.
          Raising efSearch or nprobe trades latency for recall on a single knob.
        </p>
      </div>
    </DemoFrame>
  )
}
