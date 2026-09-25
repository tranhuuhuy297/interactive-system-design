import type { EpisodeStage } from '../../components/ui'
import { SPOTIFY_STAGES_EARLY } from './episode-spotify-stages-early'
import { SPOTIFY_STAGES_LATE } from './episode-spotify-stages-late'

export const SPOTIFY_STAGES: EpisodeStage[] = [...SPOTIFY_STAGES_EARLY, ...SPOTIFY_STAGES_LATE]
