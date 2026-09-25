import { useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button, DemoFrame, Slider } from '../../components/ui'
import { buildRing, hash32, imbalancePct, ringOwner } from './lb-hash-ring-math'
import './lb-demos.css'

const COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)', 'var(--warning)', 'var(--danger)', 'oklch(72% 0.15 330)', 'oklch(75% 0.12 180)', 'oklch(70% 0.1 60)']
const KEYS = Array.from({ length: 240 }, (_, i) => `user:${i * 7919}`)
const R = 118
const C = 150

const angle = (h: number) => (h / 2 ** 32) * Math.PI * 2 - Math.PI / 2
const pt = (h: number, r: number) => ({ x: C + r * Math.cos(angle(h)), y: C + r * Math.sin(angle(h)) })

function assign(servers: string[], vnodes: number) {
  const ring = buildRing(servers, vnodes)
  const ringMap = new Map<string, string>()
  const modMap = new Map<string, string>()
  for (const k of KEYS) {
    const h = hash32(k)
    ringMap.set(k, ringOwner(ring, h))
    modMap.set(k, servers[h % servers.length])
  }
  return { ring, ringMap, modMap }
}

export function LbConsistentHashRingDemo() {
  const [count, setCount] = useState(4)
  const [prevCount, setPrevCount] = useState<number | null>(null)
  const [vnodes, setVnodes] = useState(1)

  const servers = useMemo(() => Array.from({ length: count }, (_, i) => `S${i + 1}`), [count])
  const cur = useMemo(() => assign(servers, vnodes), [servers, vnodes])
  const prev = useMemo(
    () => (prevCount == null ? null : assign(Array.from({ length: prevCount }, (_, i) => `S${i + 1}`), vnodes)),
    [prevCount, vnodes],
  )

  const moved = (a: Map<string, string>, b: Map<string, string>) => (KEYS.filter((k) => a.get(k) !== b.get(k)).length / KEYS.length) * 100
  const ringMoved = prev ? moved(prev.ringMap, cur.ringMap) : null
  const modMoved = prev ? moved(prev.modMap, cur.modMap) : null
  const loads = servers.map((s) => KEYS.filter((k) => cur.ringMap.get(k) === s).length)
  const maxLoad = Math.max(...loads, 1)
  const colorOf = (s: string) => COLORS[(Number(s.slice(1)) - 1) % COLORS.length]

  const change = (delta: number) => {
    const next = Math.min(8, Math.max(1, count + delta))
    if (next === count) return
    setPrevCount(count)
    setCount(next)
  }

  return (
    <DemoFrame title="Consistent hash ring vs hash % N" onReset={() => { setCount(4); setPrevCount(null); setVnodes(1) }}
      hint="Add or remove a server and compare how many of the 240 keys have to move. Then raise the virtual-node count and watch the load even out.">
      <div className="lbr">
        <svg viewBox="0 0 300 300" className="lbr__svg" role="img" aria-label={`Hash ring with ${count} servers and ${vnodes} virtual nodes each`}>
          <circle cx={C} cy={C} r={R} className="lbr__track" />
          {KEYS.map((k) => {
            const p = pt(hash32(k), R - 14)
            return <circle key={k} cx={p.x} cy={p.y} r={2.4} fill={colorOf(cur.ringMap.get(k)!)} opacity={0.85} />
          })}
          {cur.ring.map((p, i) => {
            const a = pt(p.pos, R - 6); const b = pt(p.pos, R + 8)
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colorOf(p.server)} strokeWidth={vnodes > 20 ? 1.2 : 2.5} strokeLinecap="round" />
          })}
          <text x={C} y={C - 4} textAnchor="middle" className="lbr__center">{count} servers</text>
          <text x={C} y={C + 14} textAnchor="middle" className="lbr__center lbr__center--sub">{cur.ring.length} ring points</text>
        </svg>

        <div className="demo-controls">
          <div className="lbr__btns">
            <Button size="sm" onClick={() => change(-1)} disabled={count <= 1} aria-label="Remove server"><Minus size={14} /> Remove server</Button>
            <Button size="sm" variant="primary" onClick={() => change(1)} disabled={count >= 8} aria-label="Add server"><Plus size={14} /> Add server</Button>
          </div>
          <Slider label="Virtual nodes per server" min={1} max={100} value={vnodes} onChange={setVnodes} />

          <div className="lbr__moved">
            <div>
              <span className="demo-label">Keys moved · ring</span>
              <strong className="mono is-good">{ringMoved == null ? '—' : `${ringMoved.toFixed(0)}%`}</strong>
            </div>
            <div>
              <span className="demo-label">Keys moved · hash % N</span>
              <strong className="mono is-bad">{modMoved == null ? '—' : `${modMoved.toFixed(0)}%`}</strong>
            </div>
          </div>
          {prevCount != null && <p className="lbr__note">{prevCount} → {count} servers. Ideal movement is about {(100 / Math.max(count, prevCount)).toFixed(0)}%.</p>}

          <div>
            <span className="demo-label">Keys per server · imbalance {imbalancePct(loads).toFixed(0)}% (std-dev / mean)</span>
            <div className="lbr__bars">
              {servers.map((s, i) => (
                <div key={s} className="lbr__bar">
                  <span>{s}</span>
                  <i style={{ width: `${(loads[i] / maxLoad) * 100}%`, background: colorOf(s) }} />
                  <b className="mono">{loads[i]}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
