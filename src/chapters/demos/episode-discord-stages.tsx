import type { EpisodeStage } from '../../components/ui'
import { DISCORD_STAGES_EARLY } from './episode-discord-stages-early'
import { DISCORD_STAGES_LATE } from './episode-discord-stages-late'

/** All Discord episode stages, in order (split across files to keep each readable). */
export const DISCORD_STAGES: EpisodeStage[] = [...DISCORD_STAGES_EARLY, ...DISCORD_STAGES_LATE]
