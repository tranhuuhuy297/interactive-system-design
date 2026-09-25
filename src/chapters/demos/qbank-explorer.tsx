import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button, DemoFrame, InterviewQuestion, Segmented } from '../../components/ui'
import { QUESTION_BANK, Q_CATEGORIES } from '../../data/question-bank-data'
import type { QCategory } from '../../data/question-bank-data'
import { useLocalStorageState } from '../../lib/use-local-storage-state'
import { QbankFlipDrill } from './qbank-flip-drill'
import './qbank.css'

export type QStatus = 'got' | 'review'
type Level = 'all' | 'senior' | 'staff'
type Mode = 'drill' | 'list'
type StatusFilter = 'all' | 'unseen' | 'review'

function shuffleIds(): string[] {
  const out = QUESTION_BANK.map((q) => q.id)
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}

export function QbankExplorer() {
  const [cats, setCats] = useState<QCategory[]>([])
  const [level, setLevel] = useState<Level>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('drill')
  const [order, setOrder] = useState<string[] | null>(null)
  const [status, setStatus] = useLocalStorageState<Record<string, QStatus>>('sdh:qbank', {})

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const list = QUESTION_BANK.filter((q) =>
      (!cats.length || cats.includes(q.category)) &&
      (level === 'all' || q.level === level) &&
      (statusFilter === 'all' || (statusFilter === 'unseen' ? !status[q.id] : status[q.id] === 'review')) &&
      words.every((w) => `${q.q} ${q.senior} ${q.staff.join(' ')} ${q.category}`.toLowerCase().includes(w)))
    if (!order) return list
    const rank = new Map(order.map((id, i) => [id, i]))
    return [...list].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    // status intentionally omitted: marking a card must not drop it from the deck mid-drill.
  }, [cats, level, statusFilter, query, order]) // eslint-disable-line react-hooks/exhaustive-deps

  const got = Object.values(status).filter((s) => s === 'got').length
  const review = Object.values(status).filter((s) => s === 'review').length
  const toggleCat = (c: QCategory) => setCats((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))
  const countFor = (c: QCategory) => QUESTION_BANK.filter((q) => q.category === c).length

  return (
    <DemoFrame title={`Question bank · ${QUESTION_BANK.length} questions`}
      onReset={() => { setCats([]); setLevel('all'); setStatusFilter('all'); setQuery(''); setOrder(null) }}>
      <div className="qb-stats">
        <div><strong>{QUESTION_BANK.length}</strong><span>total</span></div>
        <div className="is-got"><strong>{got}</strong><span>got it</span></div>
        <div className="is-review"><strong>{review}</strong><span>to review</span></div>
        <div><strong>{filtered.length}</strong><span>showing</span></div>
        <Button size="sm" variant="ghost" onClick={() => setStatus({})} disabled={!got && !review}>Clear marks</Button>
      </div>

      <label className="qb-search">
        <Search size={15} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions and answers…" aria-label="Search questions" />
      </label>

      <div className="qb-chips" role="group" aria-label="Filter by category">
        {Q_CATEGORIES.map((c) => (
          <button key={c} className={`qb-chip ${cats.includes(c) ? 'is-on' : ''}`} aria-pressed={cats.includes(c)} onClick={() => toggleCat(c)}>
            {c} <span>{countFor(c)}</span>
          </button>
        ))}
      </div>

      <div className="qb-toolbar">
        <Segmented label="Level" options={['all', 'senior', 'staff'] as const} value={level} onChange={setLevel} />
        <Segmented label="Status" options={[{ value: 'all', label: 'All' }, { value: 'unseen', label: 'Unseen' }, { value: 'review', label: 'Review' }] as { value: StatusFilter; label: string }[]}
          value={statusFilter} onChange={setStatusFilter} />
        <Segmented label="Mode" options={[{ value: 'drill', label: 'Flashcards' }, { value: 'list', label: 'List' }] as { value: Mode; label: string }[]}
          value={mode} onChange={setMode} />
      </div>

      {mode === 'drill' ? (
        <QbankFlipDrill key={`${cats.join()}|${level}|${statusFilter}|${query}|${order?.[0] ?? ''}`}
          questions={filtered} status={status} onShuffle={() => setOrder(shuffleIds())}
          onMark={(id, s) => setStatus((prev) => ({ ...prev, [id]: s }))} />
      ) : (
        <div className="qb-list">
          {filtered.length === 0 && <p className="qb-empty">No questions match these filters.</p>}
          {filtered.map((q) => (
            <InterviewQuestion key={q.id} q={q.q} followUps={q.followUps}
              senior={<p>{q.senior}</p>} staff={<ul>{q.staff.map((s) => <li key={s}>{s}</li>)}</ul>} />
          ))}
        </div>
      )}
    </DemoFrame>
  )
}
