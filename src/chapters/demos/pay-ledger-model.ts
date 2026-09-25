/** Minimal double-entry ledger: every transaction's debits equal its credits. Amounts in cents. */
export type Account = 'psp_receivable' | 'bank_cash' | 'merchant_payable' | 'fee_revenue'

export const ACCOUNTS: { id: Account; label: string; normal: 'debit' | 'credit' }[] = [
  { id: 'psp_receivable', label: 'PSP receivable (asset)', normal: 'debit' },
  { id: 'bank_cash', label: 'Bank cash (asset)', normal: 'debit' },
  { id: 'merchant_payable', label: 'Owed to merchants (liability)', normal: 'credit' },
  { id: 'fee_revenue', label: 'Fee revenue', normal: 'credit' },
]

export interface Entry { txn: string; account: Account; debit: number; credit: number }
export interface Txn { id: string; kind: 'charge' | 'refund' | 'settle' | 'payout'; amount: number; pspRef?: string }

const FEE_BPS = 290 // illustrative 2.9% platform fee

export function entriesFor(t: Txn, merchantBalance: number): Entry[] {
  const e = (account: Account, debit: number, credit: number): Entry => ({ txn: t.id, account, debit, credit })
  switch (t.kind) {
    case 'charge': {
      const fee = Math.round((t.amount * FEE_BPS) / 10_000)
      return [e('psp_receivable', t.amount, 0), e('merchant_payable', 0, t.amount - fee), e('fee_revenue', 0, fee)]
    }
    case 'refund':
      return [e('merchant_payable', t.amount, 0), e('psp_receivable', 0, t.amount)]
    case 'settle':
      return [e('bank_cash', t.amount, 0), e('psp_receivable', 0, t.amount)]
    case 'payout':
      return merchantBalance > 0 ? [e('merchant_payable', merchantBalance, 0), e('bank_cash', 0, merchantBalance)] : []
  }
}

/** Signed balance in the account's normal direction. */
export function balances(entries: Entry[]): Record<Account, number> {
  const out = { psp_receivable: 0, bank_cash: 0, merchant_payable: 0, fee_revenue: 0 }
  for (const x of entries) {
    const normal = ACCOUNTS.find((a) => a.id === x.account)!.normal
    out[x.account] += normal === 'debit' ? x.debit - x.credit : x.credit - x.debit
  }
  return out
}

export interface ReconRow { ref: string; ledger?: number; psp?: number; status: 'matched' | 'amount mismatch' | 'missing in ledger' | 'missing at PSP' }

/** Three-way-lite reconciliation: our charges vs the PSP's settlement file, keyed by PSP reference. */
export function reconcile(txns: Txn[], settlement: { ref: string; amount: number }[]): ReconRow[] {
  const ours = new Map(txns.filter((t) => t.kind === 'charge' && t.pspRef).map((t) => [t.pspRef!, t.amount]))
  const theirs = new Map(settlement.map((s) => [s.ref, s.amount]))
  const refs = new Set([...ours.keys(), ...theirs.keys()])
  return [...refs].map((ref) => {
    const l = ours.get(ref); const p = theirs.get(ref)
    const status = l == null ? 'missing in ledger' : p == null ? 'missing at PSP' : l === p ? 'matched' : 'amount mismatch'
    return { ref, ledger: l, psp: p, status }
  })
}

export const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`
