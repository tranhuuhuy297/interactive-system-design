import { useState } from 'react'
import { DemoFrame } from '../../components/ui'
import './db-demos.css'

type Level = 'RU' | 'RC' | 'RR' | 'SI' | 'SER'
type Anomaly = 'dirty' | 'nonrepeat' | 'phantom' | 'lost' | 'skew'

const LEVELS: { id: Level; label: string; note: string }[] = [
  { id: 'RU', label: 'Read Uncommitted', note: 'Rarely used on purpose.' },
  { id: 'RC', label: 'Read Committed', note: 'Default in PostgreSQL, Oracle, SQL Server.' },
  { id: 'RR', label: 'Repeatable Read (lock-based)', note: 'The SQL-standard definition. Shared row locks held to commit.' },
  { id: 'SI', label: 'Snapshot Isolation', note: 'PostgreSQL’s “REPEATABLE READ” is SI. MySQL InnoDB RR is similar but allows lost updates.' },
  { id: 'SER', label: 'Serializable', note: 'Via 2PL, SSI (PostgreSQL), or actual serial execution.' },
]

const ANOMALIES: { id: Anomaly; label: string; t1: string[]; t2: string[]; why: string }[] = [
  { id: 'dirty', label: 'Dirty read',
    t1: ['BEGIN', 'UPDATE acct SET bal = 0 WHERE id = 1', '', 'ROLLBACK'],
    t2: ['BEGIN', '', 'SELECT bal … → 0 ⚠ never committed', 'COMMIT'],
    why: 'T2 saw a value that never officially existed.' },
  { id: 'nonrepeat', label: 'Non-repeatable read',
    t1: ['BEGIN', 'SELECT bal … → 100', '', 'SELECT bal … → 50 ⚠'],
    t2: ['BEGIN', '', 'UPDATE bal = 50; COMMIT', ''],
    why: 'The same row read twice in one transaction returned different values.' },
  { id: 'phantom', label: 'Phantom read',
    t1: ['BEGIN', 'SELECT count(*) WHERE room=7 → 0', '', 'SELECT count(*) WHERE room=7 → 1 ⚠'],
    t2: ['BEGIN', '', 'INSERT booking(room=7); COMMIT', ''],
    why: 'A new row appeared matching a predicate the transaction already evaluated. Row locks cannot stop it; predicate or range locks can.' },
  { id: 'lost', label: 'Lost update',
    t1: ['BEGIN', 'SELECT likes → 10', '', 'UPDATE likes = 11; COMMIT'],
    t2: ['BEGIN', 'SELECT likes → 10', 'UPDATE likes = 11; COMMIT', ''],
    why: 'Read-modify-write cycles overlapped, so one increment vanished. Fix with atomic UPDATE likes = likes + 1, SELECT … FOR UPDATE, or CAS.' },
  { id: 'skew', label: 'Write skew',
    t1: ['BEGIN', 'SELECT count(on_call) → 2', 'UPDATE me SET on_call = false', 'COMMIT'],
    t2: ['BEGIN', 'SELECT count(on_call) → 2', 'UPDATE me2 SET on_call = false', 'COMMIT ⚠ 0 doctors on call'],
    why: 'Each transaction checked an invariant, then wrote a different row. Neither write conflicted, yet the invariant broke. Only serializable isolation (or explicit locking / materialised conflicts) prevents it.' },
]

// true = anomaly possible at this level
const MATRIX: Record<Level, Record<Anomaly, boolean>> = {
  RU: { dirty: true, nonrepeat: true, phantom: true, lost: true, skew: true },
  RC: { dirty: false, nonrepeat: true, phantom: true, lost: true, skew: true },
  RR: { dirty: false, nonrepeat: false, phantom: true, lost: false, skew: true },
  SI: { dirty: false, nonrepeat: false, phantom: false, lost: false, skew: true },
  SER: { dirty: false, nonrepeat: false, phantom: false, lost: false, skew: false },
}

export function DbIsolationAnomaliesDemo() {
  const [sel, setSel] = useState<{ level: Level; anomaly: Anomaly }>({ level: 'SI', anomaly: 'skew' })
  const a = ANOMALIES.find((x) => x.id === sel.anomaly)!
  const lv = LEVELS.find((x) => x.id === sel.level)!
  const possible = MATRIX[sel.level][sel.anomaly]

  return (
    <DemoFrame title="Isolation levels × anomalies" onReset={() => setSel({ level: 'SI', anomaly: 'skew' })}
      hint="Click any cell to replay the interleaving and see whether that level allows it.">
      <div className="iso__wrap">
        <table className="iso__table">
          <thead>
            <tr><th />{ANOMALIES.map((x) => <th key={x.id} scope="col">{x.label}</th>)}</tr>
          </thead>
          <tbody>
            {LEVELS.map((l) => (
              <tr key={l.id}>
                <th scope="row">{l.label}</th>
                {ANOMALIES.map((x) => {
                  const p = MATRIX[l.id][x.id]
                  const active = sel.level === l.id && sel.anomaly === x.id
                  return (
                    <td key={x.id}>
                      <button className={`iso__cell ${p ? 'is-yes' : 'is-no'} ${active ? 'is-active' : ''}`}
                        onClick={() => setSel({ level: l.id, anomaly: x.id })} aria-pressed={active}
                        aria-label={`${l.label}, ${x.label}: ${p ? 'possible' : 'prevented'}`}>
                        {p ? 'possible' : 'prevented'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="iso__scenario">
        <div className="iso__timeline">
          <div className="iso__lane"><span className="iso__who">T1</span>{a.t1.map((s, i) => <code key={i} className={s ? '' : 'is-gap'}>{s || '·'}</code>)}</div>
          <div className="iso__lane"><span className="iso__who">T2</span>{a.t2.map((s, i) => <code key={i} className={s ? '' : 'is-gap'}>{s || '·'}</code>)}</div>
        </div>
        <div className={`iso__verdict ${possible ? 'is-yes' : 'is-no'}`}>
          <strong>{a.label} under {lv.label}: {possible ? 'CAN happen' : 'prevented'}</strong>
          <p>{a.why}</p>
          <p className="iso__note">{lv.note}</p>
        </div>
      </div>
    </DemoFrame>
  )
}
