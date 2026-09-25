/** Geohash + quadtree helpers for the proximity demos. */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

export interface BBox { latMin: number; latMax: number; lonMin: number; lonMax: number }

export function geohashEncode(lat: number, lon: number, precision: number): string {
  let latLo = -90, latHi = 90, lonLo = -180, lonHi = 180
  let hash = '', bit = 0, ch = 0, even = true // even bits encode longitude
  while (hash.length < precision) {
    if (even) {
      const mid = (lonLo + lonHi) / 2
      if (lon >= mid) { ch = (ch << 1) | 1; lonLo = mid } else { ch <<= 1; lonHi = mid }
    } else {
      const mid = (latLo + latHi) / 2
      if (lat >= mid) { ch = (ch << 1) | 1; latLo = mid } else { ch <<= 1; latHi = mid }
    }
    even = !even
    if (++bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0 }
  }
  return hash
}

export function geohashBBox(hash: string): BBox {
  let latLo = -90, latHi = 90, lonLo = -180, lonHi = 180, even = true
  for (const c of hash) {
    const v = BASE32.indexOf(c)
    for (let b = 4; b >= 0; b--) {
      const on = (v >> b) & 1
      if (even) { const m = (lonLo + lonHi) / 2; if (on) lonLo = m; else lonHi = m }
      else { const m = (latLo + latHi) / 2; if (on) latLo = m; else latHi = m }
      even = !even
    }
  }
  return { latMin: latLo, latMax: latHi, lonMin: lonLo, lonMax: lonHi }
}

/** Cell size in degrees: longitude gets the extra bit when 5·precision is odd. */
export function cellDegrees(precision: number) {
  const bits = 5 * precision
  return { w: 360 / 2 ** Math.ceil(bits / 2), h: 180 / 2 ** Math.floor(bits / 2) }
}

export const KM_PER_DEG = 111.32
export function cellKm(precision: number, lat: number) {
  const { w, h } = cellDegrees(precision)
  return { wKm: w * KM_PER_DEG * Math.cos((lat * Math.PI) / 180), hKm: h * KM_PER_DEG }
}

const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180

/** (2r+1)² grid of geohashes centered on the cell containing (lat, lon); row 0 is north. */
export function geohashGrid(lat: number, lon: number, precision: number, r = 2): string[][] {
  const center = geohashBBox(geohashEncode(lat, lon, precision))
  const { w, h } = cellDegrees(precision)
  const cLat = (center.latMin + center.latMax) / 2
  const cLon = (center.lonMin + center.lonMax) / 2
  const rows: string[][] = []
  for (let dy = r; dy >= -r; dy--) {
    const row: string[] = []
    for (let dx = -r; dx <= r; dx++) {
      const la = Math.max(-89.9999, Math.min(89.9999, cLat + dy * h))
      row.push(geohashEncode(la, wrapLon(cLon + dx * w), precision))
    }
    rows.push(row)
  }
  return rows
}

export const sharedPrefix = (a: string, b: string) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i }

// ── Quadtree ──────────────────────────────────────────────────────────────────

export interface Pt { x: number; y: number }
export interface QNode { x: number; y: number; size: number; depth: number; points: Pt[]; children: QNode[] | null }

export function buildQuadtree(points: Pt[], capacity: number, maxDepth = 7): QNode {
  const make = (x: number, y: number, size: number, depth: number, pts: Pt[]): QNode => {
    if (pts.length <= capacity || depth >= maxDepth) return { x, y, size, depth, points: pts, children: null }
    const half = size / 2
    const quads = [[x, y], [x + half, y], [x, y + half], [x + half, y + half]]
    const children = quads.map(([qx, qy]) => make(qx, qy, half, depth + 1,
      pts.filter((p) => p.x >= qx && p.x < qx + half && p.y >= qy && p.y < qy + half)))
    return { x, y, size, depth, points: [], children }
  }
  return make(0, 0, 100, 0, points)
}

export interface Rect { x: number; y: number; w: number; h: number }
const overlaps = (n: QNode, r: Rect) => !(r.x > n.x + n.size || r.x + r.w < n.x || r.y > n.y + n.size || r.y + r.h < n.y)

export function queryQuadtree(root: QNode, r: Rect) {
  let visited = 0, checked = 0
  const found: Pt[] = []
  const walk = (n: QNode) => {
    if (!overlaps(n, r)) return
    visited += 1
    if (n.children) { n.children.forEach(walk); return }
    for (const p of n.points) {
      checked += 1
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) found.push(p)
    }
  }
  walk(root)
  return { visited, checked, found }
}

export function flattenQuadtree(root: QNode): QNode[] {
  const out: QNode[] = []
  const walk = (n: QNode) => { out.push(n); n.children?.forEach(walk) }
  walk(root)
  return out
}
