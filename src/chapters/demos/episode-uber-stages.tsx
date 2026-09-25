import type { EpisodeStage } from '../../components/ui'
import { UBER_STAGES_EARLY } from './episode-uber-stages-early'
import { UBER_STAGES_LATE } from './episode-uber-stages-late'

const [hexagons, tracing, ...rest] = UBER_STAGES_LATE

// Chronological order: tracing (2015–2017) comes before H3 (2018).
export const UBER_STAGES: EpisodeStage[] = [...UBER_STAGES_EARLY, tracing, hexagons, ...rest]
