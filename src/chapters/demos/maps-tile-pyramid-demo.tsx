import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import {
  children, formatBytes, formatCount, metersPerPixel, parent, quadkey, tileWidthKm, tilesAtZoom, tilesThroughZoom,
} from './maps-tile-model'
import type { Tile } from './maps-tile-model'
import './maps-demos.css'

// Illustrative average tile sizes; real sizes vary hugely (ocean tiles compress to almost nothing).
const AVG_BYTES = { vector: 25_000, raster: 40_000 } as const
type Format = keyof typeof AVG_BYTES

export function MapsTilePyramidDemo() {
  const [z, setZ] = useState(12)
  const [format, setFormat] = useState<Format>('vector')
  const [sel, setSel] = useState<Tile>({ z: 2, x: 1, y: 1 })

  // The clickable grid shows the selected tile's level (capped at 4 = 16×16 cells).
  const gridZ = Math.min(sel.z, 4)
  const side = 2 ** gridZ
  const kids = sel.z < 22 ? children(sel) : []
  const up = parent(sel)
  const storage = tilesThroughZoom(z) * AVG_BYTES[format]

  return (
    <DemoFrame title="Tile pyramid: every zoom level quadruples the tiles"
      hint="Slide the zoom to size storage. Click a tile to walk the quadtree: every tile has one parent and four children.">
      <div className="maps-tp">
        <div className="demo-controls">
          <Slider label="Max zoom level" min={0} max={22} value={z} onChange={setZ} format={(v) => `z${v}`} />
          <Segmented label="Tile format" value={format} onChange={setFormat}
            options={[{ value: 'vector', label: 'Vector' }, { value: 'raster', label: 'Raster PNG' }]} />
          <dl className="maps-kv">
            <div><dt>Tiles at z{z}</dt><dd className="mono">{formatCount(tilesAtZoom(z))}</dd></div>
            <div><dt>Tiles z0–z{z}</dt><dd className="mono">{formatCount(tilesThroughZoom(z))}</dd></div>
            <div><dt>Tile width (equator)</dt><dd className="mono">{tileWidthKm(z) >= 1 ? `${tileWidthKm(z).toFixed(1)} km` : `${(tileWidthKm(z) * 1000).toFixed(0)} m`}</dd></div>
            <div><dt>Ground resolution</dt><dd className="mono">{metersPerPixel(z).toFixed(metersPerPixel(z) < 1 ? 2 : 0)} m/px</dd></div>
            <div><dt>Naive storage</dt><dd className="mono maps-kv__hl">{formatBytes(storage)}</dd></div>
          </dl>
          <p className="maps-note">
            Naive = every tile pre-rendered at ~{AVG_BYTES[format] / 1000} KB (illustrative). About 70% of Earth is
            ocean and most land is empty, so real systems dedupe identical tiles and render sparse deep zooms on demand.
          </p>
        </div>

        <div className="maps-tp__right">
          <div className="maps-tp__grid" style={{ gridTemplateColumns: `repeat(${side}, 1fr)` }}>
            {Array.from({ length: side * side }, (_, i) => {
              const x = i % side
              const y = Math.floor(i / side)
              const active = sel.z <= 4 && x === sel.x && y === sel.y
              return (
                <button key={i} className={`maps-tp__tile ${active ? 'is-active' : ''}`}
                  aria-label={`Tile z${gridZ} x${x} y${y}`} aria-pressed={active}
                  onClick={() => setSel({ z: gridZ, x, y })} />
              )
            })}
          </div>
          <div className="maps-tp__info">
            <div><span className="demo-label">Selected</span> <code className="mono">{sel.z}/{sel.x}/{sel.y}</code></div>
            <div><span className="demo-label">Quadkey</span> <code className="mono">{quadkey(sel)}</code></div>
            <div className="maps-tp__nav">
              <button className="btn btn--ghost btn--sm" disabled={!up} onClick={() => up && setSel(up)}>↑ Parent</button>
              {kids.map((k) => (
                <button key={`${k.x}-${k.y}`} className="btn btn--secondary btn--sm" onClick={() => setSel(k)}>
                  {k.z}/{k.x}/{k.y}
                </button>
              ))}
            </div>
            <p className="maps-note">URL shape: <code className="mono">/tiles/{'{z}/{x}/{y}'}.pbf</code>. It's immutable per map version, so it caches perfectly at the CDN.</p>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
