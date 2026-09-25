/** Event-time windowing with a bounded-out-of-orderness watermark: watermark = max event time seen − lateness. */
export type WindowKind = 'tumbling' | 'sliding' | 'session'

export interface ClickEvent { id: number; eventTime: number; delay: number; arrival: number }
export interface ProcessedEvent extends ClickEvent { late: boolean }
export interface WindowResult { start: number; end: number; count: number }

export const HORIZON = 60
export const TUMBLE = 10
export const SLIDE = 5
export const SESSION_GAP = 4

function prng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
}

/** Mostly prompt events with a tail of stragglers (mobile clients reconnecting, retries). */
export function generateEvents(): ClickEvent[] {
  const r = prng(2024)
  const out: ClickEvent[] = []
  let t = 0.5
  for (let id = 0; t < HORIZON - 1; id++) {
    const straggler = r() < 0.18
    const delay = straggler ? 6 + r() * 14 : r() * 2.5
    out.push({ id, eventTime: +t.toFixed(2), delay: +delay.toFixed(2), arrival: +(t + delay).toFixed(2) })
    t += r() < 0.25 ? 3 + r() * 3 : 0.4 + r() * 1.2 // bursts and quiet gaps (so sessions form)
  }
  return out
}

function windowsFor(kind: WindowKind, t: number): [number, number][] {
  if (kind === 'tumbling') { const s = Math.floor(t / TUMBLE) * TUMBLE; return [[s, s + TUMBLE]] }
  if (kind === 'sliding') {
    const last = Math.floor(t / SLIDE) * SLIDE
    return [[last - SLIDE, last + SLIDE], [last, last + TUMBLE]].filter(([s]) => s >= 0) as [number, number][]
  }
  return [[t, t + SESSION_GAP]] // a session containing t cannot close before t + gap
}

export function runPipeline(events: ClickEvent[], kind: WindowKind, lateness: number) {
  const byArrival = [...events].sort((a, b) => a.arrival - b.arrival)
  let maxSeen = -Infinity
  const processed: ProcessedEvent[] = []
  const counts = new Map<string, WindowResult>()

  for (const e of byArrival) {
    const watermark = maxSeen - lateness
    const open = windowsFor(kind, e.eventTime).filter(([, end]) => end > watermark)
    processed.push({ ...e, late: open.length === 0 })
    if (kind !== 'session') {
      for (const [start, end] of open) {
        const k = `${start}`
        const w = counts.get(k) ?? { start, end, count: 0 }
        w.count += 1
        counts.set(k, w)
      }
    }
    maxSeen = Math.max(maxSeen, e.eventTime)
  }

  let windows = [...counts.values()].sort((a, b) => a.start - b.start)
  if (kind === 'session') windows = sessions(processed.filter((p) => !p.late).map((p) => p.eventTime))
  return { processed, windows, lateCount: processed.filter((p) => p.late).length }
}

function sessions(times: number[]): WindowResult[] {
  const sorted = [...times].sort((a, b) => a - b)
  const out: WindowResult[] = []
  for (const t of sorted) {
    const cur = out[out.length - 1]
    if (cur && t - (cur.end - SESSION_GAP) <= SESSION_GAP) { cur.end = t + SESSION_GAP; cur.count += 1 }
    else out.push({ start: t, end: t + SESSION_GAP, count: 1 })
  }
  return out
}
