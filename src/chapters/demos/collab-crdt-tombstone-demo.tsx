import { useState } from 'react'
import { Badge, DemoFrame } from '../../components/ui'
import {
  cloneReplica, createReplica, idKey, localDelete, localInsert, pull, seedElems, text, visible, type Replica,
} from './collab-crdt-model'
import './collab-demos.css'

const fresh = () => [createReplica('A', seedElems('CAT')), createReplica('B', seedElems('CAT'))]

export function CollabCrdtTombstoneDemo() {
  const [reps, setReps] = useState<Replica[]>(fresh)
  const [pos, setPos] = useState([1, 1])
  const [chars, setChars] = useState(['H', 'O'])

  const update = (fn: (rs: Replica[]) => void) => setReps((prev) => { const next = prev.map(cloneReplica); fn(next); return next })

  const insert = (ri: number) => {
    const ch = chars[ri].slice(0, 1)
    if (!ch) return
    update((rs) => localInsert(rs[ri], Math.min(pos[ri], visible(rs[ri]).length), ch))
  }
  const sync = () => update(([a, b]) => { const a0 = cloneReplica(a); pull(a, b); pull(b, a0) })
  const concurrent = () => {
    setReps(() => {
      const rs = fresh()
      localInsert(rs[0], 1, 'H')
      localInsert(rs[1], 1, 'O')
      return rs
    })
  }

  const unsynced = (ri: number) => reps[1 - ri].log.filter((op) => !reps[ri].seen.has(`${op.kind}:${idKey(op.id)}`)).length
  const synced = unsynced(0) === 0 && unsynced(1) === 0

  return (
    <DemoFrame title="Sequence CRDT: every character has an id, deletes leave tombstones"
      hint="Insert on each replica independently, click a character to delete it, then sync. Order is decided by ids, not by who arrived first."
      onReset={() => setReps(fresh())}>
      <div className="collab-ot__controls">
        <button className="btn btn--secondary btn--sm" onClick={concurrent}>Concurrent insert at same spot</button>
        <button className="btn btn--primary btn--sm" onClick={sync}>Sync replicas</button>
        <span className="collab-ot__status" role="status">
          {synced
            ? <Badge tone={text(reps[0]) === text(reps[1]) ? 'success' : 'danger'}>{text(reps[0]) === text(reps[1]) ? 'Converged' : 'Diverged'}</Badge>
            : <Badge tone="neutral">{unsynced(0) + unsynced(1)} ops not yet exchanged</Badge>}
        </span>
      </div>

      <div className="collab-crdt__grid">
        {reps.map((r, ri) => (
          <div key={r.site} className="collab-crdt__replica">
            <div className="collab-ot__head">
              <strong>Replica {r.site}</strong>
              <span className="collab-ot__meta mono">clock {r.clock} · shows “{text(r)}”</span>
            </div>
            <ul className="collab-crdt__strip" aria-label={`Replica ${r.site} elements including tombstones`}>
              {r.elems.map((e) => (
                <li key={idKey(e.id)}>
                  <button className={`collab-crdt__char ${e.deleted ? 'is-dead' : ''} ${e.id.s === r.site ? 'is-local' : ''}`}
                    disabled={e.deleted} onClick={() => update((rs) => localDelete(rs[ri], e.id))}
                    aria-label={`${e.ch}, id ${idKey(e.id)}${e.deleted ? ', deleted' : ', press to delete'}`}>
                    <span className="collab-crdt__ch">{e.ch}</span>
                    <span className="collab-crdt__id mono">{idKey(e.id)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="collab-crdt__form">
              <label>
                <span>at</span>
                <select value={Math.min(pos[ri], visible(r).length)} onChange={(e) => setPos((p) => p.map((v, i) => (i === ri ? Number(e.target.value) : v)))}>
                  {Array.from({ length: visible(r).length + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </label>
              <input className="mono" maxLength={1} value={chars[ri]} aria-label={`Character to insert on replica ${r.site}`}
                onChange={(e) => setChars((c) => c.map((v, i) => (i === ri ? e.target.value : v)))} />
              <button className="btn btn--secondary btn--sm" onClick={() => insert(ri)}>Insert</button>
            </div>
            <p className="collab-crdt__note">Metadata: {r.elems.length} elements stored for {text(r).length} visible characters.</p>
          </div>
        ))}
      </div>
    </DemoFrame>
  )
}
