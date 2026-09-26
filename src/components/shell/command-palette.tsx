import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BookA, CornerDownLeft, Home, Moon, RotateCcw, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CHAPTERS } from '../../data/chapters-registry'
import { requestGlossaryFocus } from '../../chapters/demos/gloss-focus'
import type { GlossaryEntry } from '../../data/glossary-data'
import { navigate } from '../../lib/use-hash-route'

type RankTerms = (query: string, limit?: number) => GlossaryEntry[]

interface Item {
  id: string
  label: string
  /** Muted text after the label, e.g. a glossary definition preview. */
  detail?: string
  hint: string
  icon: LucideIcon
  haystack: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onToggleTheme: () => void
  onResetProgress: () => void
}

/** Wrapper keeps AnimatePresence mounted; the dialog body remounts per open, so its state starts fresh. */
export function CommandPalette({ open, ...rest }: CommandPaletteProps) {
  return <AnimatePresence>{open && <PaletteDialog {...rest} />}</AnimatePresence>
}

function PaletteDialog({ onClose, onToggleTheme, onResetProgress }: Omit<CommandPaletteProps, 'open'>) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const [rankTerms, setRankTerms] = useState<RankTerms | null>(null)

  // Glossary index loads on first open so the ~330-term dataset stays out of the initial bundle.
  useEffect(() => {
    let alive = true
    import('../../chapters/demos/gloss-helpers').then((m) => { if (alive) setRankTerms(() => m.rankTermMatches) })
    return () => { alive = false }
  }, [])

  // Return focus to whatever opened the palette.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    return () => prev?.focus?.()
  }, [])

  const items = useMemo<Item[]>(() => [
    ...CHAPTERS.map((c) => ({
      id: c.id, label: c.title, hint: c.group, icon: c.icon,
      haystack: `${c.title} ${c.blurb} ${c.keywords.join(' ')} ${c.group}`.toLowerCase(),
      run: () => navigate(c.id),
    })),
    { id: 'home', label: 'Go to overview', hint: 'Action', icon: Home, haystack: 'home overview start', run: () => navigate('') },
    { id: 'theme', label: 'Toggle light / dark theme', hint: 'Action', icon: Moon, haystack: 'theme dark light mode', run: onToggleTheme },
    { id: 'reset', label: 'Reset reading progress', hint: 'Action', icon: RotateCcw, haystack: 'reset progress clear', run: onResetProgress },
  ], [onToggleTheme, onResetProgress])

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return items
    const hits = items.filter((it) => words.every((w) => it.haystack.includes(w)))
    const terms: Item[] = (rankTerms?.(query, 6) ?? []).map((e) => ({
      id: `g-${e.term}`, label: e.term, hint: 'Glossary', icon: BookA, haystack: '',
      detail: e.def.length > 72 ? `${e.def.slice(0, 70).trimEnd()}…` : e.def,
      run: () => requestGlossaryFocus(e.term),
    }))
    // Chapters first, then glossary terms, then actions.
    const isAction = (it: Item) => it.hint === 'Action'
    return [...hits.filter((it) => !isAction(it)), ...terms, ...hits.filter(isAction)]
  }, [items, query, rankTerms])

  const moveTo = (i: number) => {
    setActive(i)
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  const choose = (it?: Item) => { if (!it) return; it.run(); onClose() }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveTo(Math.min(results.length - 1, active + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveTo(Math.max(0, active - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'Tab') e.preventDefault() // the input is the only focus stop; keep focus inside the dialog
  }

  return (
    <motion.div className="palette-backdrop" onMouseDown={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <motion.div className="palette" role="dialog" aria-modal="true" aria-label="Search"
        onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}
        initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -6 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
        <div className="palette__search">
          <Search size={18} aria-hidden />
          <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            placeholder="Search chapters, glossary terms, actions…" role="combobox" aria-expanded="true" aria-label="Search"
            aria-controls="palette-list" aria-activedescendant={results[active] ? `pal-${results[active].id.replace(/[^\w-]/g, '_')}` : undefined} />
          <kbd>esc</kbd>
        </div>
        <ul className="palette__list" id="palette-list" role="listbox" ref={listRef}>
          {results.length === 0 && <li className="palette__empty">No matches for “{query}”</li>}
          {results.map((it, i) => {
            const Icon = it.icon
            return (
              <li key={it.id} id={`pal-${it.id.replace(/[^\w-]/g, '_')}`} data-idx={i} role="option" aria-selected={i === active}
                className={`palette__item ${i === active ? 'is-active' : ''}`}
                onMouseMove={() => { if (i !== active) setActive(i) }} onClick={() => choose(it)}>
                <Icon size={16} className="palette__icon" aria-hidden />
                <span className="palette__label">{it.label}{it.detail && <span className="muted"> — {it.detail}</span>}</span>
                <span className="palette__hint">{it.hint}</span>
                {i === active && <CornerDownLeft size={14} className="palette__enter" aria-hidden />}
              </li>
            )
          })}
        </ul>
        <div className="palette__foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span></div>
      </motion.div>
    </motion.div>
  )
}
