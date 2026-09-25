import { useState } from 'react'
import { DemoFrame } from '../../components/ui'
import { diffMerkle, merkle } from './kv-models'
import './kv-demos.css'

const KEYS = ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7']
const A_VALUES = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace', 'heidi']

/** Position of heap index i in a 4-level binary tree laid out in a 320×170 box. */
const pos = (i: number) => {
  const level = Math.floor(Math.log2(i + 1))
  const first = 2 ** level - 1
  const count = 2 ** level
  return { x: ((i - first + 0.5) / count) * 320, y: 20 + level * 48 }
}

export function KvMerkleDemo() {
  const [changed, setChanged] = useState<Set<number>>(() => new Set([5]))
  const [compared, setCompared] = useState(false)

  const leavesA = KEYS.map((k, i) => `${k}=${A_VALUES[i]}`)
  const leavesB = KEYS.map((k, i) => `${k}=${A_VALUES[i]}${changed.has(i) ? '*' : ''}`)
  const ta = merkle(leavesA) // 15 hashes: cheap enough to recompute every render
  const tb = merkle(leavesB)
  const { visited, diffLeaves } = diffMerkle(ta, tb)

  const toggle = (i: number) => {
    setCompared(false)
    setChanged((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })
  }
  const sync = () => { setChanged(new Set()); setCompared(false) }

  return (
    <DemoFrame title="Merkle trees: find divergent keys by comparing a few hashes" onReset={() => { setChanged(new Set([5])); setCompared(false) }}
      hint="Replica B's highlighted keys differ from replica A. Compare walks down only where hashes mismatch; equal subtrees are skipped entirely.">
      <div className="kv__mkeys" role="group" aria-label="Toggle divergent keys on replica B">
        {KEYS.map((k, i) => (
          <button key={k} className={`kv__mkey ${changed.has(i) ? 'is-diff' : ''}`} aria-pressed={changed.has(i)} onClick={() => toggle(i)}>
            {k}
          </button>
        ))}
        <button className="btn btn--primary btn--sm" onClick={() => setCompared(true)}>Compare A ↔ B</button>
        <button className="btn btn--secondary btn--sm" onClick={sync} disabled={changed.size === 0}>Sync diffs</button>
      </div>

      <svg viewBox="0 0 320 180" className="kv__tree" role="img" aria-label="Merkle tree comparison">
        {ta.map((_, i) => {
          if (i === 0) return null
          const p = pos(i), q = pos(Math.floor((i - 1) / 2))
          return <line key={`l${i}`} x1={q.x} y1={q.y} x2={p.x} y2={p.y} className="kv__tedge" />
        })}
        {ta.map((h, i) => {
          const p = pos(i)
          const state = !compared ? '' : !visited.has(i) ? 'is-skip' : h === tb[i] ? 'is-same' : 'is-diff'
          return (
            <g key={i} className={`kv__tnode ${state}`}>
              <rect x={p.x - 17} y={p.y - 10} width="34" height="20" rx="4" />
              <text x={p.x} y={p.y + 3} textAnchor="middle">{h === tb[i] ? h : `${h.slice(0, 2)}≠${tb[i].slice(0, 2)}`}</text>
            </g>
          )
        })}
        {KEYS.map((k, i) => <text key={k} x={pos(7 + i).x} y={176} textAnchor="middle" className="kv__tlabel">{k}</text>)}
      </svg>

      <div className="kv__mstats">
        <div><span>Hashes compared</span><strong>{compared ? visited.size : '—'}</strong></div>
        <div><span>Keys found out of sync</span><strong>{compared ? diffLeaves.map((d) => KEYS[d]).join(', ') || 'none' : '—'}</strong></div>
        <div><span>At 1B keys, 1 diff</span><strong>≈ 2·log₂(1B) ≈ 60 hashes</strong></div>
      </div>
    </DemoFrame>
  )
}
