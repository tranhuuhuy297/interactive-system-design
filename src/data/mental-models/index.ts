import type { MentalModelData } from './mental-model-types'
import { MENTAL_MODELS_AI_SYSTEMS } from './mental-models-ai-systems'
import { MENTAL_MODELS_CASES_A } from './mental-models-cases-a'
import { MENTAL_MODELS_CASES_B } from './mental-models-cases-b'
import { MENTAL_MODELS_EPISODES } from './mental-models-episodes'
import { MENTAL_MODELS_FOUNDATIONS_BLOCKS } from './mental-models-foundations-blocks'
import { MENTAL_MODELS_INTERVIEW } from './mental-models-interview'

export type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS: MentalModelData[] = [
  ...MENTAL_MODELS_FOUNDATIONS_BLOCKS, ...MENTAL_MODELS_CASES_A, ...MENTAL_MODELS_CASES_B,
  ...MENTAL_MODELS_EPISODES, ...MENTAL_MODELS_AI_SYSTEMS, ...MENTAL_MODELS_INTERVIEW,
]

export const mentalModelFor = (id: string) => MENTAL_MODELS.find((m) => m.id === id)
