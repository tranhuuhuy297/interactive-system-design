import type { EpisodeStage } from '../../components/ui'
import { WHATSAPP_STAGES_EARLY } from './episode-whatsapp-stages-early'
import { WHATSAPP_STAGES_LATE } from './episode-whatsapp-stages-late'

/** All WhatsApp episode stages, in order (split across files to keep each readable). */
export const WHATSAPP_STAGES: EpisodeStage[] = [...WHATSAPP_STAGES_EARLY, ...WHATSAPP_STAGES_LATE]
