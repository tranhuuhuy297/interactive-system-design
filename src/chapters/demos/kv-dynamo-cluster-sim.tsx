import { useState } from 'react'
import { Badge, DemoFrame, Segmented } from '../../components/ui'
import { KEYS, get, initCluster, keyAngle, preferenceList, put, toggleNode } from './kv-models'
import type { Key } from './kv-models'
import './kv-demos.css'

const N = 3
const R_SVG = 88
const pt = (deg: number, r = R_SVG) => {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: 110 + r * Math.cos(a), y: 110 + r * Math.sin(a) }
}

export function KvDynamoClusterSim() {
  const [cluster, setCluster] = useState(initCluster)
  const [key, setKey] = useState<Key>('user:42')
  const [w, setW] = useState('2')
  const [r, setR] = useState('2')
  const [sloppy, setSloppy] = useState(true)

  const W = Number(w), R = Number(r)
  const pref = preferenceList(cluster, key)
  const home = pref.slice(0, N).map((x) => x.id)
  const kp = pt(keyAngle(key), R_SVG + 16)
  const strong = W + R > N

  return (
    <DemoFrame title="Dynamo-style cluster: quorums, hinted handoff, read repair" onReset={() => setCluster(initCluster())}
      hint="Click a node to take it down or up. Try W=1, R=1 then GET right after a PUT (stale read). Take a home replica down, PUT with sloppy quorum, then bring it back up (hinted handoff).">
      <div className="kv__controls">
        <div><div className="demo-label">Key</div><Segmented label="Key" options={KEYS} value={key} onChange={setKey} /></div>
        <div><div className="demo-label">W (write acks)</div><Segmented label="W" options={['1', '2', '3'] as const} value={w} onChange={setW} /></div>
        <div><div className="demo-label">R (read replies)</div><Segmented label="R" options={['1', '2', '3'] as const} value={r} onChange={setR} /></div>
        <label className="kv__toggle">
          <input type="checkbox" checked={sloppy} onChange={(e) => setSloppy(e.target.checked)} /> Sloppy quorum
        </label>
      </div>

      <div className="kv__layout">
        <div className="kv__ringwrap">
          <svg viewBox="0 0 220 220" className="kv__ring" role="img" aria-label="Consistent hash ring with six nodes">
            <circle cx="110" cy="110" r={R_SVG} className="kv__circle" />
            {cluster.nodes.map((n) => {
              const p = pt(n.angle)
              const idx = home.indexOf(n.id)
              return (
                <g key={n.id} className={`kv__node ${n.up ? '' : 'is-down'} ${idx >= 0 ? 'is-home' : ''}`}>
                  <circle cx={p.x} cy={p.y} r="15" />
                  <text x={p.x} y={p.y + 4} textAnchor="middle">{n.id}</text>
                  {idx >= 0 && <text x={p.x + 14} y={p.y - 12} className="kv__rank">{idx + 1}</text>}
                  {n.hints.length > 0 && <text x={p.x - 20} y={p.y - 12} className="kv__hint">✉{n.hints.length}</text>}
                </g>
              )
            })}
            <circle cx={kp.x} cy={kp.y} r="5" className="kv__key" />
            <text x={110} y={114} textAnchor="middle" className="kv__center">{key}</text>
          </svg>
          <div className="kv__nodebtns" role="group" aria-label="Toggle nodes">
            {cluster.nodes.map((n) => (
              <button key={n.id} className={`kv__nbtn ${n.up ? '' : 'is-down'}`} aria-pressed={!n.up}
                onClick={() => setCluster((c) => toggleNode(c, n.id))}>{n.id} {n.up ? 'up' : 'down'}</button>
            ))}
          </div>
        </div>

        <div className="kv__side">
          <div className="kv__actions">
            <button className="btn btn--primary btn--sm" onClick={() => setCluster((c) => put(c, key, N, W, sloppy))}>PUT {key}</button>
            <button className="btn btn--secondary btn--sm" onClick={() => setCluster((c) => get(c, key, N, R, sloppy))}>GET {key}</button>
            <Badge tone={strong ? 'success' : 'warning'}>W+R {strong ? '>' : '≤'} N · {strong ? 'overlapping quorums' : 'stale reads possible'}</Badge>
          </div>
          <table className="kv__table">
            <thead><tr><th>Node</th><th>{key}</th><th>Hints held</th></tr></thead>
            <tbody>
              {pref.map((n) => (
                <tr key={n.id} className={`${n.up ? '' : 'is-down'} ${home.includes(n.id) ? 'is-home' : ''}`}>
                  <td>{n.id}{home.includes(n.id) ? ' ★' : ''}</td>
                  <td className="mono">{n.data[key]?.value ?? '—'}</td>
                  <td className="mono">{n.hints.map((h) => `${h.key}=${h.v.value}→${h.for}`).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="kv__log" aria-live="polite">
            {cluster.log.map((l, i) => <li key={`${i}-${l.text}`} className={`is-${l.tone}`}>{l.text}</li>)}
          </ul>
        </div>
      </div>
    </DemoFrame>
  )
}
