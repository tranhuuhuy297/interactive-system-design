/** Hand-scripted interleavings of two users booking the last room under four concurrency strategies. */
export type Strategy = 'none' | 'pessimistic' | 'optimistic' | 'constraint'
export type Lane = 'A' | 'DB' | 'B'

export interface DbState { available: number; version: number; bookings: string[]; lock?: 'A' | 'B' }
export interface RaceStep { lane: Lane; text: string; sql?: string; state: DbState; tone?: 'bad' | 'good' | 'wait' }

const s = (available: number, version: number, bookings: string[], lock?: 'A' | 'B'): DbState => ({ available, version, bookings, lock })

export const STRATEGY_LABELS: Record<Strategy, string> = {
  none: 'Read-then-write (no guard)',
  pessimistic: 'Pessimistic lock',
  optimistic: 'Optimistic version',
  constraint: 'Atomic conditional update',
}

export const SCRIPTS: Record<Strategy, RaceStep[]> = {
  none: [
    { lane: 'A', text: 'Reads availability', sql: 'SELECT available FROM room_inventory WHERE … → 1', state: s(1, 7, []) },
    { lane: 'B', text: 'Reads availability at the same moment', sql: 'SELECT available … → 1', state: s(1, 7, []) },
    { lane: 'A', text: 'App sees 1 > 0, books and writes 1 − 1', sql: 'INSERT reservation r_A; UPDATE … SET available = 0', state: s(0, 7, ['r_A']) },
    { lane: 'B', text: 'App also saw 1 > 0, books and writes 1 − 1', sql: 'INSERT reservation r_B; UPDATE … SET available = 0', state: s(0, 7, ['r_A', 'r_B']), tone: 'bad' },
    { lane: 'DB', text: 'Two reservations, one room. Lost update → double booking', state: s(0, 7, ['r_A', 'r_B']), tone: 'bad' },
  ],
  pessimistic: [
    { lane: 'A', text: 'Locks the inventory row', sql: 'BEGIN; SELECT … FOR UPDATE → 1', state: s(1, 7, [], 'A') },
    { lane: 'B', text: 'Tries to lock the same row → blocks', sql: 'BEGIN; SELECT … FOR UPDATE  ⏳', state: s(1, 7, [], 'A'), tone: 'wait' },
    { lane: 'A', text: 'Books and commits, releasing the lock', sql: 'INSERT r_A; UPDATE … available = 0; COMMIT', state: s(0, 7, ['r_A']) },
    { lane: 'B', text: 'Unblocks and reads the fresh value', sql: '… → 0', state: s(0, 7, ['r_A'], 'B') },
    { lane: 'B', text: 'Sold out → rollback, show “no rooms”', sql: 'ROLLBACK', state: s(0, 7, ['r_A']), tone: 'good' },
  ],
  optimistic: [
    { lane: 'A', text: 'Reads value and version', sql: 'SELECT available, version → (1, v7)', state: s(1, 7, []) },
    { lane: 'B', text: 'Reads value and version', sql: 'SELECT available, version → (1, v7)', state: s(1, 7, []) },
    { lane: 'A', text: 'Writes only if the version is unchanged → 1 row', sql: 'UPDATE … SET available = 0, version = 8 WHERE version = 7', state: s(0, 8, ['r_A']) },
    { lane: 'B', text: 'Same guarded write → 0 rows affected', sql: 'UPDATE … WHERE version = 7  → 0 rows', state: s(0, 8, ['r_A']), tone: 'wait' },
    { lane: 'B', text: 'Re-reads (0, v8) → sold out', sql: 'SELECT … → (0, v8)', state: s(0, 8, ['r_A']), tone: 'good' },
  ],
  constraint: [
    { lane: 'A', text: 'One atomic statement: decrement only if rooms remain', sql: 'BEGIN; UPDATE … SET available = available − 1 WHERE available > 0 → 1 row', state: s(0, 7, [], 'A') },
    { lane: 'B', text: 'Same statement → waits on A’s row lock', sql: 'UPDATE … WHERE available > 0  ⏳', state: s(0, 7, [], 'A'), tone: 'wait' },
    { lane: 'A', text: 'Inserts the reservation and commits. The lock lives only for this short transaction', sql: 'INSERT r_A; COMMIT', state: s(0, 7, ['r_A']) },
    { lane: 'B', text: 'Unblocks and re-checks the WHERE against the new value → 0 rows = sold out, no retry loop', sql: '… WHERE available > 0 → 0 rows', state: s(0, 7, ['r_A']), tone: 'good' },
    { lane: 'DB', text: 'CHECK (available >= 0) backs it up as a last line of defence', state: s(0, 7, ['r_A']), tone: 'good' },
  ],
}
