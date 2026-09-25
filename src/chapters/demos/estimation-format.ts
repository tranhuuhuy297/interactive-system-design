/** Human-friendly number formatting for estimation demos (decimal units, like interviews use). */

export function fmtNum(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${trim(n / 1e12)}T`
  if (abs >= 1e9) return `${trim(n / 1e9)}B`
  if (abs >= 1e6) return `${trim(n / 1e6)}M`
  if (abs >= 1e3) return `${trim(n / 1e3)}K`
  return trim(n)
}

export function fmtBytes(b: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
  let i = 0
  while (b >= 1000 && i < units.length - 1) { b /= 1000; i++ }
  return `${trim(b)} ${units[i]}`
}

/** Nanoseconds → readable duration (ns, µs, ms, s, min, h, days, years). */
export function fmtDuration(ns: number): string {
  if (ns < 1e3) return `${trim(ns)} ns`
  if (ns < 1e6) return `${trim(ns / 1e3)} µs`
  if (ns < 1e9) return `${trim(ns / 1e6)} ms`
  const s = ns / 1e9
  if (s < 60) return `${trim(s)} s`
  if (s < 3600) return `${trim(s / 60)} min`
  if (s < 86400) return `${trim(s / 3600)} h`
  if (s < 86400 * 365) return `${trim(s / 86400)} days`
  return `${trim(s / (86400 * 365))} years`
}

function trim(n: number): string {
  if (n >= 100) return Math.round(n).toLocaleString('en-US')
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, '')
  return n.toFixed(2).replace(/\.?0+$/, '')
}
