import { useMemo, useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import { DOCS, analyze, buildIndex, runQuery } from './seng-index-model'
import './seng-demos.css'

const SAMPLES = ['cache database', 'index segments', 'database replicas', 'search engine index']

/** Build an inverted index over six documents, then evaluate AND/OR queries and rank with BM25. */
export function SengIndexExplorerDemo() {
  const index = useMemo(() => buildIndex(DOCS), [])
  const [q, setQ] = useState('cache database')
  const [mode, setMode] = useState<'AND' | 'OR'>('AND')
  const [docId, setDocId] = useState(3)
  const res = runQuery(index, q, mode)
  const doc = DOCS.find((d) => d.id === docId)!
  const tokens = analyze(`${doc.title} ${doc.text}`)
  const maxScore = Math.max(0.001, ...res.ranked.map((r) => r.score))

  return (
    <DemoFrame title="Inverted index: from text to ranked results" onReset={() => { setQ('cache database'); setMode('AND'); setDocId(3) }}
      hint="Pick a document to see how it is analyzed, then type a query. Terms are looked up in the index, never by scanning documents.">
      <div className="seng-ix">
        <section>
          <div className="demo-label">1 · Analyze a document</div>
          <div className="seng-ix__docs" role="radiogroup" aria-label="Document">
            {DOCS.map((d) => (
              <button key={d.id} role="radio" aria-checked={d.id === docId} className={`seng-ix__doc ${d.id === docId ? 'is-on' : ''}`} onClick={() => setDocId(d.id)}>
                <span className="mono">d{d.id}</span> {d.title}
              </button>
            ))}
          </div>
          <p className="seng-ix__raw">{doc.text}</p>
          <div className="seng-ix__tokens">
            {tokens.map((t, i) => <span key={i} className={`seng-chip ${res.terms.includes(t) ? 'is-hit' : ''}`}>{t}</span>)}
          </div>
          <p className="seng-small">Lowercased, stop words dropped, plurals trimmed. The same analyzer runs on queries.</p>
        </section>

        <section>
          <div className="demo-label">2 · Query the index</div>
          <div className="seng-ix__query">
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search query" spellCheck={false} />
            <Segmented label="Boolean mode" value={mode} onChange={setMode} options={['AND', 'OR'] as const} />
          </div>
          <div className="seng-ix__samples">
            {SAMPLES.map((s) => <button key={s} className="seng-link" onClick={() => setQ(s)}>{s}</button>)}
          </div>
          <div className="seng-ix__postings">
            {res.terms.length === 0 && <p className="seng-small">Type a query.</p>}
            {res.terms.map((t) => {
              const list = index.postings.get(t) ?? []
              return (
                <div key={t} className="seng-ix__plist">
                  <code>{t}</code>
                  <span className="seng-small">df={list.length}</span>
                  <div>{list.length ? list.map((p) => <span key={p.doc} className={`seng-chip ${res.matched.includes(p.doc) ? 'is-hit' : ''}`}>d{p.doc}·tf{p.tf}</span>) : <em className="seng-small">not in index</em>}</div>
                </div>
              )
            })}
          </div>
          <p className="seng-small">
            {mode === 'AND' ? `Intersection took ${res.steps} comparison${res.steps === 1 ? '' : 's'} (shortest list first).` : `Union read ${res.steps} postings.`}
          </p>
        </section>

        <section className="seng-ix__results">
          <div className="demo-label">3 · Rank matches with BM25 (k1 = 1.2, b = 0.75)</div>
          {res.ranked.length === 0 && <p className="seng-small">No document matches all terms.</p>}
          <ol>
            {res.ranked.map((r) => (
              <li key={r.doc}>
                <span className="mono">d{r.doc}</span>
                <span className="seng-ix__title">{DOCS.find((d) => d.id === r.doc)!.title}</span>
                <span className="seng-ix__bar" style={{ ['--w' as string]: `${(r.score / maxScore) * 100}%` }} aria-hidden />
                <span className="mono">{r.score.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </DemoFrame>
  )
}
