import { useCallback } from 'react'
import type { ChapterGroup } from '../data/chapters-registry'
import { EMPTY_SRS, applyReview, undoLast, type Grade, type SrsState } from './spaced-repetition'
import { useLocalStorageState } from './use-local-storage-state'

export type SrsSource = 'qb' | 'mm' | 'gl'

export interface SrsSettings {
  newPerDay: number
  maxPerSession: number
  sources: Record<SrsSource, boolean>
  track: ChapterGroup | 'All'
}

export const DEFAULT_SRS_SETTINGS: SrsSettings = {
  newPerDay: 15,
  maxPerSession: 50,
  sources: { qb: true, mm: true, gl: true },
  track: 'All',
}

interface Stored extends SrsState { v: 1; settings: SrsSettings }

const INITIAL: Stored = { v: 1, ...EMPTY_SRS, settings: DEFAULT_SRS_SETTINGS }

/** Review progress + settings in localStorage 'sdh:srs', shared by every component in the tab. */
export function useSpacedRepetition() {
  const [stored, setStored] = useLocalStorageState<Stored>('sdh:srs', INITIAL)
  // Merge defaults so older saves pick up new settings fields.
  const settings: SrsSettings = { ...DEFAULT_SRS_SETTINGS, ...stored.settings, sources: { ...DEFAULT_SRS_SETTINGS.sources, ...stored.settings?.sources } }
  const state: SrsState = { cards: stored.cards ?? {}, log: stored.log ?? [], days: stored.days ?? [], newByDay: stored.newByDay ?? {} }

  const grade = useCallback((id: string, g: Grade, now = Date.now()) =>
    setStored((prev) => ({ ...prev, ...applyReview(normalise(prev), id, g, now) })), [setStored])
  const undo = useCallback(() => setStored((prev) => ({ ...prev, ...undoLast(normalise(prev)) })), [setStored])
  const updateSettings = useCallback((patch: Partial<SrsSettings>) =>
    setStored((prev) => ({ ...prev, settings: { ...DEFAULT_SRS_SETTINGS, ...prev.settings, ...patch } })), [setStored])
  const reset = useCallback(() => setStored((prev) => ({ ...INITIAL, settings: prev.settings ?? DEFAULT_SRS_SETTINGS })), [setStored])

  return { state, settings, grade, undo, updateSettings, reset }
}

const normalise = (s: Stored): SrsState => ({ cards: s.cards ?? {}, log: s.log ?? [], days: s.days ?? [], newByDay: s.newByDay ?? {} })
