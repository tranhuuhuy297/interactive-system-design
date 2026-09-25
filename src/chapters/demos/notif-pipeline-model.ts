/** Notification pipeline: dedup → preferences → rate limit → per-channel send with retries → DLQ. */
export type Channel = 'push' | 'sms' | 'email'
export type EventKind = 'transactional' | 'marketing'

export const CHANNELS: Channel[] = ['push', 'sms', 'email']
export const PROVIDER: Record<Channel, string> = { push: 'APNs/FCM', sms: 'SMS gateway', email: 'Email provider' }

export interface NotifConfig {
  prefs: Record<Channel, boolean>
  failRate: Record<Channel, number> // 0..1
  marketingPerHour: number
  maxRetries: number
}

export interface Counters {
  received: number; deduped: number; suppressed: number; rateLimited: number
  delivered: number; retried: number; dlq: number
}

export interface LogLine { text: string; tone: 'ok' | 'warn' | 'bad' | 'info' }

export interface NotifState {
  seen: string[]
  marketingSent: number
  c: Counters
  log: LogLine[]
}

export const EMPTY_COUNTERS: Counters = { received: 0, deduped: 0, suppressed: 0, rateLimited: 0, delivered: 0, retried: 0, dlq: 0 }
export const INITIAL_NOTIF: NotifState = { seen: [], marketingSent: 0, c: EMPTY_COUNTERS, log: [] }

export function processEvent(s: NotifState, key: string, kind: EventKind, cfg: NotifConfig, rand = Math.random): NotifState {
  const c = { ...s.c, received: s.c.received + 1 }
  const lines: LogLine[] = []
  const done = (extra: Partial<NotifState> = {}): NotifState =>
    ({ ...s, ...extra, c, log: [...lines.reverse(), ...s.log].slice(0, 14) })

  if (s.seen.includes(key)) {
    c.deduped += 1
    lines.push({ text: `${key}: duplicate idempotency key, dropped`, tone: 'warn' })
    return done()
  }
  const seen = [...s.seen, key].slice(-500) // stands in for a TTL'd key set in Redis

  const channels = CHANNELS.filter((ch) => cfg.prefs[ch])
  if (channels.length === 0) {
    c.suppressed += 1
    lines.push({ text: `${key}: user opted out of every channel`, tone: 'warn' })
    return done({ seen })
  }

  let marketingSent = s.marketingSent
  if (kind === 'marketing') {
    if (marketingSent >= cfg.marketingPerHour) {
      c.rateLimited += 1
      lines.push({ text: `${key}: marketing cap ${cfg.marketingPerHour}/h reached, rate-limited`, tone: 'warn' })
      return done({ seen })
    }
    marketingSent += 1
  }

  for (const ch of channels) {
    let ok = false
    for (let attempt = 0; attempt <= cfg.maxRetries && !ok; attempt++) {
      ok = rand() >= cfg.failRate[ch]
      if (ok) {
        c.delivered += 1
        lines.push({ text: `${key} → ${ch}: delivered via ${PROVIDER[ch]}${attempt ? ` on retry ${attempt}` : ''}`, tone: 'ok' })
      } else if (attempt < cfg.maxRetries) {
        c.retried += 1
        lines.push({ text: `${key} → ${ch}: provider 5xx, retry in ${2 ** attempt}s (+jitter)`, tone: 'info' })
      }
    }
    if (!ok) {
      c.dlq += 1
      lines.push({ text: `${key} → ${ch}: retries exhausted, sent to DLQ`, tone: 'bad' })
    }
  }
  return done({ seen, marketingSent })
}
