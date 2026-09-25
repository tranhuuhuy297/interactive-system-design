import { useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { cellDegrees, cellKm, geohashBBox, geohashEncode, geohashGrid, sharedPrefix } from './geo-models'
import './geo-demos.css'

const PLACES = {
  'San Francisco': [37.7749, -122.4194],
  London: [51.5074, -0.1278],
  Hanoi: [21.0285, 105.8542],
  'Greenwich (edge case)': [51.4779, -0.0015],
} as const
type Place = keyof typeof PLACES

const fmtKm = (km: number) => (km >= 1 ? `${km.toFixed(km < 10 ? 1 : 0)} km` : `${Math.round(km * 1000)} m`)

export function GeoGeohashExplorer() {
  const [place, setPlace] = useState<Place>('San Francisco')
  const [pos, setPos] = useState<readonly [number, number]>(PLACES['San Francisco'])
  const [precision, setPrecision] = useState(6)
  const [radius, setRadius] = useState(0.5)

  const [lat, lon] = pos
  const code = geohashEncode(lat, lon, precision)
  const grid = useMemo(() => geohashGrid(lat, lon, precision), [lat, lon, precision])
  const box = geohashBBox(code)
  const { w, h } = cellDegrees(precision)
  const { wKm, hKm } = cellKm(precision, lat)

  // Point position in grid units (center cell spans [2,3) in both axes, y grows southward).
  const px = 2 + (lon - box.lonMin) / w
  const py = 2 + (box.latMax - lat) / h
  const rx = radius / wKm
  const ry = radius / hKm
  const inCircle = (cx: number, cy: number) => {
    const nx = Math.max(cx, Math.min(px, cx + 1)), ny = Math.max(cy, Math.min(py, cy + 1))
    return ((nx - px) / rx) ** 2 + ((ny - py) / ry) ** 2 <= 1
  }
  const tooBig = rx > 1.5 || ry > 1.5
  const cellsNeeded = grid.flat().filter((_, i) => inCircle(i % 5, Math.floor(i / 5))).length

  const choose = (p: Place) => { setPlace(p); setPos(PLACES[p]) }
  const moveTo = (hash: string) => {
    const b = geohashBBox(hash)
    setPos([(b.latMin + b.latMax) / 2, (b.lonMin + b.lonMax) / 2])
  }
  const reset = () => { choose('San Francisco'); setPrecision(6); setRadius(0.5) }

  return (
    <DemoFrame title="Geohash explorer: a location becomes a string prefix" onReset={reset}
      hint="The center cell plus its 8 neighbors cover any search radius smaller than one cell. Try Greenwich: neighbors across the 0° meridian share no prefix at all.">
      <div className="geo__controls">
        <Segmented label="Location" options={Object.keys(PLACES) as Place[]} value={place} onChange={choose} />
        <Slider label="Precision (chars)" min={1} max={9} value={precision} onChange={setPrecision} />
        <Slider label="Search radius" min={0.05} max={20} step={0.05} value={radius} onChange={setRadius} format={fmtKm} />
      </div>
      <div className="geo__layout">
        <div className="geo__grid" role="grid" aria-label="Geohash cells around the point">
          {grid.map((row, y) => (
            <div key={y} role="row" className="geo__row">
              {row.map((g, x) => {
                const center = x === 2 && y === 2
                const neighbor = Math.abs(x - 2) <= 1 && Math.abs(y - 2) <= 1 && !center
                const sp = sharedPrefix(g, code)
                return (
                  <button key={`${g}-${x}`} role="gridcell" onClick={() => moveTo(g)}
                    className={`geo__cell ${center ? 'is-center' : ''} ${neighbor ? 'is-neighbor' : ''} ${inCircle(x, y) ? 'is-hit' : ''}`}
                    aria-label={`Cell ${g}, shares ${sp} characters with center`}>
                    <span className="mono"><b>{g.slice(0, sp)}</b>{g.slice(sp)}</span>
                  </button>
                )
              })}
            </div>
          ))}
          <span className="geo__circle" style={{ left: `${(px / 5) * 100}%`, top: `${(py / 5) * 100}%`, width: `${(2 * rx / 5) * 100}%`, height: `${(2 * ry / 5) * 100}%` }} />
          <span className="geo__pin" style={{ left: `${(px / 5) * 100}%`, top: `${(py / 5) * 100}%` }} />
        </div>
        <dl className="geo__facts">
          <div><dt>Point</dt><dd>{lat.toFixed(4)}, {lon.toFixed(4)}</dd></div>
          <div><dt>Geohash</dt><dd className="geo__code">{code}</dd></div>
          <div><dt>Cell size</dt><dd>{fmtKm(wKm)} × {fmtKm(hKm)}</dd></div>
          <div><dt>Cell (degrees)</dt><dd>{w.toPrecision(3)}° × {h.toPrecision(3)}°</dd></div>
          <div><dt>Cells to scan</dt><dd>{cellsNeeded}{tooBig ? '+' : ''}</dd></div>
          <p className={`geo__tip ${tooBig ? 'is-warn' : ''}`}>
            {tooBig ? 'Radius spans more than the 3×3 neighborhood. Drop to a lower precision so fewer, larger cells cover it.'
              : 'Query: WHERE geohash LIKE prefix% for each highlighted cell, then filter by exact distance.'}
          </p>
        </dl>
      </div>
    </DemoFrame>
  )
}
