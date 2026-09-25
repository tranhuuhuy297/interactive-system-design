// Eval harness model: paired pass/fail results, bootstrap confidence intervals, and judge position bias.

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * n labeled items graded under prompt A and prompt B. Items share a difficulty, so results are paired
 * (hard items tend to fail for both), which is what real eval sets look like.
 */
export function makeResults(n: number, seed: number, passA: number, lift: number) {
  const rng = mulberry32(seed)
  const a: boolean[] = []
  const b: boolean[] = []
  for (let i = 0; i < n; i++) {
    const difficulty = rng() - 0.5 // shifts both versions equally
    const u = rng() // shared noise → strong pairing
    // Independent flips give discordant pairs in both directions (B fixes some items, breaks others).
    const flipA = rng() < 0.08
    const flipB = rng() < 0.08
    a.push((u < clamp01(passA - difficulty * 0.6)) !== flipA)
    b.push((u < clamp01(passA + lift - difficulty * 0.6)) !== flipB)
  }
  return { a, b }
}

const mean = (xs: boolean[]) => xs.reduce((s, x) => s + (x ? 1 : 0), 0) / xs.length

function percentile(sorted: number[], p: number) {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))
  return sorted[idx]
}

/** Paired percentile bootstrap: resample item indices with replacement, recompute B − A each time. */
export function bootstrapDiff(a: boolean[], b: boolean[], iters = 2000, seed = 7) {
  const rng = mulberry32(seed)
  const n = a.length
  const diffs: number[] = []
  for (let k = 0; k < iters; k++) {
    let sa = 0
    let sb = 0
    for (let i = 0; i < n; i++) {
      const j = Math.floor(rng() * n)
      sa += a[j] ? 1 : 0
      sb += b[j] ? 1 : 0
    }
    diffs.push((sb - sa) / n)
  }
  diffs.sort((x, y) => x - y)
  return { diff: mean(b) - mean(a), lo: percentile(diffs, 0.025), hi: percentile(diffs, 0.975) }
}

export function summarize(a: boolean[], b: boolean[], seed: number) {
  const d = bootstrapDiff(a, b, 2000, seed)
  return { scoreA: mean(a), scoreB: mean(b), ...d, significant: d.lo > 0 || d.hi < 0 }
}

/**
 * Pairwise judge with position bias: with probability `bias` it picks whichever answer is shown first,
 * otherwise it picks the true winner. Each pair has a true winner (B with probability `truth`).
 */
export function judgeBias(pairs: number, truth: number, bias: number, seed: number) {
  const rng = mulberry32(seed)
  let bFirstWins = 0
  let bSecondWins = 0
  let consistentB = 0
  let consistent = 0
  for (let i = 0; i < pairs; i++) {
    const trueB = rng() < truth
    const verdict = (bShownFirst: boolean) => (rng() < bias ? bShownFirst : trueB) // true → judge picked B
    const v1 = verdict(true)
    const v2 = verdict(false)
    if (v1) bFirstWins++
    if (v2) bSecondWins++
    if (v1 === v2) { consistent++; if (v1) consistentB++ }
  }
  return {
    bFirst: bFirstWins / pairs,
    bSecond: bSecondWins / pairs,
    swapped: consistent ? consistentB / consistent : 0.5,
    tieRate: 1 - consistent / pairs,
  }
}
