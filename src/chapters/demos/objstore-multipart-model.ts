/** Tick-based multipart upload simulation with bounded parallelism and per-attempt failures. */
export type PartState = 'pending' | 'uploading' | 'retrying' | 'done'
export interface Part { n: number; state: PartState; progress: number; attempts: number }
export interface Upload { parts: Part[]; completed: boolean; tick: number; failures: number }

export const createUpload = (count: number): Upload => ({
  parts: Array.from({ length: count }, (_, i) => ({ n: i + 1, state: 'pending', progress: 0, attempts: 0 })),
  completed: false, tick: 0, failures: 0,
})

export function step(u: Upload, parallel: number, failRate: number, rand: () => number): Upload {
  if (u.completed) return u
  const parts = u.parts.map((p) => ({ ...p }))
  let failures = u.failures
  let active = parts.filter((p) => p.state === 'uploading').length
  for (const p of parts) {
    if (active >= parallel) break
    if (p.state === 'pending' || p.state === 'retrying') { p.state = 'uploading'; p.progress = 0; p.attempts += 1; active += 1 }
  }
  for (const p of parts) {
    if (p.state !== 'uploading') continue
    if (rand() < failRate / 6) { p.state = 'retrying'; p.progress = 0; failures += 1; continue } // spread failure chance over ~6 ticks
    p.progress = Math.min(1, p.progress + 0.12 + rand() * 0.12)
    if (p.progress >= 1) p.state = 'done'
  }
  const completed = parts.every((p) => p.state === 'done') // CompleteMultipartUpload stitches the part list
  return { parts, completed, tick: u.tick + 1, failures }
}
