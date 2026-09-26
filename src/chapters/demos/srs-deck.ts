import { chapterById, type ChapterGroup } from '../../data/chapters-registry'
import { GLOSSARY, type GlossaryEntry } from '../../data/glossary-data'
import { MENTAL_MODELS, type MentalModelData } from '../../data/mental-models'
import { QUESTION_BANK, type BankQuestion, type QCategory } from '../../data/question-bank-data'
import type { SrsSettings, SrsSource } from '../../lib/use-spaced-repetition'

interface CardBase { id: string; groups: ChapterGroup[] }
export type SrsCard =
  | (CardBase & { source: 'qb'; question: BankQuestion })
  | (CardBase & { source: 'mm'; chapterId: string; title: string; model: MentalModelData })
  | (CardBase & { source: 'gl'; entry: GlossaryEntry })

export const SOURCE_LABELS: Record<SrsSource, string> = { qb: 'Interview questions', mm: 'Mental models', gl: 'Glossary terms' }

const CATEGORY_GROUP: Record<QCategory, ChapterGroup> = {
  'Estimation': 'Foundations', 'Networking & APIs': 'Foundations',
  'Load balancing': 'Building Blocks', 'Caching': 'Building Blocks', 'Databases': 'Building Blocks',
  'Consistency & Consensus': 'Building Blocks', 'Messaging': 'Building Blocks', 'Rate limiting & IDs': 'Building Blocks',
  'Reliability & Observability': 'Building Blocks', 'Trade-offs': 'Building Blocks',
  'Case follow-ups': 'Case Studies', 'AI Systems': 'AI Systems',
}

const slug = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** Every reviewable card, with ids stable across content edits. */
export function buildDeck(): SrsCard[] {
  const qb: SrsCard[] = QUESTION_BANK.map((q) => ({ id: `qb:${q.id}`, source: 'qb', groups: [CATEGORY_GROUP[q.category] ?? 'Building Blocks'], question: q }))
  const mm: SrsCard[] = MENTAL_MODELS.flatMap((m) => {
    const ch = chapterById(m.id)
    return ch ? [{ id: `mm:${m.id}`, source: 'mm' as const, groups: [ch.group], chapterId: m.id, title: ch.title, model: m }] : []
  })
  const seen = new Set<string>()
  const gl: SrsCard[] = GLOSSARY.flatMap((entry) => {
    const id = `gl:${slug(entry.term)}`
    if (seen.has(id)) return []
    seen.add(id)
    const groups = [...new Set(entry.chapters.map((c) => chapterById(c)?.group).filter((g): g is ChapterGroup => Boolean(g)))]
    return [{ id, source: 'gl' as const, groups: groups.length ? groups : ['Building Blocks'], entry }]
  })
  return [...qb, ...mm, ...gl]
}

/** Cards allowed by the current source and track settings. */
export const filterDeck = (deck: SrsCard[], s: SrsSettings) =>
  deck.filter((c) => s.sources[c.source] && (s.track === 'All' || c.groups.includes(s.track)))
