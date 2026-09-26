import { ArrowUpRight, BookA, Brain, MessagesSquare } from 'lucide-react'
import { MentalModelView } from '../../components/ui'
import { chapterById } from '../../data/chapters-registry'
import { SOURCE_LABELS, type SrsCard } from './srs-deck'

const ICON = { qb: MessagesSquare, mm: Brain, gl: BookA } as const

/** Front (prompt) and, once revealed, back (answer) of one review card. */
export function SrsCardView({ card, revealed }: { card: SrsCard; revealed: boolean }) {
  const Icon = ICON[card.source]
  return (
    <article className={`srs-card srs-card--${card.source}`} aria-live="polite">
      <header className="srs-card__source"><Icon size={13} aria-hidden /> {SOURCE_LABELS[card.source]}</header>
      <Front card={card} revealed={revealed} />
      {revealed && <div className="srs-card__back"><Back card={card} /></div>}
    </article>
  )
}

function Front({ card, revealed }: { card: SrsCard; revealed: boolean }) {
  if (card.source === 'qb') {
    return <p className="srs-card__prompt">{card.question.q}</p>
  }
  if (card.source === 'gl') {
    return <p className="srs-card__prompt srs-card__prompt--term">{card.entry.term}<small>What does it mean, and when does it matter?</small></p>
  }
  return (
    <div>
      <p className="srs-card__prompt">{card.title}<small>What's the core idea behind this picture?</small></p>
      {/* Idea and hook stay hidden until reveal, so the picture has to carry the recall. */}
      <div className={revealed ? '' : 'srs-mm-front'}><MentalModelView m={card.model} compact /></div>
    </div>
  )
}

function Back({ card }: { card: SrsCard }) {
  if (card.source === 'qb') {
    const q = card.question
    return (
      <>
        <p className="srs-card__answer">{q.senior}</p>
        <div className="srs-card__label">What a staff answer adds</div>
        <ul className="srs-card__list">{q.staff.map((s) => <li key={s}>{s}</li>)}</ul>
        <a className="srs-card__link" href="#/questions">Open in the question bank <ArrowUpRight size={13} aria-hidden /></a>
      </>
    )
  }
  if (card.source === 'gl') {
    return (
      <>
        <p className="srs-card__answer">{card.entry.def}</p>
        {card.entry.chapters.length > 0 && (
          <div className="srs-card__links">
            {card.entry.chapters.map((id) => {
              const ch = chapterById(id)
              return ch ? <a key={id} className="srs-card__link" href={`#/${id}`}>{ch.title} <ArrowUpRight size={13} aria-hidden /></a> : null
            })}
          </div>
        )}
      </>
    )
  }
  return (
    <>
      {card.model.analogy && <p className="srs-card__answer"><strong>Like:</strong> {card.model.analogy}</p>}
      <a className="srs-card__link" href={`#/${card.chapterId}`}>Read the chapter <ArrowUpRight size={13} aria-hidden /></a>
    </>
  )
}
