import type { EpisodeStage } from '../../components/ui'
import { INSTAGRAM_STAGES_EARLY } from './episode-instagram-stages-early'
import { INSTAGRAM_STAGES_LATE } from './episode-instagram-stages-late'

/** All Instagram episode stages, in order (split across files to keep each readable). */
export const INSTAGRAM_STAGES: EpisodeStage[] = [...INSTAGRAM_STAGES_EARLY, ...INSTAGRAM_STAGES_LATE]
