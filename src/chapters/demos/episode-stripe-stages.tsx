import type { EpisodeStage } from '../../components/ui'
import { STRIPE_STAGES_EARLY } from './episode-stripe-stages-early'
import { STRIPE_STAGES_LATE } from './episode-stripe-stages-late'

export const STRIPE_STAGES: EpisodeStage[] = [...STRIPE_STAGES_EARLY, ...STRIPE_STAGES_LATE]
