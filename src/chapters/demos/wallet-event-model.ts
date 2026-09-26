// Event-sourced wallet: commands are validated against state, accepted ones become immutable events,
// and state is only ever derived by folding events (optionally starting from a snapshot).

export type AccountId = 'alice' | 'bob' | 'carol' | 'merchant'

export const ACCOUNTS: AccountId[] = ['alice', 'bob', 'carol', 'merchant']
export const INITIAL: Record<AccountId, number> = { alice: 1_000, bob: 500, carol: 300, merchant: 0 }
export const TOTAL = Object.values(INITIAL).reduce((s, v) => s + v, 0)
export const SNAPSHOT_EVERY = 3

export interface Command { id: string; from: AccountId; to: AccountId; amount: number }

export type WalletEvent =
  | { seq: number; type: 'Transferred'; cmdId: string; from: AccountId; to: AccountId; amount: number }
  | { seq: number; type: 'Rejected'; cmdId: string; reason: string }

export interface Snapshot { seq: number; balances: Record<AccountId, number>; applied: string[] }

export interface WalletState {
  balances: Record<AccountId, number>
  /** Command ids already accepted, for idempotency. Part of state, so it survives replay. */
  applied: string[]
  seq: number
}

export const emptyState = (): WalletState => ({ balances: { ...INITIAL }, applied: [], seq: 0 })

/** Pure fold step: the only code allowed to change state. */
export function apply(state: WalletState, e: WalletEvent): WalletState {
  if (e.type === 'Rejected') return { ...state, seq: e.seq, applied: [...state.applied, e.cmdId] }
  const b = { ...state.balances }
  b[e.from] -= e.amount
  b[e.to] += e.amount
  return { balances: b, applied: [...state.applied, e.cmdId], seq: e.seq }
}

export type Outcome = 'accepted' | 'rejected' | 'duplicate-ignored'

/** Validate a command against current state and decide which event (if any) to append. */
export function decide(state: WalletState, cmd: Command, idempotent: boolean): { outcome: Outcome; event?: WalletEvent } {
  if (idempotent && state.applied.includes(cmd.id)) return { outcome: 'duplicate-ignored' }
  const seq = state.seq + 1
  if (cmd.amount <= 0 || cmd.from === cmd.to) return { outcome: 'rejected', event: { seq, type: 'Rejected', cmdId: cmd.id, reason: 'invalid' } }
  if (state.balances[cmd.from] < cmd.amount) {
    return { outcome: 'rejected', event: { seq, type: 'Rejected', cmdId: cmd.id, reason: 'insufficient funds' } }
  }
  return { outcome: 'accepted', event: { seq, type: 'Transferred', cmdId: cmd.id, from: cmd.from, to: cmd.to, amount: cmd.amount } }
}

export const fold = (events: WalletEvent[], from: WalletState = emptyState()): WalletState =>
  events.filter((e) => e.seq > from.seq).reduce(apply, from)

/** Rebuild after a crash: newest snapshot, then replay only the events after it. */
export function rebuild(events: WalletEvent[], snapshots: Snapshot[]): { state: WalletState; replayed: number; fromSeq: number } {
  const snap = snapshots[snapshots.length - 1]
  const base: WalletState = snap ? { balances: { ...snap.balances }, applied: [...snap.applied], seq: snap.seq } : emptyState()
  const tail = events.filter((e) => e.seq > base.seq)
  return { state: tail.reduce(apply, base), replayed: tail.length, fromSeq: base.seq }
}

export const totalOf = (b: Record<AccountId, number>) => ACCOUNTS.reduce((s, a) => s + b[a], 0)

export const sameState = (x: WalletState, y: WalletState) =>
  x.seq === y.seq && ACCOUNTS.every((a) => x.balances[a] === y.balances[a])
