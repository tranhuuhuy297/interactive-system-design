/** Pure models behind the video demos: DAG scheduling for transcoding, and an ABR player simulation. */

// ── Transcoding DAG ────────────────────────────────────────────────────────────

export const RENDITIONS = [
  { id: '1080p', cost: 1.6 }, { id: '720p', cost: 0.9 }, { id: '480p', cost: 0.5 }, { id: '360p', cost: 0.3 },
] as const

export interface DagTask { id: string; row: string; lane: number; deps: string[]; dur: number; start: number; end: number }

/** Greedy list scheduling of the transcoding DAG on `workers` machines. Costs are illustrative worker-minutes per video-minute. */
export function scheduleTranscode(videoMinutes: number, segments: number, workers: number): { tasks: DagTask[]; makespan: number } {
  const tasks: DagTask[] = [{ id: 'split', row: 'Split + inspect', lane: 0, deps: [], dur: 0.1 * videoMinutes, start: 0, end: 0 }]
  const encIds: string[] = []
  for (const r of RENDITIONS) {
    for (let s = 0; s < segments; s++) {
      const id = `${r.id}-${s}`
      encIds.push(id)
      tasks.push({ id, row: `Encode ${r.id}`, lane: s, deps: ['split'], dur: (r.cost * videoMinutes) / segments, start: 0, end: 0 })
    }
  }
  tasks.push({ id: 'audio', row: 'Audio (AAC)', lane: 0, deps: ['split'], dur: 0.05 * videoMinutes, start: 0, end: 0 })
  tasks.push({ id: 'thumbs', row: 'Thumbnails', lane: 0, deps: ['split'], dur: 0.08 * videoMinutes, start: 0, end: 0 })
  tasks.push({ id: 'package', row: 'Package HLS/DASH', lane: 0, deps: [...encIds, 'audio'], dur: 0.05 * videoMinutes + 0.2, start: 0, end: 0 })

  const done = new Map<string, number>()
  const pending = [...tasks]
  const free: number[] = Array(workers).fill(0) // time at which each worker becomes free
  while (pending.length) {
    // Ready = all deps finished; schedule the one whose deps finish earliest (FIFO-ish), longest first as tiebreak.
    const ready = pending.filter((t) => t.deps.every((d) => done.has(d)))
      .map((t) => ({ t, at: Math.max(0, ...t.deps.map((d) => done.get(d)!)) }))
      .sort((a, b) => a.at - b.at || b.t.dur - a.t.dur)
    const { t, at } = ready[0]
    const w = free.indexOf(Math.min(...free))
    t.start = Math.max(at, free[w])
    t.end = t.start + t.dur
    free[w] = t.end
    done.set(t.id, t.end)
    pending.splice(pending.indexOf(t), 1)
  }
  return { tasks, makespan: Math.max(...tasks.map((t) => t.end)) }
}

// ── Adaptive bitrate ───────────────────────────────────────────────────────────

export const LADDER = [0.4, 0.8, 1.4, 2.8, 5.0] // Mbps: 240p 360p 480p 720p 1080p
export const LADDER_LABEL = ['240p', '360p', '480p', '720p', '1080p']
export type NetProfile = 'stable' | 'drop' | 'jittery'
export type AbrAlgo = 'throughput' | 'buffer'

export function bandwidthAt(t: number, profile: NetProfile, scale: number): number {
  const base = profile === 'stable' ? 6
    : profile === 'drop' ? (t < 40 ? 7 : t < 80 ? 1.2 : 6)
    : 3.5 + 2.4 * Math.sin(t / 6) + 1.2 * Math.sin(t * 1.7)
  return Math.max(0.2, base * scale)
}

export interface AbrPoint { t: number; bw: number; rate: number; buffer: number; stall: number }

const SEG = 4 // seconds of video per segment
const MAX_BUF = 30

export function simulateAbr(profile: NetProfile, scale: number, algo: AbrAlgo, safety: number, segments = 32) {
  let t = 0, buffer = 0, est = 1, stallTotal = 0, switches = 0, prev = -1, sumRate = 0
  const pts: AbrPoint[] = []
  for (let i = 0; i < segments; i++) {
    let idx: number
    if (algo === 'throughput') {
      idx = LADDER.reduce((best, r, j) => (r <= est * safety ? j : best), 0)
    } else {
      // Buffer-based (BBA-style): below the reservoir stay lowest, above the cushion go highest, linear in between.
      const frac = Math.min(1, Math.max(0, (buffer - 5) / 20))
      idx = Math.floor(frac * (LADDER.length - 1) + 1e-9)
    }
    const rate = LADDER[idx]
    const bw = bandwidthAt(t, profile, scale)
    const dl = (rate * SEG) / bw
    let stall = 0
    if (dl > buffer && i > 0) { stall = dl - buffer; buffer = 0 } else if (i > 0) buffer -= dl
    if (i === 0) stall = dl // startup delay counts as initial stall
    stallTotal += stall
    t += dl
    buffer += SEG
    if (buffer > MAX_BUF) { t += buffer - MAX_BUF; buffer = MAX_BUF }
    est = 0.7 * est + 0.3 * bw
    if (prev !== -1 && prev !== idx) switches += 1
    prev = idx
    sumRate += rate
    pts.push({ t, bw, rate, buffer, stall })
  }
  return { pts, stallTotal, switches, avgRate: sumRate / segments, startup: pts[0]?.stall ?? 0 }
}
