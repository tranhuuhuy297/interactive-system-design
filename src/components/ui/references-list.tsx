import { BookOpen, ExternalLink, FileText, Globe, Mic, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ReferenceKind = 'paper' | 'blog' | 'book' | 'docs' | 'talk' | 'rfc'

export interface Reference {
  title: string
  /** Author(s) or publisher, e.g. "Netflix Technology Blog" or "M. Kleppmann". */
  source: string
  year?: number
  /** Omit for print-only books. */
  url?: string
  kind: ReferenceKind
  /** What this source supports in the chapter. */
  note?: string
}

const ICONS: Record<ReferenceKind, LucideIcon> = {
  paper: ScrollText, blog: Globe, book: BookOpen, docs: FileText, talk: Mic, rfc: ScrollText,
}

/** Sources cited by a chapter; external links open in a new tab. */
export function References({ items }: { items: Reference[] }) {
  return (
    <ol className="refs">
      {items.map((r) => {
        const Icon = ICONS[r.kind]
        const title = r.url
          ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}<ExternalLink size={12} aria-hidden /></a>
          : <span>{r.title}</span>
        return (
          <li key={`${r.title}|${r.source}|${r.url ?? ''}`} className="refs__item">
            <Icon size={15} className="refs__icon" aria-label={r.kind} />
            <div>
              <div className="refs__title">{title}</div>
              <div className="refs__meta">{r.source}{r.year ? ` · ${r.year}` : ''}{r.note && <> · <em>{r.note}</em></>}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
