/** Toy latency budget for an inline code completion. All constants are illustrative, not measurements. */

export interface CompletionConfig {
  smallModel: boolean
  speculative: boolean
  prefixCacheHit: boolean
  cancelStale: boolean
  promptTokens: number
  outputTokens: number
  /** How long the developer pauses before typing again (the deadline). */
  pauseMs: number
}

export interface Segment { key: string; label: string; ms: number }

const DEBOUNCE_MS = 75
const NETWORK_RTT_MS = 60
const RENDER_MS = 15
const PREFILL_TOK_PER_S = { small: 20_000, large: 4_000 }
const DECODE_MS_PER_TOK = { small: 6, large: 25 }
const SPECULATIVE_SPEEDUP = 0.55
const CACHED_FRACTION = 0.85

export function completionBudget(c: CompletionConfig): { segments: Segment[]; total: number; inTime: boolean } {
  const size = c.smallModel ? 'small' : 'large'
  const uncached = c.prefixCacheHit ? c.promptTokens * (1 - CACHED_FRACTION) : c.promptTokens
  const prefill = (uncached / PREFILL_TOK_PER_S[size]) * 1000
  const decode = c.outputTokens * DECODE_MS_PER_TOK[size] * (c.speculative ? SPECULATIVE_SPEEDUP : 1)
  // Without cancellation, requests for already-typed prefixes keep the GPU busy ahead of this one.
  const queue = c.cancelStale ? 10 : 90
  const segments: Segment[] = [
    { key: 'debounce', label: 'Debounce', ms: DEBOUNCE_MS },
    { key: 'network', label: 'Network', ms: NETWORK_RTT_MS },
    { key: 'queue', label: 'Queue', ms: queue },
    { key: 'prefill', label: 'Prefill', ms: Math.round(prefill) },
    { key: 'decode', label: 'Decode', ms: Math.round(decode) },
    { key: 'render', label: 'Render', ms: RENDER_MS },
  ]
  const total = segments.reduce((s, x) => s + x.ms, 0)
  return { segments, total, inTime: total <= c.pauseMs }
}
