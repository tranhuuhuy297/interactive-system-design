import type { EpisodeStage } from '../../components/ui'
import { FIGMA_STAGES_EARLY } from './episode-figma-stages-early'
import { FIGMA_STAGES_LATE } from './episode-figma-stages-late'

/** All Figma episode stages, in order (split across files to keep each readable). */
export const FIGMA_STAGES: EpisodeStage[] = [...FIGMA_STAGES_EARLY, ...FIGMA_STAGES_LATE]
