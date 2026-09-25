/** Chunking + merge helpers for the file-sync demos. Sizes are scaled down (chars, not MB) so edits are visible. */

export interface Chunk { text: string; hash: string; start: number }

export function shortHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0').slice(0, 6)
}

export function fixedChunks(text: string, size = 48): Chunk[] {
  const out: Chunk[] = []
  for (let i = 0; i < text.length; i += size) {
    const t = text.slice(i, i + size)
    out.push({ text: t, hash: shortHash(t), start: i })
  }
  return out
}

// Deterministic pseudo-random "gear" table, the same idea FastCDC uses for its rolling hash.
const GEAR = Array.from({ length: 256 }, (_, i) => {
  let x = (i + 1) * 2654435761
  x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995); x ^= x >>> 15
  return x >>> 0
})

/** Content-defined chunking: a boundary wherever the rolling hash matches a mask, so edits only disturb nearby chunks. */
export function cdcChunks(text: string, mask = 31, min = 16, max = 128): Chunk[] {
  const out: Chunk[] = []
  let start = 0
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = ((h << 1) + GEAR[text.charCodeAt(i) & 255]) >>> 0
    const len = i - start + 1
    if ((len >= min && (h & mask) === 0) || len >= max) {
      const t = text.slice(start, i + 1)
      out.push({ text: t, hash: shortHash(t), start })
      start = i + 1
      h = 0
    }
  }
  if (start < text.length) {
    const t = text.slice(start)
    out.push({ text: t, hash: shortHash(t), start })
  }
  return out
}

export type MergeLine = { text: string; kind: 'same' | 'ours' | 'theirs' | 'conflict' }

/** Line-level three-way merge: a side wins where only it changed; both changing the same line is a conflict. */
export function threeWayMerge(base: string[], ours: string[], theirs: string[]): MergeLine[] {
  return base.map((b, i) => {
    const o = ours[i], t = theirs[i]
    if (o === t) return { text: o, kind: o === b ? 'same' : 'ours' }
    if (o === b) return { text: t, kind: 'theirs' }
    if (t === b) return { text: o, kind: 'ours' }
    return { text: `<<<< laptop: ${o} ==== phone: ${t} >>>>`, kind: 'conflict' }
  })
}
