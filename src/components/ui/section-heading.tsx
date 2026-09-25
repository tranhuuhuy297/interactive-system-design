import type { ReactNode } from 'react'
import { Hash } from 'lucide-react'

/** Chapter section heading; the shell's "On this page" TOC picks up every H2 with an id. */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="section-h2">
      <a href={`#${id}`} className="section-h2__anchor" aria-hidden tabIndex={-1}
        onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }}>
        <Hash size={18} />
      </a>
      {children}
    </h2>
  )
}
