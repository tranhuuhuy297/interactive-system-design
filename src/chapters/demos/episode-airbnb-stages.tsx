import type { EpisodeStage } from '../../components/ui'
import { AIRBNB_STAGES_EARLY } from './episode-airbnb-stages-early'
import { AIRBNB_STAGES_LATE } from './episode-airbnb-stages-late'

export const AIRBNB_STAGES: EpisodeStage[] = [...AIRBNB_STAGES_EARLY, ...AIRBNB_STAGES_LATE]
