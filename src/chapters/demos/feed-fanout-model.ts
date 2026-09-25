/** Toy cost model for feed fan-out strategies. Constants are illustrative, not benchmarks. */
export type FeedStrategy = 'push' | 'pull' | 'hybrid'

export const MODEL = {
  fanoutWritesPerSec: 1_000_000, // aggregate throughput of the fan-out worker fleet
  bytesPerFeedEntry: 16, // post id + timestamp in a follower's cached feed list
  cachedReadMs: 5, // one Redis read of a precomputed feed + hydration
  pullMsPerFollowee: 0.3, // amortized cost to fetch + merge one followee's recent posts
}

export interface FeedInputs {
  followers: number // followers of the author who just posted
  followees: number // accounts a typical reader follows
  celebsFollowed: number // how many of those are above the hybrid threshold
  threshold: number // hybrid: authors with more followers than this are pulled
}

export interface FeedCost {
  writesPerPost: number
  deliverySeconds: number
  storageBytes: number
  readMs: number
  authorIsPulled: boolean
}

export function feedCost(s: FeedStrategy, i: FeedInputs): FeedCost {
  const pulled = s === 'pull' || (s === 'hybrid' && i.followers > i.threshold)
  const writes = pulled ? 1 : i.followers
  const readMs =
    s === 'push' ? MODEL.cachedReadMs
    : s === 'pull' ? MODEL.cachedReadMs + i.followees * MODEL.pullMsPerFollowee
    : MODEL.cachedReadMs + i.celebsFollowed * MODEL.pullMsPerFollowee
  return {
    writesPerPost: writes,
    deliverySeconds: pulled ? 0 : writes / MODEL.fanoutWritesPerSec,
    storageBytes: pulled ? 0 : writes * MODEL.bytesPerFeedEntry,
    readMs,
    authorIsPulled: pulled,
  }
}

/** Log-scale slider helpers: slider value 0..100 ↔ 10..100M followers. */
export const fromLog = (v: number) => Math.round(10 ** (1 + (v / 100) * 7))
export const toLog = (n: number) => ((Math.log10(n) - 1) / 7) * 100

export function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return `${Math.round(n)}`
}

export function bytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`
  return `${n} B`
}

export function duration(sec: number): string {
  if (sec === 0) return 'on read'
  if (sec < 1) return `${Math.max(1, Math.round(sec * 1000))} ms`
  if (sec < 120) return `${sec.toFixed(1)} s`
  return `${(sec / 60).toFixed(1)} min`
}
