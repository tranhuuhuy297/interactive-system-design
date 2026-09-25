import { useMemo, useState } from 'react'
import { DemoFrame } from '../../components/ui'
import { randomOrder, replay, rng, stateHash } from './exchange-matching-model'
import type { NewOrder } from './exchange-matching-model'
import './exchange-demos.css'

const makeLog = (n: number): NewOrder[] => { const r = rng(11); return Array.from({ length: n }, (_, i) => randomOrder(i + 1, r)) }

export function ExchangeSequencerReplayDemo() {
  const [log, setLog] = useState<NewOrder[]>(() => makeLog(12))
  const [standbyApplied, setStandbyApplied] = useState(9) // standby lags a few events behind
  const [primaryUp, setPrimaryUp] = useState(true)

  const primary = useMemo(() => replay(log), [log])
  const standby = useMemo(() => replay(log.slice(0, standbyApplied)), [log, standbyApplied])
  const caughtUp = standbyApplied === log.length
  const active = primaryUp ? 'primary' : caughtUp ? 'standby' : 'none'

  const addOrder = () => { if (primaryUp) setLog((l) => [...l, randomOrder(l.length + 1, rng(l.length * 97 + 5))]) }
  const reset = () => { setLog(makeLog(12)); setStandbyApplied(9); setPrimaryUp(true) }

  return (
    <DemoFrame title="Sequencer log + deterministic replay failover" onReset={reset}
      hint="Every input is sequenced into one ordered log. Kill the primary: the standby replays the remaining events and reaches the identical state hash before taking over.">
      <div className="xs">
        <div className="xs__log" aria-label="Sequenced event log">
          {log.map((o, i) => (
            <span key={i} className={`xs__evt ${i < standbyApplied ? 'is-applied' : ''}`} title={`${o.side} ${o.type} ${o.qty}@${o.price}`}>
              <b className="mono">{i + 1}</b>{o.side === 'buy' ? 'B' : 'S'}
            </span>
          ))}
        </div>
        <div className="xs__nodes">
          <div className={`xs__node ${primaryUp ? '' : 'is-down'} ${active === 'primary' ? 'is-active' : ''}`}>
            <strong>Primary engine</strong>
            <span>{primaryUp ? `seq ${log.length}` : 'crashed'}</span>
            <code className="mono">{primaryUp ? stateHash(primary) : '——'}</code>
          </div>
          <div className={`xs__node ${active === 'standby' ? 'is-active' : ''}`}>
            <strong>Standby engine</strong>
            <span>seq {standbyApplied} {caughtUp ? '· in sync' : `· ${log.length - standbyApplied} behind`}</span>
            <code className="mono">{stateHash(standby)}</code>
          </div>
        </div>
        <div className="xs__actions">
          <button className="btn btn--secondary btn--sm" onClick={addOrder} disabled={!primaryUp}>Sequence new order</button>
          <button className="btn btn--secondary btn--sm" onClick={() => setStandbyApplied((n) => Math.min(log.length, n + 1))} disabled={caughtUp}>Standby: apply next</button>
          <button className="btn btn--secondary btn--sm" onClick={() => setStandbyApplied(log.length)} disabled={caughtUp}>Standby: replay to tail</button>
          <button className="btn btn--primary btn--sm" onClick={() => setPrimaryUp((u) => !u)}>{primaryUp ? 'Kill primary' : 'Restart primary'}</button>
        </div>
        <p className={`xs__status ${active === 'none' ? 'is-warn' : ''}`} role="status">
          {active === 'primary' && 'Primary is matching. The standby consumes the same log asynchronously.'}
          {active === 'none' && 'No engine is serving. The standby must replay to the log tail before it can safely take over.'}
          {active === 'standby' && `Standby took over at seq ${log.length}. Its state hash matches the pre-crash primary, because matching is a pure function of the ordered log.`}
        </p>
      </div>
    </DemoFrame>
  )
}
