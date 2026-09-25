import { useEffect, useMemo, useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import './mq-demos.css'

type Strategy = 'commit-first' | 'process-first'
type Line = { kind: 'commit' | 'apply' | 'dup' | 'skip' | 'crash' | 'restart'; text: string }

const EVENTS = ['pay-1', 'pay-2', 'pay-3', 'pay-4', 'pay-5']

/** Replays a consumer over 5 payment events with one crash, returning the action log and ledger. */
function simulate(strategy: Strategy, crashAt: number, dedup: boolean) {
  const lines: Line[] = []
  const applied: string[] = []
  const seen = new Set<string>()
  let committed = 0
  let crashed = false

  const process = (id: string) => {
    if (dedup && seen.has(id)) { lines.push({ kind: 'skip', text: `${id}: already in processed_ids → skip` }); return }
    const dup = applied.includes(id)
    applied.push(id)
    seen.add(id)
    lines.push({ kind: dup ? 'dup' : 'apply', text: `${id}: balance += $10${dup ? '  ← applied twice!' : ''}${dedup ? ' (+ insert id, same txn)' : ''}` })
  }

  while (committed < EVENTS.length) {
    const i = committed
    const id = EVENTS[i]
    const willCrash = !crashed && i === crashAt
    if (strategy === 'commit-first') {
      committed = i + 1
      lines.push({ kind: 'commit', text: `commit offset ${committed}` })
      if (willCrash) { crashed = true; lines.push({ kind: 'crash', text: `💥 crash before processing ${id}` }, { kind: 'restart', text: `restart from committed offset ${committed}` }); continue }
      process(id)
    } else {
      process(id)
      if (willCrash) { crashed = true; lines.push({ kind: 'crash', text: `💥 crash before committing offset ${i + 1}` }, { kind: 'restart', text: `restart from committed offset ${committed}` }); continue }
      committed = i + 1
      lines.push({ kind: 'commit', text: `commit offset ${committed}` })
    }
  }
  const unique = new Set(applied)
  return { lines, balance: applied.length * 10, missing: EVENTS.filter((e) => !unique.has(e)), dupes: applied.length - unique.size }
}

export function MqDeliverySemanticsDemo() {
  const [strategy, setStrategy] = useState<Strategy>('process-first')
  const [crash, setCrash] = useState('2')
  const [dedup, setDedup] = useState<'off' | 'on'>('off')
  const result = useMemo(() => simulate(strategy, crash === 'none' ? -1 : Number(crash), dedup === 'on'), [strategy, crash, dedup])
  const [shown, setShown] = useState(0)

  useEffect(() => {
    setShown(0)
    const id = setInterval(() => setShown((s) => (s >= result.lines.length ? s : s + 1)), 280)
    return () => clearInterval(id)
  }, [result])

  const done = shown >= result.lines.length
  const verdict = result.missing.length ? 'Money lost' : result.dupes ? 'Double charge' : 'Correct'

  return (
    <DemoFrame title="Delivery semantics: crash a consumer mid-flight"
      hint="Five $10 payment events. The consumer crashes once while handling the selected event, then restarts from its last committed offset.">
      <div className="ds__controls">
        <div><span className="demo-label">Order of operations</span>
          <Segmented label="Strategy" value={strategy} onChange={setStrategy}
            options={[{ value: 'commit-first', label: 'Commit → process (at-most-once)' }, { value: 'process-first', label: 'Process → commit (at-least-once)' }]} /></div>
        <div><span className="demo-label">Crash while handling</span>
          <Segmented label="Crash point" value={crash} onChange={setCrash}
            options={[{ value: 'none', label: 'none' }, ...EVENTS.map((e, i) => ({ value: String(i), label: e }))]} /></div>
        <div><span className="demo-label">Idempotent consumer (dedup table)</span>
          <Segmented label="Dedup" value={dedup} onChange={setDedup} options={['off', 'on'] as const} /></div>
      </div>

      <div className="ds__body">
        <ol className="ds__log mono">
          {result.lines.slice(0, shown).map((l, i) => <li key={i} className={`ds__line ds__line--${l.kind}`}>{l.text}</li>)}
        </ol>
        <div className={`ds__result ${done ? 'is-done' : ''}`}>
          <span className="demo-label">Ledger</span>
          <strong className="ds__balance mono">${done ? result.balance : '…'}</strong>
          <span className="ds__expected">expected $50</span>
          {done && (
            <span className={`ds__verdict ds__verdict--${verdict === 'Correct' ? 'ok' : 'bad'}`}>
              {verdict}{result.missing.length ? ` (${result.missing.join(', ')})` : ''}{result.dupes ? ` (${result.dupes} duplicate)` : ''}
            </span>
          )}
        </div>
      </div>
    </DemoFrame>
  )
}
