/** Web Mercator tile pyramid math (256px tiles, the scheme used by most web maps). */

export const EARTH_CIRCUMFERENCE_KM = 40_075

export interface Tile { z: number; x: number; y: number }

export const tilesAtZoom = (z: number) => 4 ** z
/** Tiles in levels 0..z inclusive: (4^(z+1) − 1) / 3. */
export const tilesThroughZoom = (z: number) => (4 ** (z + 1) - 1) / 3
/** Width of one tile at the equator. */
export const tileWidthKm = (z: number) => EARTH_CIRCUMFERENCE_KM / 2 ** z
/** Ground resolution at the equator for 256px tiles. */
export const metersPerPixel = (z: number) => 156_543.03 / 2 ** z

export const children = ({ z, x, y }: Tile): Tile[] => [
  { z: z + 1, x: 2 * x, y: 2 * y },
  { z: z + 1, x: 2 * x + 1, y: 2 * y },
  { z: z + 1, x: 2 * x, y: 2 * y + 1 },
  { z: z + 1, x: 2 * x + 1, y: 2 * y + 1 },
]

export const parent = ({ z, x, y }: Tile): Tile | null => (z === 0 ? null : { z: z - 1, x: x >> 1, y: y >> 1 })

/** Bing-style quadkey: one base-4 digit per level; shared prefixes mean shared ancestors. */
export function quadkey({ z, x, y }: Tile): string {
  let key = ''
  for (let i = z; i > 0; i--) {
    const mask = 1 << (i - 1)
    key += String((x & mask ? 1 : 0) + (y & mask ? 2 : 0))
  }
  return key || '(root)'
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
  let v = bytes
  let u = 0
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++ }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[u]}`
}

export function formatCount(n: number): string {
  if (n < 1e6) return Math.round(n).toLocaleString('en-US')
  const units: [number, string][] = [[1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']]
  const [d, name] = units.find(([d]) => n >= d)!
  return `${(n / d).toFixed(1)} ${name}`
}
