import { useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import { chapterById } from '../../data/chapters-registry'
import type { GlossaryEntry } from '../../data/glossary-data'
import { anchorId, groupByLetter, slugify } from './gloss-helpers'

interface GlossEntryListProps {
  entries: GlossaryEntry[]
  /** Term currently flashed after a deep link. */
  flashTerm: string | null
}

/** A–Z grouped glossary entries with chapter links and copy-link buttons. */
export function GlossEntryList({ entries, flashTerm }: GlossEntryListProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyLink = async (term: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/glossary?t=${slugify(term)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(term)
      setTimeout(() => setCopied((c) => (c === term ? null : c)), 1400)
    } catch {
      /* clipboard blocked: nothing useful to do */
    }
  }

  return (
    <div className="gloss-list">
      {groupByLetter(entries).map(([letter, list]) => (
        <section key={letter} className="gloss-group" id={`gloss-letter-${letter === '#' ? 'num' : letter}`} aria-label={`Terms starting with ${letter}`}>
          <h3 className="gloss-group__letter">{letter}</h3>
          <dl className="gloss-group__items">
            {list.map((e) => (
              <div key={e.term} id={anchorId(e.term)} className={`gloss-entry ${flashTerm === e.term ? 'is-flash' : ''}`}>
                <dt className="gloss-entry__head">
                  <span className="gloss-entry__term">{e.term}</span>
                  {e.category && <span className="gloss-entry__cat">{e.category}</span>}
                  <button className="gloss-entry__copy" onClick={() => copyLink(e.term)}
                    aria-label={copied === e.term ? `Link to ${e.term} copied` : `Copy link to ${e.term}`}>
                    {copied === e.term ? <Check size={13} /> : <Link2 size={13} />}
                  </button>
                </dt>
                <dd className="gloss-entry__def">
                  <p>{e.def}</p>
                  {e.aka && e.aka.length > 0 && <p className="gloss-entry__aka">Also: {e.aka.join(', ')}</p>}
                  {e.chapters.length > 0 && (
                    <p className="gloss-entry__links">
                      <span>Explained in</span>
                      {e.chapters.map((id) => {
                        const c = chapterById(id)
                        return c ? <a key={id} href={`#/${id}`}>{c.title}</a> : null
                      })}
                    </p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
