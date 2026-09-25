import { useState } from 'react'
import { Button, DemoFrame, Slider } from '../../components/ui'
import './consensus-demos.css'

interface Replica { version: number; up: boolean }

const pickRandom = (ids: number[], k: number) => [...ids].sort(() => Math.random() - 0.5).slice(0, k)

export function ConsensusQuorumPlaygroundDemo() {
  const [n, setN] = useState(5)
  const [w, setW] = useState(3)
  const [r, setR] = useState(3)
  const [reps, setReps] = useState<Replica[]>(() => Array.from({ length: 7 }, () => ({ version: 0, up: true })))
  const [latest, setLatest] = useState(0)
  const [touched, setTouched] = useState<{ ids: number[]; kind: 'read' | 'write' } | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const nodes = reps.slice(0, n)
  const alive = nodes.map((x, i) => (x.up ? i : -1)).filter((i) => i >= 0)
  const overlap = r + w > n

  const setNClamp = (v: number) => { setN(v); setW((x) => Math.min(x, v)); setR((x) => Math.min(x, v)) }
  const toggle = (i: number) => setReps((rs) => rs.map((x, j) => (j === i ? { ...x, up: !x.up } : x)))

  const write = () => {
    if (alive.length < w) { setResult({ ok: false, text: `Write FAILED: only ${alive.length} replicas up, need W=${w} acks. Unavailable for writes.` }); setTouched(null); return }
    const v = latest + 1
    // The coordinator acks after W replicas; the rest miss this write until repair.
    const ids = pickRandom(alive, w)
    setReps((rs) => rs.map((x, j) => (ids.includes(j) ? { ...x, version: v } : x)))
    setLatest(v); setTouched({ ids, kind: 'write' })
    setResult({ ok: true, text: `Wrote v${v} to ${w} replicas (${ids.map((i) => `R${i + 1}`).join(', ')}) and acked.` })
  }

  const read = () => {
    if (alive.length < r) { setResult({ ok: false, text: `Read FAILED: only ${alive.length} replicas up, need R=${r}. Unavailable for reads.` }); setTouched(null); return }
    const ids = pickRandom(alive, r)
    const got = Math.max(...ids.map((i) => reps[i].version))
    setTouched({ ids, kind: 'read' })
    setResult(got === latest
      ? { ok: true, text: `Read R=${r} (${ids.map((i) => `R${i + 1}`).join(', ')}) → newest seen v${got}. Fresh ✓` }
      : { ok: false, text: `Read R=${r} (${ids.map((i) => `R${i + 1}`).join(', ')}) → v${got}, but latest is v${latest}. STALE READ ✗` })
  }

  const repair = () => {
    setReps((rs) => rs.map((x, j) => (j < n && x.up ? { ...x, version: latest } : x)))
    setResult({ ok: true, text: 'Anti-entropy / read repair: all live replicas brought up to date.' }); setTouched(null)
  }

  const reset = () => { setN(5); setW(3); setR(3); setReps(Array.from({ length: 7 }, () => ({ version: 0, up: true }))); setLatest(0); setTouched(null); setResult(null) }

  return (
    <DemoFrame title="Quorum playground (N, R, W)" onReset={reset}
      hint="Click a replica to crash or restore it. Write, then read. Try R + W ≤ N and read a few times until you hit a stale read.">
      <div className="qrm__controls">
        <Slider label="N replicas" min={1} max={7} value={n} onChange={setNClamp} />
        <Slider label="W (write acks)" min={1} max={n} value={w} onChange={setW} />
        <Slider label="R (read replies)" min={1} max={n} value={r} onChange={setR} />
      </div>
      <div className={`qrm__rule ${overlap ? 'is-ok' : 'is-bad'}`}>
        R + W = {r + w} {overlap ? '>' : '≤'} N = {n} → {overlap ? 'every read quorum overlaps every write quorum: reads see the latest acked write' : 'quorums may not overlap: stale reads possible'}
        <span className="mono"> · tolerates {Math.max(0, n - w)} down for writes, {Math.max(0, n - r)} for reads</span>
      </div>

      <div className="qrm__nodes">
        {nodes.map((x, i) => {
          const hit = touched?.ids.includes(i)
          return (
            <button key={i} onClick={() => toggle(i)} aria-pressed={!x.up} aria-label={`Replica ${i + 1}, version ${x.version}, ${x.up ? 'up' : 'down'}`}
              className={`qrm__node ${x.up ? '' : 'is-down'} ${hit ? `is-${touched!.kind}` : ''} ${x.version === latest && latest > 0 ? 'is-fresh' : ''}`}>
              <span>R{i + 1}</span>
              <b className="mono">v{x.version}</b>
              <small>{x.up ? (x.version === latest ? 'latest' : 'stale') : 'down'}</small>
            </button>
          )
        })}
      </div>

      <div className="qrm__actions">
        <Button variant="primary" size="sm" onClick={write}>Write v{latest + 1}</Button>
        <Button size="sm" onClick={read}>Read</Button>
        <Button size="sm" variant="ghost" onClick={repair}>Run repair</Button>
      </div>
      {result && <p className={`qrm__result ${result.ok ? 'is-ok' : 'is-bad'}`} role="status">{result.text}</p>}
    </DemoFrame>
  )
}
