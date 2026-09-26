import type { MentalModelData } from './mental-model-types'
import { MENTAL_MODELS_AI_SYSTEMS } from './mental-models-ai-systems'
import { MENTAL_MODELS_CASES_A } from './mental-models-cases-a'
import { MENTAL_MODELS_CASES_B } from './mental-models-cases-b'
import { MENTAL_MODELS_EPISODES } from './mental-models-episodes'
import { MENTAL_MODELS_FOUNDATIONS_BLOCKS } from './mental-models-foundations-blocks'
import { MENTAL_MODELS_INTERVIEW } from './mental-models-interview'
import { MENTAL_MODELS_CASES_C } from './mental-models-cases-c'
import { MENTAL_MODELS_CASES_D } from './mental-models-cases-d'
import { MENTAL_MODELS_EPISODES_2 } from './mental-models-episodes-2'
import { MENTAL_MODELS_EPISODES_3 } from './mental-models-episodes-3'

export type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS: MentalModelData[] = [
  ...MENTAL_MODELS_FOUNDATIONS_BLOCKS, ...MENTAL_MODELS_CASES_A, ...MENTAL_MODELS_CASES_B,
  ...MENTAL_MODELS_EPISODES, ...MENTAL_MODELS_AI_SYSTEMS, ...MENTAL_MODELS_INTERVIEW,
  ...MENTAL_MODELS_CASES_C, ...MENTAL_MODELS_CASES_D, ...MENTAL_MODELS_EPISODES_2, ...MENTAL_MODELS_EPISODES_3,
]

export const mentalModelFor = (id: string) => MENTAL_MODELS.find((m) => m.id === id)
