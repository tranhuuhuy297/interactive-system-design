import { useState } from 'react'
import { Badge, Button, DemoFrame, Segmented } from '../../components/ui'
import {
  ACCOUNTS, SNAPSHOT_EVERY, TOTAL, apply, decide, emptyState, fold, rebuild, sameState, totalOf,
  type Command, type Outcome, type Snapshot, type WalletEvent, type WalletState,
} from './wallet-event-model'
import './wallet-demos.css'

const PRESETS: { label: string; cmd: Omit<Command, 'id'> }[] = [
  { label: 'Alice → Bob $50', cmd: { from: 'alice', to: 'bob', amount: 50 } },
  { label: 'Alice → Merchant $120', cmd: { from: 'alice', to: 'merchant', amount: 120 } },
  { label: 'Bob → Carol $75', cmd: { from: 'bob', to: 'carol', amount: 75 } },
  { label: 'Carol → Merchant $400', cmd: { from: 'carol', to: 'merchant', amount: 400 } },
]

interface LogRow { cmd: Command; outcome: Outcome }
type Mode = 'on' | 'off'

/** Commands → events → state, with snapshots, crash recovery by replay, and an idempotency toggle. */
export function WalletEventSourcingDemo() {
  const [mode, setMode] = useState<Mode>('on')
  const [state, setState] = useState<WalletState>(emptyState)
  const [events, setEvents] = useState<WalletEvent[]>([])
  const [snaps, setSnaps] = useState<Snapshot[]>([])
  const [cmdLog, setCmdLog] = useState<LogRow[]>([])
  const [crashed, setCrashed] = useState(false)
  const [note, setNote] = useState('Send a transfer to start.')
  const [nextId, setNextId] = useState(1)

  const submit = (cmd: Command) => {
    const d = decide(state, cmd, mode === 'on')
    setCmdLog((l) => [...l, { cmd, outcome: d.outcome }])
    if (!d.event) { setNote(`Retry of ${cmd.id} recognised and ignored: no second transfer.`); return }
    const next = apply(state, d.event)
    setEvents((e) => [...e, d.event!])
    setState(next)
    if (next.seq % SNAPSHOT_EVERY === 0) setSnaps((s) => [...s, { seq: next.seq, balances: { ...next.balances }, applied: [...next.applied] }])
    setNote(d.outcome === 'rejected' ? `${cmd.id} rejected: ${d.event.type === 'Rejected' ? d.event.reason : ''}. Rejections are events too.` : `${cmd.id} accepted as event #${d.event.seq}.`)
  }

  const send = (preset: Omit<Command, 'id'>) => { submit({ ...preset, id: `cmd-${nextId}` }); setNextId((n) => n + 1) }
  const retryLast = () => { const last = [...cmdLog].reverse().find((r) => r.outcome !== 'duplicate-ignored'); if (last) submit(last.cmd) }

  const crash = () => { setCrashed(true); setNote('Process crashed: in-memory balances are gone. The event log and snapshots are durable.') }
  const recover = () => {
    const r = rebuild(events, snaps)
    const ok = sameState(r.state, fold(events))
    setState(r.state); setCrashed(false)
    setNote(`Recovered from snapshot @${r.fromSeq} + replayed ${r.replayed} event(s). ${ok ? 'State identical to a full replay.' : 'Mismatch!'}`)
  }

  const reset = () => { setState(emptyState()); setEvents([]); setSnaps([]); setCmdLog([]); setCrashed(false); setNextId(1); setNote('Send a transfer to start.') }
  const conserved = totalOf(state.balances) === TOTAL
  const doubleApplied = new Set(events.filter((e) => e.type === 'Transferred').map((e) => e.cmdId)).size < events.filter((e) => e.type === 'Transferred').length

  return (
    <DemoFrame title="Event-sourced wallet: commands, events, snapshots, replay" onReset={reset}
      hint="Send transfers, retry one (as a flaky client would), then crash the process and rebuild it from the log.">
      <div className="wlt__bar">
        <Segmented label="Idempotency" value={mode} onChange={setMode}
          options={[{ value: 'on', label: 'Dedupe by command id' }, { value: 'off', label: 'No dedupe' }]} />
        <div className="wlt__actions">
          {PRESETS.map((p) => <Button key={p.label} size="sm" disabled={crashed} onClick={() => send(p.cmd)}>{p.label}</Button>)}
          <Button size="sm" disabled={crashed || !cmdLog.length} onClick={retryLast}>Client retries last</Button>
          {crashed
            ? <Button size="sm" variant="primary" onClick={recover}>Recover by replay</Button>
            : <Button size="sm" variant="ghost" disabled={!events.length} onClick={crash}>Crash process</Button>}
        </div>
      </div>
      <p className="wlt__note" role="status">{note}</p>

      <div className="wlt__grid">
        <section>
          <div className="demo-label">1 · Command log (requests)</div>
          <ol className="wlt__list">
            {cmdLog.length === 0 && <li className="wlt__empty">empty</li>}
            {cmdLog.map((r, i) => (
              <li key={i} className={`wlt__row wlt__row--${r.outcome}`}>
                <span className="mono">{r.cmd.id}</span><span>{r.cmd.from} → {r.cmd.to} ${r.cmd.amount}</span><em>{r.outcome.replace('-', ' ')}</em>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <div className="demo-label">2 · Event log (append-only, durable)</div>
          <ol className="wlt__list">
            {events.length === 0 && <li className="wlt__empty">empty</li>}
            {events.map((e) => (
              <li key={e.seq} className={`wlt__row ${e.type === 'Rejected' ? 'wlt__row--rejected' : ''} ${snaps.some((s) => s.seq === e.seq) ? 'has-snap' : ''}`}>
                <span className="mono">#{e.seq}</span>
                <span>{e.type === 'Transferred' ? `${e.from} −$${e.amount} / ${e.to} +$${e.amount}` : `Rejected (${e.reason})`}</span>
                <em className="mono">{e.cmdId}</em>
              </li>
            ))}
          </ol>
          <p className="wlt__small">Snapshot every {SNAPSHOT_EVERY} events{snaps.length ? `: @${snaps.map((s) => s.seq).join(', @')}` : ''}.</p>
        </section>
        <section>
          <div className="demo-label">3 · State (derived)</div>
          <div className={`wlt__balances ${crashed ? 'is-lost' : ''}`}>
            {ACCOUNTS.map((a) => (
              <div key={a}><span>{a}</span><strong className="mono">{crashed ? '—' : `$${state.balances[a]}`}</strong></div>
            ))}
          </div>
          <div className="wlt__checks">
            <Badge tone={crashed ? 'neutral' : conserved ? 'success' : 'danger'}>Σ = ${crashed ? '?' : totalOf(state.balances)} {conserved ? '(conserved)' : '(broken)'}</Badge>
            {doubleApplied && <Badge tone="danger">a command was applied twice</Badge>}
          </div>
        </section>
      </div>
    </DemoFrame>
  )
}
