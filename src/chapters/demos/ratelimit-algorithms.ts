/** Five classic rate limiters over a simulated clock (ms). Each returns the time the request is served, or null if rejected. */
export interface Limiter {
  key: string
  name: string
  allow(t: number): number | null
}

export function makeLimiters(limit: number, windowMs: number): Limiter[] {
  const rate = limit / windowMs // tokens (or leaks) per ms
  return [tokenBucket(limit, rate), leakyBucket(limit, rate), fixedWindow(limit, windowMs), slidingLog(limit, windowMs), slidingCounter(limit, windowMs)]
}

function tokenBucket(capacity: number, rate: number): Limiter {
  let tokens = capacity
  let last = 0
  return {
    key: 'token', name: 'Token bucket',
    allow(t) {
      tokens = Math.min(capacity, tokens + (t - last) * rate)
      last = t
      if (tokens >= 1) { tokens -= 1; return t }
      return null
    },
  }
}

/** Leaky bucket as a queue: accepted requests leave at a constant rate, so output is smoothed (served later). */
function leakyBucket(capacity: number, rate: number): Limiter {
  let queued = 0
  let last = 0
  return {
    key: 'leaky', name: 'Leaky bucket',
    allow(t) {
      queued = Math.max(0, queued - (t - last) * rate)
      last = t
      if (queued + 1 > capacity) return null
      queued += 1
      return t + (queued - 1) / rate // departs after everything already in the queue
    },
  }
}

function fixedWindow(limit: number, windowMs: number): Limiter {
  let win = -1
  let count = 0
  return {
    key: 'fixed', name: 'Fixed window',
    allow(t) {
      const w = Math.floor(t / windowMs)
      if (w !== win) { win = w; count = 0 }
      if (count < limit) { count += 1; return t }
      return null
    },
  }
}

/** Exact but memory-heavy: stores one timestamp per accepted request. */
function slidingLog(limit: number, windowMs: number): Limiter {
  const log: number[] = []
  return {
    key: 'log', name: 'Sliding log',
    allow(t) {
      while (log.length && log[0] <= t - windowMs) log.shift()
      if (log.length < limit) { log.push(t); return t }
      return null
    },
  }
}

/** Weighted estimate: previous window's count scaled by its overlap with the rolling window. */
function slidingCounter(limit: number, windowMs: number): Limiter {
  let win = -1
  let prev = 0
  let cur = 0
  return {
    key: 'counter', name: 'Sliding counter',
    allow(t) {
      const w = Math.floor(t / windowMs)
      if (w !== win) { prev = w === win + 1 ? cur : 0; cur = 0; win = w }
      const overlap = 1 - (t % windowMs) / windowMs
      if (prev * overlap + cur + 1 > limit) return null
      cur += 1
      return t
    },
  }
}
