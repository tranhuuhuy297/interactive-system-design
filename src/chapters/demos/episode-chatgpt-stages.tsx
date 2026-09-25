import type { EpisodeStage } from '../../components/ui'
import { CHATGPT_STAGES_EARLY } from './episode-chatgpt-stages-early'
import { CHATGPT_STAGES_LATE } from './episode-chatgpt-stages-late'

export const CHATGPT_STAGES: EpisodeStage[] = [...CHATGPT_STAGES_EARLY, ...CHATGPT_STAGES_LATE]
