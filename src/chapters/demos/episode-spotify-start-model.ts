/** Toy time-to-first-sound model: every number is illustrative, not a Spotify measurement. */
export interface StartInputs {
  rttMs: number
  mbps: number
  bitrateKbps: number
  warmConnection: boolean
  prefetchNext: boolean
  cacheKeys: boolean
  lowBitrateStart: boolean
  /** Whether the user played the predicted next track or jumped somewhere random. */
  predictable: boolean
}

export interface StartPhase { id: 'connect' | 'resolve' | 'key' | 'chunk' | 'decode'; label: string; ms: number }

const START_BUFFER_SEC = 2 // audio needed before playback begins
const LOW_BITRATE_KBPS = 24
const DECODE_MS = 20

export function timeToFirstSound(i: StartInputs): { phases: StartPhase[]; totalMs: number; bytesKb: number } {
  const hit = i.prefetchNext && i.predictable
  const firstKbps = i.lowBitrateStart ? LOW_BITRATE_KBPS : i.bitrateKbps
  const bytesKb = (firstKbps * START_BUFFER_SEC) / 8
  const transferMs = (bytesKb * 8) / Math.max(0.1, i.mbps) // kbit / Mbit/s = ms
  const phases: StartPhase[] = [
    { id: 'connect', label: 'Connection setup', ms: i.warmConnection ? 0 : 2 * i.rttMs },
    { id: 'resolve', label: 'Resolve track', ms: hit ? 0 : i.rttMs },
    { id: 'key', label: 'Fetch key', ms: hit || i.cacheKeys ? 0 : i.rttMs },
    { id: 'chunk', label: 'First audio chunk', ms: hit ? 0 : i.rttMs + transferMs },
    { id: 'decode', label: 'Decode + output', ms: DECODE_MS },
  ]
  return { phases, totalMs: phases.reduce((s, p) => s + p.ms, 0), bytesKb }
}
