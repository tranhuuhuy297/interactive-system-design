/** Per-conversation sequence numbers + per-device cursors: the core of chat ordering and offline sync. */
export type DeviceId = 'phone' | 'laptop'

export interface Device {
  online: boolean
  /** Highest contiguous seq this device has applied. */
  cursor: number
  /** Out-of-order seqs held until the gap fills. */
  buffer: number[]
}

export interface SyncState {
  messages: { seq: number; text: string }[]
  devices: Record<DeviceId, Device>
  readUpTo: number
  log: string[]
}

export type SyncAction =
  | { type: 'store'; text: string }
  | { type: 'deliver'; device: DeviceId; seq: number }
  | { type: 'toggle'; device: DeviceId }
  | { type: 'read'; device: DeviceId }
  | { type: 'reset' }

export const INITIAL_SYNC: SyncState = {
  messages: [{ seq: 1, text: 'hey!' }, { seq: 2, text: 'lunch at 12?' }],
  devices: { phone: { online: true, cursor: 2, buffer: [] }, laptop: { online: false, cursor: 1, buffer: [] } },
  readUpTo: 1,
  log: ['Conversation starts at seq #2. The laptop last synced at #1.'],
}

const lastSeq = (s: SyncState) => s.messages.at(-1)?.seq ?? 0

function apply(d: Device, seq: number): Device {
  if (seq <= d.cursor || d.buffer.includes(seq)) return d // duplicate delivery → idempotent no-op
  if (seq !== d.cursor + 1) return { ...d, buffer: [...d.buffer, seq].sort((a, b) => a - b) }
  let cursor = seq
  let buffer = d.buffer
  while (buffer[0] === cursor + 1) { cursor += 1; buffer = buffer.slice(1) }
  return { ...d, cursor, buffer }
}

export function syncReducer(s: SyncState, a: SyncAction): SyncState {
  const log = (line: string) => [line, ...s.log].slice(0, 6)
  switch (a.type) {
    case 'store': {
      const seq = lastSeq(s) + 1
      return { ...s, messages: [...s.messages, { seq, text: a.text }], log: log(`Server stored “${a.text}” as seq #${seq}.`) }
    }
    case 'deliver': {
      const d = s.devices[a.device]
      if (!d.online) return s
      const next = apply(d, a.seq)
      const note = next.buffer.length > d.buffer.length
        ? `${a.device} got #${a.seq} early, so it holds it and waits for #${d.cursor + 1}.`
        : `${a.device} applied #${a.seq}, cursor → #${next.cursor}.`
      return { ...s, devices: { ...s.devices, [a.device]: next }, log: log(note) }
    }
    case 'toggle': {
      const d = s.devices[a.device]
      if (d.online) return { ...s, devices: { ...s.devices, [a.device]: { ...d, online: false } }, log: log(`${a.device} went offline at cursor #${d.cursor}.`) }
      const top = lastSeq(s)
      const missed = top - d.cursor
      return {
        ...s,
        devices: { ...s.devices, [a.device]: { online: true, cursor: top, buffer: [] } },
        log: log(missed > 0 ? `${a.device} reconnected: GET /sync?after=${d.cursor} returned ${missed} message(s) (#${d.cursor + 1}–#${top}).` : `${a.device} reconnected and is already up to date.`),
      }
    }
    case 'read': {
      const d = s.devices[a.device]
      if (!d.online || d.cursor <= s.readUpTo) return s
      return { ...s, readUpTo: d.cursor, log: log(`Read receipt: readUpTo = #${d.cursor}, synced to the sender and to your other devices.`) }
    }
    case 'reset':
      return INITIAL_SYNC
  }
}

export function statusOf(s: SyncState, seq: number): 'sent' | 'delivered' | 'read' {
  if (seq <= s.readUpTo) return 'read'
  return Object.values(s.devices).some((d) => d.cursor >= seq) ? 'delivered' : 'sent'
}
