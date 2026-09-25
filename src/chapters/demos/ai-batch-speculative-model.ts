// Speculative decoding under the i.i.d. acceptance assumption (Leviathan et al., 2023).
// alpha: per-token acceptance rate; gamma: draft tokens per iteration;
// c: draft-model step time ÷ target-model step time.

/** Expected tokens emitted per target-model call: (1 − α^(γ+1)) / (1 − α). */
export function expectedTokens(alpha: number, gamma: number): number {
  if (alpha >= 1) return gamma + 1
  return (1 - alpha ** (gamma + 1)) / (1 - alpha)
}

/** Expected walltime speedup vs plain decoding: E[tokens] / (γ·c + 1). */
export function speedup(alpha: number, gamma: number, c: number): number {
  return expectedTokens(alpha, gamma) / (gamma * c + 1)
}

export function bestGamma(alpha: number, c: number, maxGamma = 12): number {
  let best = 1
  for (let g = 1; g <= maxGamma; g++) if (speedup(alpha, g, c) > speedup(alpha, best, c)) best = g
  return best
}

export interface Iteration {
  /** Per draft token: true = accepted, false = rejected; drafts after a rejection are discarded. */
  drafts: boolean[]
  /** Tokens actually emitted: accepted drafts + 1 from the target (correction or bonus). */
  emitted: number
}

/** One verify step: accept drafts left-to-right until the first rejection. */
export function simulateIteration(alpha: number, gamma: number, rnd: () => number): Iteration {
  const drafts: boolean[] = []
  let accepted = 0
  for (let k = 0; k < gamma; k++) {
    const ok = rnd() < alpha
    drafts.push(ok)
    if (!ok) break
    accepted++
  }
  return { drafts, emitted: accepted + 1 }
}

export function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
}
