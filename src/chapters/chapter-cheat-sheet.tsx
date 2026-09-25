import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Callout, MentalModelView, Segmented } from '../components/ui'
import { CHAPTERS, GROUPS } from '../data/chapters-registry'
import { MENTAL_MODELS } from '../data/mental-models'
import './chapter-cheat-sheet.css'

type Filter = 'All' | (typeof GROUPS)[number]['name']

export default function CheatSheetChapter() {
  const [filter, setFilter] = useState<Filter>('All')
  const [quiz, setQuiz] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const groups = GROUPS.filter((g) => filter === 'All' || g.name === filter)
  const toggleReveal = (id: string) =>
    setRevealed((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  return (
    <>
      <p>
        One picture per chapter. Skim it the night before an interview, or switch on <strong>self-test</strong> to hide
        the words and recall each idea from its picture alone.
      </p>
      <div className="cs__bar">
        <Segmented label="Track" value={filter} onChange={setFilter}
          options={['All', ...GROUPS.filter((g) => MENTAL_MODELS.some((m) => CHAPTERS.find((c) => c.id === m.id)?.group === g.name)).map((g) => g.name)] as Filter[]} />
        <button className={`btn btn--sm ${quiz ? 'btn--primary' : 'btn--secondary'}`} onClick={() => { setQuiz(!quiz); setRevealed(new Set()) }} aria-pressed={quiz}>
          {quiz ? <EyeOff size={14} /> : <Eye size={14} />} Self-test {quiz ? 'on' : 'off'}
        </button>
      </div>
      {MENTAL_MODELS.length === 0 && <Callout kind="info">Mental models are being added.</Callout>}
      {groups.map((g) => {
        const items = CHAPTERS.filter((c) => c.group === g.name)
          .map((c) => ({ c, m: MENTAL_MODELS.find((m) => m.id === c.id) }))
          .filter((x) => x.m)
        if (!items.length) return null
        return (
          <section key={g.name} className="cs__group">
            <h3 style={{ ['--hue' as string]: g.hue }}>{g.name}</h3>
            <div className="cs__grid">
              {items.map(({ c, m }) => {
                const hidden = quiz && !revealed.has(c.id)
                return (
                  <article key={c.id} className={`cs__card ${hidden ? 'is-hidden' : ''}`}>
                    <a className="cs__title" href={`#/${c.id}`}>{c.title}</a>
                    <MentalModelView m={m!} compact />
                    {quiz && (
                      <button className="btn btn--ghost btn--sm cs__reveal" onClick={() => toggleReveal(c.id)}>
                        {hidden ? 'Reveal' : 'Hide'}
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </>
  )
}
