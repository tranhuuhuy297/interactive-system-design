import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Badge, DemoFrame, Segmented, Slider } from '../../components/ui'
import { OtSimulation, describe, diffToOps, type Mode, type Op } from './collab-ot-model'
import './collab-demos.css'

const INITIAL = 'hello world'
const TICK = 50

export function CollabOtSyncDemo() {
  const [mode, setMode] = useState<Mode>('ot')
  const [sim, setSim] = useState(() => new OtSimulation(INITIAL, 'ot'))
  const [, setFrame] = useState(0)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const prevDocs = useRef<string[]>([INITIAL, INITIAL])

  useEffect(() => {
    const t = setInterval(() => { sim.advance(TICK); setFrame((f) => f + 1) }, TICK)
    return () => clearInterval(t)
  }, [sim])

  // Keep each caret stable when a remote edit lands before it.
  useLayoutEffect(() => {
    sim.clients.forEach((c, i) => {
      const el = inputs.current[i]
      const prev = prevDocs.current[i]
      if (el && prev !== c.doc && document.activeElement === el && el.dataset.local !== '1') {
        let p = 0
        while (p < prev.length && p < c.doc.length && prev[p] === c.doc[p]) p++
        const caret = (el.selectionStart ?? 0) + ((el.selectionStart ?? 0) > p ? c.doc.length - prev.length : 0)
        el.setSelectionRange(caret, caret)
      }
      if (el) el.dataset.local = '0'
      prevDocs.current[i] = c.doc
    })
  })

  const reset = (m: Mode = mode) => {
    const next = new OtSimulation(INITIAL, m)
    sim.delays.forEach((d, i) => next.setDelay(i, d))
    prevDocs.current = [INITIAL, INITIAL]
    setSim(next)
  }

  const edit = (ci: number, value: string) => {
    const el = inputs.current[ci]
    if (el) el.dataset.local = '1'
    diffToOps(sim.clients[ci].doc, value, sim.clients[ci].site).forEach((op) => sim.localEdit(ci, op))
    setFrame((f) => f + 1)
  }

  // Scripted race: A inserts a word while B deletes the word before it, at the same instant.
  const race = () => {
    const a: Op[] = [...'brave '].map((ch, i) => ({ type: 'ins', pos: 6 + i, ch, site: 'A' }))
    const b: Op[] = Array.from({ length: 5 }, () => ({ type: 'del', pos: 0, site: 'B' }))
    a.forEach((op) => sim.localEdit(0, op))
    b.forEach((op) => sim.localEdit(1, op))
    setFrame((f) => f + 1)
  }

  const setDelay = (ci: number, v: number) => { sim.setDelay(ci, v); setFrame((f) => f + 1) }
  const settled = sim.quiescent
  const inflight = (dir: 'up' | 'down', ci: number) =>
    sim.inflight.filter((m) => (dir === 'up' ? m.to === 'server' && m.from === ci : m.to === ci))

  return (
    <DemoFrame title="Two editors, one document: naive apply vs operational transformation"
      hint="Type in both editors, or press “Concurrent edit”. Raise the delays so edits cross in flight."
      onReset={() => reset()}>
      <div className="collab-ot__controls">
        <Segmented label="Sync strategy" value={mode} onChange={(m) => { setMode(m); reset(m) }}
          options={[{ value: 'naive', label: 'Naive apply' }, { value: 'ot', label: 'OT transform' }]} />
        <button className="btn btn--secondary btn--sm" onClick={race}>Concurrent edit</button>
        <span className="collab-ot__status" role="status">
          {!settled ? <Badge tone="neutral">{sim.inflight.length} in flight…</Badge>
            : sim.converged ? <Badge tone="success">Converged</Badge> : <Badge tone="danger">Diverged</Badge>}
        </span>
      </div>

      <div className="collab-ot__grid">
        {sim.clients.map((c, ci) => (
          <div key={c.site} className={`collab-ot__client collab-ot__client--${ci}`}>
            <div className="collab-ot__head">
              <strong>Client {c.site}</strong>
              <span className="collab-ot__meta mono">rev {c.revision}</span>
            </div>
            <input ref={(el) => { inputs.current[ci] = el }} className="collab-ot__input mono" value={c.doc}
              spellCheck={false} aria-label={`Client ${c.site} document`} onChange={(e) => edit(ci, e.target.value)} />
            <Slider label="One-way delay" min={50} max={3000} step={50} value={sim.delays[ci]}
              onChange={(v) => setDelay(ci, v)} format={(v) => `${v} ms`} />
            {mode === 'ot' && (
              <div className="collab-ot__pending mono">
                <span>awaiting ack: {c.outstanding ? describe(c.outstanding) : '—'}</span>
                <span>buffered: {c.buffer.length}</span>
              </div>
            )}
            <div className="collab-ot__wire" aria-label={`Messages between client ${c.site} and server`}>
              {inflight('up', ci).map((m, k) => <span key={`u${k}`} className="collab-ot__msg">↑ {describe(m.op)}</span>)}
              {inflight('down', ci).map((m, k) => <span key={`d${k}`} className="collab-ot__msg collab-ot__msg--down">↓ {describe(m.op)}</span>)}
            </div>
          </div>
        ))}

        <div className="collab-ot__server">
          <div className="collab-ot__head">
            <strong>Server</strong>
            <span className="collab-ot__meta mono">rev {sim.history.length}</span>
          </div>
          <div className="collab-ot__doc mono">{sim.serverDoc || '∅'}</div>
          <ol className="collab-ot__log mono" aria-label="Server operation log">
            {sim.log.length === 0 && <li className="collab-ot__empty">No operations yet.</li>}
            {sim.log.slice(-8).reverse().map((l) => (
              <li key={l.rev} className={l.sent !== l.applied ? 'is-transformed' : ''}>
                <span>#{l.rev} {l.site}</span>
                <span>{l.sent}{l.sent !== l.applied && <> → <b>{l.applied}</b></>}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </DemoFrame>
  )
}
