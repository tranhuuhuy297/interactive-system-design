import { useCallback, useMemo } from 'react'
import { useLocalStorageState } from '../../lib/use-local-storage-state'
import { sanitizeDesign } from './studio-design-ops'
import { PROMPTS, promptById, starterDesign } from './studio-prompts'
import type { Design } from './studio-types'

interface StudioStore {
  promptId: string
  designs: Record<string, Design>
}

/** Autosaved designs, one per prompt, in localStorage 'sdh:studio'. */
export function useStudioStore() {
  const [store, setStore] = useLocalStorageState<StudioStore>('sdh:studio', { promptId: PROMPTS[0].id, designs: {} })
  const prompt = promptById(store.promptId)
  const raw = store.designs?.[prompt.id]
  // Stored data may be stale or hand-edited; validate before use.
  const design = useMemo(() => (raw && sanitizeDesign(raw)) || starterDesign(), [raw])

  const edit = useCallback((fn: (d: Design) => Design) => {
    setStore((s) => {
      const id = promptById(s.promptId).id
      const cur = (s.designs?.[id] && sanitizeDesign(s.designs[id])) || starterDesign()
      return { ...s, designs: { ...s.designs, [id]: fn(cur) } }
    })
  }, [setStore])

  const setPrompt = useCallback((id: string) => setStore((s) => ({ ...s, promptId: id })), [setStore])

  return { prompt, design, edit, setPrompt }
}
