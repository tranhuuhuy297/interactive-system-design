/** Message routing through stateful WebSocket gateways, as a sequence of highlighted hops. */
export type ChatUser = 'alice' | 'bob' | 'carol' | 'dan'

export const USER_SERVER: Record<ChatUser, string> = { alice: 'ws-1', bob: 'ws-2', carol: 'ws-2', dan: 'ws-3' }
export const SERVERS = ['ws-1', 'ws-2', 'ws-3'] as const
export const BACKEND = ['chat', 'registry', 'pubsub', 'store', 'push'] as const

export const BACKEND_LABEL: Record<(typeof BACKEND)[number], { title: string; sub: string }> = {
  chat: { title: 'Chat service', sub: 'assigns seq, persists' },
  registry: { title: 'Session registry', sub: 'user → gateway (Redis)' },
  pubsub: { title: 'Pub/sub', sub: 'per-gateway channel' },
  store: { title: 'Message store', sub: 'Cassandra / ScyllaDB' },
  push: { title: 'Push service', sub: 'APNs / FCM' },
}

export interface Hop { nodes: string[]; text: string }

const cap = (u: string) => u[0].toUpperCase() + u.slice(1)

export function routeMessage(from: ChatUser, to: ChatUser, online: Record<ChatUser, boolean>, seq: number): Hop[] {
  const fs = USER_SERVER[from]
  const ts = USER_SERVER[to]
  const hops: Hop[] = [
    { nodes: [from, fs], text: `${cap(from)}'s app sends a frame over its open WebSocket to ${fs}.` },
    { nodes: [fs, 'chat', 'store'], text: `${fs} forwards to the chat service, which assigns seq #${seq} in the conversation and writes it to the message store. Then it ACKs the sender (✓ sent).` },
    { nodes: ['chat', 'registry'], text: online[to] ? `Registry lookup: ${to} → ${ts}.` : `Registry lookup: ${to} has no live session.` },
  ]
  if (online[to]) {
    hops.push(
      { nodes: ['chat', 'pubsub', ts], text: `Publish on ${ts}'s channel. Only the gateway holding ${cap(to)}'s socket subscribes.${fs === ts ? ' (Same gateway: it still goes through pub/sub, so there is one code path.)' : ''}` },
      { nodes: [ts, to], text: `${ts} pushes the frame down ${cap(to)}'s socket. The client ACKs, and the sender sees ✓✓ delivered.` },
    )
  } else {
    hops.push(
      { nodes: ['chat', 'push'], text: `${cap(to)} is offline, so send a push notification (preview only; no message body if E2E encrypted).` },
      { nodes: ['store', to], text: `The message waits in the store. On reconnect, ${cap(to)} syncs everything after their last cursor.` },
    )
  }
  return hops
}
