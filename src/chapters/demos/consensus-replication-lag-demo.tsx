import { useEffect, useState } from 'react'
import { Button, DemoFrame, Segmented, Slider } from '../../components/ui'
import './consensus-demos.css'

type Policy = 'any' | 'ryw' | 'sticky'
interface Write { value: string; at: number }
interface ReadLog { from: string; value: string; stale: boolean; backwards: boolean }

const REPLICAS = [{ name: 'Leader', lagFactor: 0 }, { name: 'Replica A', lagFactor: 0.4 }, { name: 'Replica B', lagFactor: 1 }]
const NAMES = ['Ada', 'Grace', 'Linus', 'Barbara', 'Ken', 'Margaret', 'Dennis']

/** Number of writes applied on a replica at time `now`, given its replication delay (writes apply in order). */
function appliedCount(writes: Write[], delay: number, now: number) {
  let n = 0
  for (const w of writes) if (w.at + delay <= now) n++
  return n
}
const valueAt = (writes: Write[], n: number) => (n ? writes[n - 1].value : 'Alan')
const visible = (writes: Write[], delay: number, now: number) => valueAt(writes, appliedCount(writes, delay, now))

export function ConsensusReplicationLagDemo() {
  const [lag, setLag] = useState(2500)
  const [policy, setPolicy] = useState<Policy>('any')
  const [writes, setWrites] = useState<Write[]>([])
  const [reads, setReads] = useState<ReadLog[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [lastSeen, setLastSeen] = useState(0)

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t) }, [])

  const lastWriteAt = writes.length ? writes[writes.length - 1].at : 0

  const update = () => {
    const value = NAMES[writes.length % NAMES.length]
    setWrites((w) => [...w, { value, at: Date.now() }])
  }

  const read = () => {
    const t = Date.now()
    let idx: number
    if (policy === 'ryw' && t - lastWriteAt < lag + 500) idx = 0            // own recent write → read leader
    else if (policy === 'sticky') idx = 2                                    // always the same replica
    else idx = Math.floor(Math.random() * REPLICAS.length)
    const rep = REPLICAS[idx]
    const version = appliedCount(writes, rep.lagFactor * lag, t)
    const value = valueAt(writes, version)
    const backwards = version < lastSeen
    setLastSeen(Math.max(lastSeen, version))
    setReads((r) => [{ from: rep.name, value, stale: version < writes.length, backwards }, ...r].slice(0, 6))
  }

  const reset = () => { setWrites([]); setReads([]); setLastSeen(0) }

  return (
    <DemoFrame title="Replication lag: read-your-writes & monotonic reads" onReset={reset}
      hint="Update your display name, then immediately refresh the profile a few times. Then switch the routing policy.">
      <div className="lag__controls">
        <div className="lag__slider"><Slider label="Max replication lag" min={0} max={5000} step={250} value={lag} onChange={setLag} format={(v) => `${(v / 1000).toFixed(2)} s`} /></div>
        <Segmented label="Read routing" value={policy} onChange={setPolicy} options={[
          { value: 'any', label: 'Any replica' }, { value: 'ryw', label: 'Read-your-writes' }, { value: 'sticky', label: 'Sticky replica' },
        ]} />
      </div>

      <div className="lag__replicas">
        {REPLICAS.map((r) => {
          const v = visible(writes, r.lagFactor * lag, now)
          const fresh = appliedCount(writes, r.lagFactor * lag, now) === writes.length
          return (
            <div key={r.name} className={`lag__rep ${fresh ? 'is-fresh' : 'is-stale'}`}>
              <span className="demo-label">{r.name} · lag {(r.lagFactor * lag / 1000).toFixed(1)}s</span>
              <strong>{v}</strong>
            </div>
          )
        })}
      </div>

      <div className="lag__actions">
        <Button variant="primary" size="sm" onClick={update}>Update name → {NAMES[writes.length % NAMES.length]}</Button>
        <Button size="sm" onClick={read}>Refresh profile</Button>
      </div>

      <ul className="lag__reads" aria-live="polite">
        {reads.length === 0 && <li className="lag__empty">No reads yet.</li>}
        {reads.map((r, i) => (
          <li key={i} className={r.stale ? 'is-stale' : 'is-fresh'}>
            <span className="mono">{r.from}</span> → <b>{r.value}</b>
            {r.backwards ? <em className="is-bad">went backwards in time (monotonic-read violation)</em>
              : r.stale ? <em className="is-warn">stale: you just changed this!</em> : <em className="is-ok">fresh</em>}
          </li>
        ))}
      </ul>
    </DemoFrame>
  )
}
