import type { ArchEdge, ArchNode } from '../../components/ui'

// Fixed slots so a component never jumps between stages. Columns x: 10/30/50/70/90, rows y: 18/50/82.
export const WN = {
  sender: { id: 'sender', label: 'Sender phone', kind: 'client', x: 10, y: 18 },
  companion: { id: 'companion', label: 'Linked devices', sub: 'up to 4 companions', kind: 'client', x: 10, y: 50 },
  recv: { id: 'recv', label: 'Recipient phone', kind: 'client', x: 10, y: 82 },
  chat: { id: 'chat', label: 'Chat servers', sub: 'Erlang on FreeBSD', kind: 'service', x: 30, y: 50 },
  mnesia: { id: 'mnesia', label: 'Mnesia', sub: 'in-memory tables', kind: 'db', x: 50, y: 18 },
  backend: { id: 'backend', label: 'Backend services', sub: 'primary + secondary', kind: 'service', x: 50, y: 50 },
  queue: { id: 'queue', label: 'Offline queue', sub: 'held until delivered', kind: 'queue', x: 50, y: 82 },
  keys: { id: 'keys', label: 'Key directory', sub: 'public keys only', kind: 'service', x: 70, y: 18 },
  media: { id: 'media', label: 'Media servers', sub: 'HTTP upload', kind: 'storage', x: 70, y: 82 },
  vault: { id: 'vault', label: 'Backup Key Vault', sub: 'HSMs', kind: 'external', x: 90, y: 18 },
  meta: { id: 'meta', label: 'Meta data centers', kind: 'external', x: 90, y: 50 },
  backup: { id: 'backup', label: 'Cloud backup', sub: 'encrypted blob', kind: 'storage', x: 90, y: 82 },
} satisfies Record<string, ArchNode>

/** Same node with a stage-specific label or subtitle. */
export const wAs = (n: ArchNode, label: string, sub?: string): ArchNode => ({ ...n, label, sub })

export const we = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })

/** Store-and-forward core shared by most stages. */
export const W_CORE_EDGES: ArchEdge[] = [we('sender', 'chat'), we('chat', 'recv'), we('chat', 'queue', { async: true })]
