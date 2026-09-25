import type { EpisodeStage } from '../../components/ui'
import { AMAZON_STAGES_EARLY } from './episode-amazon-stages-early'
import { AMAZON_STAGES_LATE } from './episode-amazon-stages-late'

export const AMAZON_STAGES: EpisodeStage[] = [...AMAZON_STAGES_EARLY, ...AMAZON_STAGES_LATE]
