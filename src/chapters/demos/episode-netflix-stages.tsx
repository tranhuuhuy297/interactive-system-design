import type { EpisodeStage } from '../../components/ui'
import { NETFLIX_EARLY } from './episode-netflix-stages-early'
import { NETFLIX_LATE } from './episode-netflix-stages-late'

/** Fourteen chronological stages, 2007 → live events. */
export const NETFLIX_STAGES: EpisodeStage[] = [...NETFLIX_EARLY, ...NETFLIX_LATE]
