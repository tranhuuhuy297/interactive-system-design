import { useMemo, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { SEED, buildTrie, walk, type QueryFreq } from './autocomplete-trie-model'
import './autocomplete-trie-explorer-demo.css'

export function AutocompleteTrieExplorerDemo() {
  const [entries, setEntries] = useState<QueryFreq[]>(SEED)
  const [prefix, setPrefix] = useState('we')
  const [k, setK] = useState(5)

  const { root, nodeCount } = useMemo(() => buildTrie(entries, k), [entries, k])
  const norm = prefix.toLowerCase()
  const path = walk(root, norm)
  const matched = path.length === norm.length
  const current = norm.length === 0 ? root : matched ? path.at(-1) : undefined
  const suggestions = current ? (norm.length === 0 ? [] : current.topK) : []
  const children = current ? [...current.children.keys()].sort() : []
  const maxFreq = Math.max(1, ...suggestions.map((s) => s.freq))

  // Stands in for the logging → aggregation → rebuild pipeline (hours in production, instant here).
  const submit = (q: string) => {
    const query = q.trim().toLowerCase()
    if (!query) return
    setEntries((prev) => prev.some((e) => e.q === query)
      ? prev.map((e) => (e.q === query ? { ...e, freq: e.freq + 150 } : e))
      : [...prev, { q: query, freq: 150 }])
  }

  const reset = () => { setEntries(SEED); setPrefix('we'); setK(5) }

  return (
    <DemoFrame title="Trie with cached top-k: type a prefix" onReset={reset}
      hint="Each node stores its best k completions, so a lookup walks only prefix-length nodes and never scans the subtree. Press Enter to 'search' and boost a query.">
      <div className="ac">
        <div className="demo-controls">
          <label className="ac__field">
            <span className="demo-label">Search box</span>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Type: we, tw, tes…"
              onKeyDown={(e) => { if (e.key === 'Enter') submit(prefix) }} spellCheck={false} autoComplete="off" />
          </label>
          <Slider label="k (suggestions cached per node)" min={3} max={8} value={k} onChange={setK} />
          <dl className="ac__stats">
            <div><dt>Trie nodes</dt><dd>{nodeCount}</dd></div>
            <div><dt>Nodes visited</dt><dd>{path.length}</dd></div>
            <div><dt>Brute force would scan</dt><dd>{entries.length} queries + sort</dd></div>
          </dl>
        </div>

        <div className="ac__stage">
          <div className="ac__path" aria-label="Trie path">
            <span className="ac__node is-root">root</span>
            {[...norm].map((ch, i) => (
              <span key={i} className={`ac__node ${i < path.length ? 'is-hit' : 'is-miss'}`}>{ch === ' ' ? '␣' : ch}</span>
            ))}
          </div>

          <ul className="ac__list" aria-label="Suggestions">
            {!matched && <li className="ac__empty">No node for “{norm}”, so no suggestions (a real system might fall back to fuzzy search).</li>}
            {matched && norm.length === 0 && <li className="ac__empty">Start typing to walk the trie.</li>}
            {suggestions.map((s) => (
              <li key={s.q}>
                <button onClick={() => { setPrefix(s.q); submit(s.q) }}>
                  <span><b>{s.q.slice(0, norm.length)}</b>{s.q.slice(norm.length)}</span>
                  <i style={{ width: `${(s.freq / maxFreq) * 100}%` }} />
                  <small className="mono">{s.freq}</small>
                </button>
              </li>
            ))}
          </ul>

          {children.length > 0 && norm.length > 0 && (
            <div className="ac__children">
              <span className="demo-label">Children of this node</span>
              <div>{children.map((c) => (
                <button key={c} className="ac__chip" onClick={() => setPrefix(norm + c)}>{norm}<b>{c === ' ' ? '␣' : c}</b></button>
              ))}</div>
            </div>
          )}
        </div>
      </div>
    </DemoFrame>
  )
}
