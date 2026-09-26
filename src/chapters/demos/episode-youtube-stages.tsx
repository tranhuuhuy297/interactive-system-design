import type { EpisodeStage } from '../../components/ui'
import { YOUTUBE_EARLY } from './episode-youtube-stages-early'
import { YOUTUBE_LATE } from './episode-youtube-stages-late'

/** Thirteen chronological stages, 2005 → custom video chips. */
export const YOUTUBE_STAGES: EpisodeStage[] = [...YOUTUBE_EARLY, ...YOUTUBE_LATE]
