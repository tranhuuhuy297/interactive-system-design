import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { QUERIES, RELEVANT, USERS, retrieve, type FilterMode } from './ai-case-rag-acl-model'
import './ai-case-rag-demos.css'

const MODES: { value: FilterMode; label: string }[] = [
  { value: 'pre', label: 'Filter before ranking' },
  { value: 'post', label: 'Filter after top-k' },
  { value: 'none', label: 'No ACL filter' },
]

export function AiCaseRagAclDemo() {
  const [mode, setMode] = useState<FilterMode>('post')
  const [queryId, setQueryId] = useState(QUERIES[0].id)
  const [k, setK] = useState(3)
  const reset = () => { setMode('post'); setQueryId(QUERIES[0].id); setK(3) }

  return (
    <DemoFrame title="Same question, four employees: where does the permission check run?" onReset={reset}
      hint="Each row is what one person's assistant would put in the model's context. Red rows are documents that person is not allowed to read.">
      <div className="acl__controls">
        <Segmented label="Filter placement" options={MODES} value={mode} onChange={setMode} />
        <Segmented label="Query" value={queryId} onChange={setQueryId}
          options={QUERIES.map((q) => ({ value: q.id, label: q.id === 'rev' ? 'Revenue forecast' : 'Restart payments' }))} />
        <div className="acl__k"><Slider label="Top-k passages" min={2} max={5} value={k} onChange={setK} /></div>
      </div>
      <p className="acl__query">“{QUERIES.find((q) => q.id === queryId)?.text}”</p>

      <div className="acl__grid">
        {USERS.map((u) => {
          const r = retrieve(u, queryId, k, mode)
          return (
            <section key={u.id} className="acl__user" aria-label={u.name}>
              <header>
                <strong>{u.name}</strong>
                <span className="acl__groups">{u.groups.filter((g) => g !== 'all').join(', ') || 'all staff'}</span>
              </header>
              <ol className="acl__list">
                {r.shown.length === 0 && <li className="acl__empty">Nothing survives the filter</li>}
                {r.shown.map(({ doc, allowed }) => (
                  <li key={doc.id} className={allowed ? '' : 'is-leak'}>
                    <span className="acl__title">{doc.title}</span>
                    <span className="acl__score mono">{doc.score[queryId].toFixed(2)}</span>
                    {!allowed && <em>leak</em>}
                    {allowed && doc.score[queryId] < RELEVANT && <i>weak</i>}
                  </li>
                ))}
              </ol>
              <footer className="acl__stats">
                <span className={r.leaked ? 'is-bad' : ''}>Leaked {r.leaked}</span>
                <span className={r.recall < 1 ? 'is-warn' : ''}>Recall {Math.round(r.recall * 100)}%</span>
                {mode === 'post' && <span>Dropped {r.dropped}</span>}
              </footer>
            </section>
          )
        })}
      </div>
      <p className="acl__note">
        {mode === 'pre' && 'Correct and complete: the index filters by the user’s groups first, then ranks what remains.'}
        {mode === 'post' && 'No leaks, but restricted documents crowd out the top-k and are then thrown away, so most people get worse answers.'}
        {mode === 'none' && 'The model sees documents the user may not open, and it will happily quote them. This is a data breach.'}
      </p>
    </DemoFrame>
  )
}
