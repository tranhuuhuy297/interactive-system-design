import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

interface TabsProps {
  items: { label: string; content: ReactNode }[]
  initial?: number
}

/** WAI-ARIA tabs with arrow-key navigation and automatic activation. */
export function Tabs({ items, initial = 0 }: TabsProps) {
  const [active, setActive] = useState(initial)
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent) => {
    const last = items.length - 1
    const next =
      e.key === 'ArrowRight' ? (active === last ? 0 : active + 1)
      : e.key === 'ArrowLeft' ? (active === 0 ? last : active - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (next == null) return
    e.preventDefault()
    setActive(next)
    refs.current[next]?.focus()
  }

  return (
    <div className="tabs">
      <div role="tablist" className="tabs__list" onKeyDown={onKey}>
        {items.map((it, i) => (
          <button key={it.label} ref={(el) => { refs.current[i] = el }} role="tab"
            id={`${base}-t${i}`} aria-controls={`${base}-p${i}`} aria-selected={i === active}
            tabIndex={i === active ? 0 : -1} className="tabs__tab" onClick={() => setActive(i)}>
            {it.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-p${active}`} aria-labelledby={`${base}-t${active}`} className="tabs__panel" key={active}>
        {items[active].content}
      </div>
    </div>
  )
}
