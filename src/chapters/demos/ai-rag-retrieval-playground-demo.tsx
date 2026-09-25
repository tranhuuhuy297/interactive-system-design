import { useMemo, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { CORPUS, PRESET_QUERIES, bm25, chunkCorpus, firstHit, rrf, vectorSearch, type Scored } from './ai-rag-retrieval-model'
import './ai-rag-demos.css'

const TITLE = Object.fromEntries(CORPUS.map((d) => [d.id, d.title]))
const TOP_K = 5

export function AiRagRetrievalPlaygroundDemo() {
  const [preset, setPreset] = useState(0)
  const [custom, setCustom] = useState('')
  const [size, setSize] = useState(20)
  const [overlap, setOverlap] = useState(0.25)

  const query = custom.trim() || PRESET_QUERIES[preset].q
  const expect = custom.trim() ? null : PRESET_QUERIES[preset].expect
  const chunks = useMemo(() => chunkCorpus(size, overlap), [size, overlap])
  const results = useMemo(() => {
    const lex = bm25(chunks, query)
    const vec = vectorSearch(chunks, query)
    return [
      { name: 'BM25 (lexical)', list: lex, fmt: (s: number) => s.toFixed(2) },
      { name: 'Embedding (toy)', list: vec, fmt: (s: number) => s.toFixed(2) },
      { name: 'Hybrid · RRF', list: rrf([lex, vec]), fmt: (s: number) => s.toFixed(4) },
    ]
  }, [chunks, query])

  const reset = () => { setPreset(0); setCustom(''); setSize(20); setOverlap(0.25) }

  return (
    <DemoFrame title="Retrieval playground: lexical vs embedding vs hybrid" onReset={reset}
      hint="Six short help-center docs, chunked live. The “embedding” is a stand-in that maps words to shared concepts; real neural embeddings do this far better, and also struggle with rare identifiers.">
      <div className="airag">
        <div className="airag__queries" role="group" aria-label="Preset queries">
          {PRESET_QUERIES.map((p, i) => (
            <button key={p.q} className={`airag__chip ${!custom && preset === i ? 'is-active' : ''}`}
              aria-pressed={!custom && preset === i} onClick={() => { setPreset(i); setCustom('') }}>“{p.q}”</button>
          ))}
          <input className="airag__input" value={custom} onChange={(e) => setCustom(e.target.value)}
            placeholder="…or type your own query" aria-label="Custom query" />
        </div>
        {!custom && <p className="airag__why">{PRESET_QUERIES[preset].why} <em>(Explanations assume the default chunking.)</em></p>}

        <div className="airag__controls">
          <Slider label="Chunk size" min={10} max={80} step={5} value={size} onChange={setSize} format={(v) => `${v} words`} />
          <Slider label="Overlap" min={0} max={0.5} step={0.05} value={overlap} onChange={setOverlap} format={(v) => `${Math.round(v * 100)}%`} />
          <div className="airag__count"><span>Chunks indexed</span><strong className="mono">{chunks.length}</strong></div>
        </div>

        <div className="airag__cols">
          {results.map((r) => <ResultColumn key={r.name} {...r} expect={expect} />)}
        </div>
      </div>
    </DemoFrame>
  )
}

function ResultColumn({ name, list, fmt, expect }: { name: string; list: Scored[]; fmt: (s: number) => string; expect: string | null }) {
  const hit = expect ? firstHit(list, expect, TOP_K) : null
  return (
    <section className="airag__col" aria-label={name}>
      <header>
        <strong>{name}</strong>
        {expect && <span className={`airag__hit ${hit === 1 ? 'is-good' : hit ? 'is-ok' : 'is-bad'}`}>{hit ? `answer at #${hit}` : `miss in top ${TOP_K}`}</span>}
      </header>
      {list.length === 0 && <p className="airag__none">No matches: nothing in the index scores above zero.</p>}
      <ol>
        {list.slice(0, TOP_K).map((s) => (
          <li key={s.chunk.id} className={expect && s.chunk.docId === expect ? 'is-relevant' : ''}>
            <div className="airag__row"><code>{s.chunk.id}</code><span>{TITLE[s.chunk.docId]}</span><b className="mono">{fmt(s.score)}</b></div>
            <p>{s.chunk.text.length > 110 ? `${s.chunk.text.slice(0, 110)}…` : s.chunk.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
