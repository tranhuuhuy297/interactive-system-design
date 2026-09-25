import { useState } from 'react'
import { Badge, Button, DemoFrame } from '../../components/ui'
import { ACCOUNTS, balances, entriesFor, fmt, reconcile, type Entry, type ReconRow, type Txn } from './pay-ledger-model'
import './pay-demos.css'

/** Post transactions to a double-entry ledger, then reconcile against a PSP settlement file. */
export function PayLedgerDemo() {
  const [txns, setTxns] = useState<Txn[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [inject, setInject] = useState(false)
  const [recon, setRecon] = useState<ReconRow[] | null>(null)

  const bal = balances(entries)
  const post = (kind: Txn['kind'], amount: number) => {
    const id = `t${txns.length + 1}`
    const t: Txn = { id, kind, amount, pspRef: kind === 'charge' ? `ch_${1000 + txns.length}` : undefined }
    const es = entriesFor(t, bal.merchant_payable)
    if (!es.length || amount < 0) return
    setTxns((p) => [...p, { ...t, amount: es[0].debit }])
    setEntries((p) => [...p, ...es])
    setRecon(null)
  }

  const runRecon = () => {
    const charges = txns.filter((t) => t.kind === 'charge')
    let file = charges.map((t) => ({ ref: t.pspRef!, amount: t.amount }))
    if (inject && file.length) {
      file = [{ ...file[0], amount: file[0].amount - 100 }, ...file.slice(1), { ref: 'ch_9999', amount: 2500 }]
    }
    setRecon(reconcile(txns, file))
  }

  const reset = () => { setTxns([]); setEntries([]); setRecon(null) }
  const totalDr = entries.reduce((s, e) => s + e.debit, 0)
  const totalCr = entries.reduce((s, e) => s + e.credit, 0)
  const lastCharge = [...txns].reverse().find((t) => t.kind === 'charge')

  return (
    <DemoFrame title="Double-entry ledger + reconciliation" onReset={reset}
      hint="Every event writes balanced entries. Balances are derived by summing entries and are never updated in place.">
      <div className="pay-led__actions">
        <Button size="sm" onClick={() => post('charge', 10_000)}>Charge $100</Button>
        <Button size="sm" onClick={() => post('charge', 4_000)}>Charge $40</Button>
        <Button size="sm" onClick={() => post('refund', 3_000)} disabled={!lastCharge}>Refund $30</Button>
        <Button size="sm" onClick={() => post('settle', bal.psp_receivable)} disabled={bal.psp_receivable <= 0}>PSP settles funds</Button>
        <Button size="sm" onClick={() => post('payout', bal.merchant_payable)} disabled={bal.merchant_payable <= 0}>Pay out merchant</Button>
      </div>

      <div className="pay-led__grid">
        <div>
          <div className="demo-label">Journal (append-only)</div>
          <div className="pay-led__journal">
            {entries.length === 0 && <p className="pay-muted">Post a transaction to see its entries.</p>}
            {entries.map((e, i) => (
              <div key={i} className={`pay-led__entry ${i > 0 && entries[i - 1].txn !== e.txn ? 'is-new-txn' : ''}`}>
                <span className="mono pay-muted">{e.txn}</span>
                <span>{e.account}</span>
                <span className="mono">{e.debit ? `Dr ${fmt(e.debit)}` : ''}</span>
                <span className="mono">{e.credit ? `Cr ${fmt(e.credit)}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="demo-label">Balances (derived)</div>
          <table className="pay-led__bal">
            <tbody>
              {ACCOUNTS.map((a) => (
                <tr key={a.id}><th scope="row">{a.label}</th><td className="mono">{fmt(bal[a.id])}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="pay-led__check">
            <span>Σ debits {fmt(totalDr)} = Σ credits {fmt(totalCr)}</span>
            <Badge tone={totalDr === totalCr ? 'success' : 'danger'}>{totalDr === totalCr ? 'balanced' : 'BROKEN'}</Badge>
          </div>
        </div>
      </div>

      <div className="pay-led__recon">
        <label className="pay-led__toggle">
          <input type="checkbox" checked={inject} onChange={(e) => { setInject(e.target.checked); setRecon(null) }} />
          Inject PSP discrepancies (short-paid fee + unknown charge)
        </label>
        <Button size="sm" variant="primary" onClick={runRecon} disabled={!lastCharge}>Run nightly reconciliation</Button>
      </div>
      {recon && (
        <table className="pay-led__rtable">
          <thead><tr><th>PSP ref</th><th>Ledger</th><th>Settlement file</th><th>Result</th></tr></thead>
          <tbody>
            {recon.map((r) => (
              <tr key={r.ref}>
                <td className="mono">{r.ref}</td>
                <td className="mono">{r.ledger != null ? fmt(r.ledger) : '—'}</td>
                <td className="mono">{r.psp != null ? fmt(r.psp) : '—'}</td>
                <td><Badge tone={r.status === 'matched' ? 'success' : 'danger'}>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DemoFrame>
  )
}
