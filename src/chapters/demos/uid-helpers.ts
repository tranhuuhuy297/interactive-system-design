/** ID helpers for the demos: Snowflake layout math, UUIDv4 and UUIDv7 (RFC 9562) generation. */

export const SNOWFLAKE_EPOCH = Date.UTC(2020, 0, 1)
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25

export interface Layout { ts: number; worker: number; seq: number }

export function layoutStats(l: Layout) {
  return {
    years: 2 ** l.ts / MS_PER_YEAR,
    workers: 2 ** l.worker,
    perMs: 2 ** l.seq,
  }
}

/** Compose a 63-bit Snowflake (sign bit is always 0). */
export function composeSnowflake(l: Layout, tsMs: number, worker: number, seq: number): bigint {
  return (BigInt(tsMs) << BigInt(l.worker + l.seq)) | (BigInt(worker) << BigInt(l.seq)) | BigInt(seq)
}

export function toBits(id: bigint, width = 64): string {
  return id.toString(2).padStart(width, '0')
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return b
}

function hex(bytes: Uint8Array): string {
  const h = Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function uuidv4(): string {
  const b = randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // RFC variant
  return hex(b)
}

/** UUIDv7: 48-bit Unix ms timestamp, then version, then random bits, so values sort by creation time. */
export function uuidv7(ms: number): string {
  const b = randomBytes(16)
  let t = ms
  for (let i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256) }
  b[6] = (b[6] & 0x0f) | 0x70 // version 7
  b[8] = (b[8] & 0x3f) | 0x80
  return hex(b)
}

/** Index where `value` would be inserted into sorted `arr` — where a B-tree would place the key. */
export function insertPosition(arr: string[], value: string): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < value) lo = mid + 1; else hi = mid }
  return lo
}
