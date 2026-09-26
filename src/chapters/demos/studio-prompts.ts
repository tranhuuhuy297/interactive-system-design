import { PROMPTS_A } from './studio-prompts-a'
import { PROMPTS_B } from './studio-prompts-b'
import type { Design, StudioPrompt } from './studio-types'

export const PROMPTS: StudioPrompt[] = [...PROMPTS_A, ...PROMPTS_B]

export const promptById = (id: string) => PROMPTS.find((p) => p.id === id) ?? PROMPTS[0]

/** Every sketch starts with Clients on the left. */
export const starterDesign = (): Design => ({ nodes: [{ id: 'c', kind: 'client', x: 20, y: 260, units: 1 }], edges: [] })
