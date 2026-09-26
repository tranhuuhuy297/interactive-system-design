/** SM-2-style spaced-repetition scheduler. Pure functions; `now` is epoch ms, days are local calendar days. */

export type Grade = 0 | 1 | 2 | 3 // Again, Hard, Good, Easy
export const GRADE_LABELS = ['Again', 'Hard', 'Good', 'Easy'] as const

export interface CardState {
  ease: number
  /** Review interval in days (0 while learning). */
  interval: number
  /** Successful reviews since the last lapse. */
  reps: number
  lapses: number
  /** Learning step index; -1 once graduated to review. */
  step: number
  due: number
  last: number
}

export interface ReviewLogEntry { id: string; grade: Grade; at: number; prev: CardState | null }

export interface SrsState {
  cards: Record<string, CardState>
  log: ReviewLogEntry[]
  /** Local day keys (YYYY-MM-DD) on which at least one review happened. */
  days: string[]
  /** New cards introduced per local day. */
  newByDay: Record<string, number>
}

export const EMPTY_SRS: SrsState = { cards: {}, log: [], days: [], newByDay: {} }

const MIN = 60_000
const DAY_MS = 86_400_000
/** Learning steps in minutes: 10 minutes, then 1 day. */
export const LEARNING_STEPS = [10, 1440]
const GRADUATE_DAYS = 3
const EASY_GRADUATE_DAYS = 4
const START_EASE = 2.5
const MIN_EASE = 1.3
const LOG_CAP = 500
export const MATURE_DAYS = 21

export const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
/** Local midnight `days` calendar days after `t` (DST-safe). */
export const addDays = (t: number, days: number) => { const d = new Date(startOfDay(t)); d.setDate(d.getDate() + days); return d.getTime() }

function graduate(base: CardState, days: number, now: number): CardState {
  return { ...base, step: -1, interval: days, reps: base.reps + 1, due: addDays(now, days), last: now }
}

/** Next state for a card after a grade. `prev` undefined means a brand-new card. */
export function schedule(prev: CardState | undefined, grade: Grade, now: number): CardState {
  const c: CardState = prev ?? { ease: START_EASE, interval: 0, reps: 0, lapses: 0, step: 0, due: now, last: now }

  if (c.step >= 0) {
    // Learning (new) or relearning (after a lapse) — relearning graduates back to a 1-day interval.
    const relearning = c.lapses > 0
    const passDays = relearning ? Math.max(1, c.interval) : GRADUATE_DAYS
    if (grade === 0) return { ...c, step: 0, due: now + LEARNING_STEPS[0] * MIN, last: now }
    if (grade === 1) return { ...c, due: now + LEARNING_STEPS[c.step] * MIN * (c.step === 0 ? 1.5 : 1), last: now }
    if (grade === 3) return graduate(c, relearning ? passDays + 1 : EASY_GRADUATE_DAYS, now)
    const next = c.step + 1
    if (next >= LEARNING_STEPS.length) return graduate(c, passDays, now)
    return { ...c, step: next, due: now + LEARNING_STEPS[next] * MIN, last: now }
  }

  // Review card.
  if (grade === 0) {
    return { ...c, lapses: c.lapses + 1, reps: 0, interval: 1, ease: Math.max(MIN_EASE, c.ease - 0.2), step: 0, due: now + LEARNING_STEPS[0] * MIN, last: now }
  }
  let ease = c.ease
  let days: number
  if (grade === 1) { ease = Math.max(MIN_EASE, ease - 0.15); days = Math.max(c.interval + 1, Math.round(c.interval * 1.2)) }
  else if (grade === 2) days = Math.max(c.interval + 1, Math.round(c.interval * ease))
  else { ease += 0.15; days = Math.max(c.interval + 2, Math.round(c.interval * ease * 1.3)) }
  return { ...c, ease, interval: days, reps: c.reps + 1, due: addDays(now, days), last: now }
}

/** Human label for how long until a card returns, e.g. "10m", "1d", "3.2mo". */
export function formatInterval(ms: number): string {
  const m = Math.max(1, Math.round(ms / MIN))
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.round(m / 60)}h`
  const d = ms / DAY_MS
  if (d < 30) return `${Math.round(d)}d`
  if (d < 365) return `${(d / 30).toFixed(1).replace(/\.0$/, '')}mo`
  return `${(d / 365).toFixed(1).replace(/\.0$/, '')}y`
}

export const previewInterval = (prev: CardState | undefined, grade: Grade, now: number) =>
  formatInterval(schedule(prev, grade, now).due - now)

/** Ids of studied cards due at or before `now`, soonest first. */
export function dueCards(state: SrsState, now: number): string[] {
  return Object.entries(state.cards).filter(([, c]) => c.due <= now).sort((a, b) => a[1].due - b[1].due).map(([id]) => id)
}

export function applyReview(state: SrsState, id: string, grade: Grade, now: number): SrsState {
  const prev = state.cards[id] ?? null
  const today = dayKey(now)
  return {
    cards: { ...state.cards, [id]: schedule(prev ?? undefined, grade, now) },
    log: [...state.log, { id, grade, at: now, prev }].slice(-LOG_CAP),
    days: state.days.includes(today) ? state.days : [...state.days, today],
    newByDay: prev ? state.newByDay : { ...state.newByDay, [today]: (state.newByDay[today] ?? 0) + 1 },
  }
}

/** Reverts the most recent review. */
export function undoLast(state: SrsState): SrsState {
  const last = state.log[state.log.length - 1]
  if (!last) return state
  const log = state.log.slice(0, -1)
  const cards = { ...state.cards }
  if (last.prev) cards[last.id] = last.prev
  else delete cards[last.id]
  const day = dayKey(last.at)
  const newByDay = { ...state.newByDay }
  if (!last.prev) newByDay[day] = Math.max(0, (newByDay[day] ?? 1) - 1)
  const days = log.some((e) => dayKey(e.at) === day) ? state.days : state.days.filter((d) => d !== day)
  return { cards, log, days, newByDay }
}

export function streak(days: string[], now: number): number {
  const set = new Set(days)
  // Today not reviewed yet doesn't break the streak until it's over.
  let cursor = set.has(dayKey(now)) ? now : addDays(now, -1)
  let n = 0
  while (set.has(dayKey(cursor))) { n += 1; cursor = addDays(cursor, -1) }
  return n
}

export interface SrsStats {
  dueNow: number
  dueToday: number
  dueTomorrow: number
  newAvailable: number
  newToday: number
  mature: number
  streak: number
  /** Share of review-card grades that weren't "Again", or null with too little data. */
  retention: number | null
}

export function stats(state: SrsState, deckIds: string[], now: number, newPerDay: number): SrsStats {
  const endToday = addDays(now, 1)
  const endTomorrow = addDays(now, 2)
  const cards = Object.values(state.cards)
  const newToday = state.newByDay[dayKey(now)] ?? 0
  const unseen = deckIds.filter((id) => !state.cards[id]).length
  const reviews = state.log.filter((e) => e.prev && e.prev.step === -1).slice(-200)
  return {
    dueNow: cards.filter((c) => c.due <= now).length,
    dueToday: cards.filter((c) => c.due < endToday).length,
    dueTomorrow: cards.filter((c) => c.due >= endToday && c.due < endTomorrow).length,
    newAvailable: Math.max(0, Math.min(unseen, newPerDay - newToday)),
    newToday,
    mature: cards.filter((c) => c.step === -1 && c.interval >= MATURE_DAYS).length,
    streak: streak(state.days, now),
    retention: reviews.length >= 10 ? reviews.filter((e) => e.grade > 0).length / reviews.length : null,
  }
}
