import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { H2 } from '../components/ui'
import { GLOSSARY, GLOSSARY_CATEGORIES } from '../data/glossary-data'
import { GlossEntryList } from './demos/gloss-entry-list'
import {
  GLOSSARY_FOCUS_EVENT, GLOSSARY_FOCUS_KEY, anchorId, filterGlossary, findEntry, groupByLetter,
} from './demos/gloss-helpers'
import './demos/gloss-glossary.css'

type Category = 'All' | (typeof GLOSSARY_CATEGORIES)[number]
interface Flash { term: string; n: number }

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

/** Term requested by the palette (sessionStorage) or a shared link (#/glossary?t=slug); consumed once. */
function readRequestedTerm(): string | null {
  let key: string | null = null
  try {
    key = sessionStorage.getItem(GLOSSARY_FOCUS_KEY)
    sessionStorage.removeItem(GLOSSARY_FOCUS_KEY)
  } catch { /* storage disabled */ }
  if (!key) key = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('t')
  return key ? findEntry(key)?.term ?? null : null
}

export default function GlossaryChapter() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('All')
  const [flash, setFlash] = useState<Flash | null>(() => {
    const term = readRequestedTerm()
    return term ? { term, n: 0 } : null
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const openedForTerm = useRef(flash !== null)

  const matches = useMemo(() => filterGlossary(query), [query])
  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const e of matches) c.set(e.category ?? '', (c.get(e.category ?? '') ?? 0) + 1)
    return c
  }, [matches])
  const visible = category === 'All' ? matches : matches.filter((e) => e.category === category)
  const present = useMemo(() => new Set(groupByLetter(visible).map(([l]) => l)), [visible])

  // Palette focus while the glossary is already open (no remount, no hashchange).
  useEffect(() => {
    const onFocus = (ev: Event) => {
      const term = findEntry((ev as CustomEvent<string>).detail ?? '')?.term
      if (!term) return
      try { sessionStorage.removeItem(GLOSSARY_FOCUS_KEY) } catch { /* ignore */ }
      setQuery('')
      setCategory('All')
      setFlash((f) => ({ term, n: (f?.n ?? 0) + 1 }))
    }
    window.addEventListener(GLOSSARY_FOCUS_EVENT, onFocus)
    return () => window.removeEventListener(GLOSSARY_FOCUS_EVENT, onFocus)
  }, [])

  // Scroll to the flashed entry once it is rendered, then fade the highlight.
  useEffect(() => {
    if (!flash) return
    const scroll = setTimeout(() => document.getElementById(anchorId(flash.term))?.scrollIntoView({ block: 'center' }), 80)
    const clear = setTimeout(() => setFlash(null), 2200)
    return () => { clearTimeout(scroll); clearTimeout(clear) }
  }, [flash])

  // Desktop only: phones would pop the keyboard over the page.
  useEffect(() => {
    if (!openedForTerm.current && window.matchMedia('(min-width: 900px) and (pointer: fine)').matches) inputRef.current?.focus({ preventScroll: true })
  }, [])

  const jump = (letter: string) =>
    document.getElementById(`gloss-letter-${letter === '#' ? 'num' : letter}`)?.scrollIntoView({ block: 'start' })

  const reset = () => { setQuery(''); setCategory('All'); inputRef.current?.focus() }

  return (
    <>
      <p>
        Every term the handbook relies on, in plain language: {GLOSSARY.length} entries across {GLOSSARY_CATEGORIES.length} categories.
        Each one links back to the chapters that explain it in context. Tip: <kbd>⌘</kbd><kbd>K</kbd> search finds glossary
        terms from anywhere.
      </p>

      <H2 id="terms">Browse and search</H2>
      <div className="gloss-toolbar">
        <label className="gloss-search">
          <Search size={16} aria-hidden />
          <input ref={inputRef} type="search" value={query} placeholder="Search terms, acronyms, or definitions…"
            aria-label="Search the glossary" onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery('') } }} />
          {query && <button className="gloss-search__clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
        </label>
        <div className="gloss-cats" role="group" aria-label="Filter by category">
          {(['All', ...GLOSSARY_CATEGORIES] as Category[]).map((c) => {
            const n = c === 'All' ? matches.length : counts.get(c) ?? 0
            return (
              <button key={c} className={`gloss-chip ${category === c ? 'is-active' : ''}`} aria-pressed={category === c}
                disabled={n === 0 && category !== c} onClick={() => setCategory(c)}>
                {c} <span className="gloss-chip__n">{n}</span>
              </button>
            )
          })}
        </div>
      </div>

      <nav className="gloss-az" aria-label="Jump to letter">
        {LETTERS.map((l) => (
          <button key={l} className="gloss-az__l" disabled={!present.has(l)} onClick={() => jump(l)} aria-label={`Jump to ${l === '#' ? 'numbers and symbols' : l}`}>{l}</button>
        ))}
      </nav>

      <p className="gloss-count" aria-live="polite">
        {visible.length === GLOSSARY.length ? `${visible.length} terms` : `${visible.length} of ${GLOSSARY.length} terms`}
      </p>

      {visible.length > 0 ? (
        <GlossEntryList entries={visible} flashTerm={flash?.term ?? null} />
      ) : (
        <div className="gloss-empty">
          <p>No terms match “{query}”{category !== 'All' && <> in {category}</>}.</p>
          <button className="btn btn--secondary btn--sm" onClick={reset}>Clear search and filters</button>
        </div>
      )}
    </>
  )
}
