/** Synthetic metric data + rollups, storage math, and alert-rule evaluation for the monitoring chapter. */

function prng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
}

/** 6 h of 10-second CPU samples with a daily-ish wave, noise, and one short spike. */
export function rawCpuSeries(): number[] {
  const r = prng(11)
  return Array.from({ length: 6 * 360 }, (_, i) => {
    const wave = 45 + 15 * Math.sin(i / 260)
    const spike = i > 1210 && i < 1222 ? 40 : 0 // two-minute spike
    return Math.min(100, Math.max(0, wave + (r() - 0.5) * 12 + spike))
  })
}

export type Agg = 'avg' | 'max'

export function rollup(series: number[], bucket: number, agg: Agg): number[] {
  const out: number[] = []
  for (let i = 0; i < series.length; i += bucket) {
    const chunk = series.slice(i, i + bucket)
    out.push(agg === 'max' ? Math.max(...chunk) : chunk.reduce((a, b) => a + b, 0) / chunk.length)
  }
  return out
}

export interface StorageInput { series: number; bytesPerSample: number }

/** Retention tiers: raw 10 s for 15 d, 1 m rollups for 90 d, 1 h rollups for 2 y (4 aggregates each). */
export function storageTiers({ series, bytesPerSample }: StorageInput) {
  const raw = series * 8640 * 15 * bytesPerSample
  const minute = series * 1440 * 90 * bytesPerSample * 4
  const hour = series * 24 * 730 * bytesPerSample * 4
  const noDownsample = series * 8640 * 730 * bytesPerSample
  return { raw, minute, hour, total: raw + minute + hour, noDownsample }
}

export function formatBytes(b: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  while (b >= 1000 && i < units.length - 1) { b /= 1000; i++ }
  return `${b.toFixed(b < 10 ? 1 : 0)} ${units[i]}`
}

/** 180 minutes of error-rate % for a 99.9% service: healthy baseline well under the 0.1% budget,
 *  occasional one-minute blips (noise), and a real incident at minutes 100–130. */
export function errorRateSeries(): number[] {
  const r = prng(5)
  return Array.from({ length: 180 }, (_, i) => {
    const base = 0.04 + 0.02 * Math.sin(i / 3) + (r() - 0.5) * 0.04
    const blip = r() < 0.07 ? 0.15 + r() * 0.35 : 0
    const incident = i >= 100 && i < 130 ? 4.2 : 0
    return Math.max(0, +(base + blip + incident).toFixed(3))
  })
}

export type Rule = 'threshold' | 'for' | 'burn'

export const SLO_BUDGET = 0.1 // 99.9% SLO → 0.1% error budget
export const BURN_FAST = 14.4 // pages when 2% of a 30-day budget burns in 1 h

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

/** Returns a firing flag per minute for the chosen rule. */
export function evaluate(series: number[], rule: Rule, threshold: number, forMinutes: number): boolean[] {
  if (rule === 'threshold') return series.map((v) => v > threshold)
  if (rule === 'for') {
    let run = 0
    return series.map((v) => { run = v > threshold ? run + 1 : 0; return run >= forMinutes })
  }
  return series.map((_, i) => {
    const long = avg(series.slice(Math.max(0, i - 59), i + 1)) / SLO_BUDGET
    const short = avg(series.slice(Math.max(0, i - 4), i + 1)) / SLO_BUDGET
    return long > BURN_FAST && short > BURN_FAST
  })
}

/** Distinct firing episodes = pages sent. */
export function countPages(firing: boolean[]): number {
  return firing.reduce((n, f, i) => n + (f && !firing[i - 1] ? 1 : 0), 0)
}

export function detectionDelay(firing: boolean[], incidentStart = 100): number | null {
  const idx = firing.findIndex((f, i) => f && i >= incidentStart)
  return idx === -1 ? null : idx - incidentStart
}
