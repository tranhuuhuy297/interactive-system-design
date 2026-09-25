import { CHAPTERS } from '../data/chapters-registry'
import { useLocalStorageState } from './use-local-storage-state'

const KNOWN = new Set(CHAPTERS.map((c) => c.id))

/** Set of completed chapter ids, persisted locally. */
export function useProgress() {
  const [stored, setDone] = useLocalStorageState<string[]>('sdh:done', [])
  // Ignore ids of chapters that were renamed or removed.
  const done = stored.filter((id) => KNOWN.has(id))
  const isDone = (id: string) => done.includes(id)
  const toggle = (id: string) =>
    setDone((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const reset = () => setDone([])
  return { done, isDone, toggle, reset }
}
