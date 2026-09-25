import type { ArchEdge, ArchNode } from '../../components/ui'

// Fixed slots so a component never jumps between stages. Columns x: 10/30/55/80, rows y: 18/50/82.
export const DN = {
  client: { id: 'client', label: 'Clients', sub: 'desktop · mobile · web', kind: 'client', x: 10, y: 50 },
  mono: { id: 'mono', label: 'Chat server', sub: 'API + sockets', kind: 'service', x: 42, y: 50 },
  mongo: { id: 'mongo', label: 'MongoDB', sub: 'one replica set', kind: 'db', x: 80, y: 18 },
  readstates: { id: 'readstates', label: 'Read States', sub: 'Rust service', kind: 'cache', x: 10, y: 18 },
  api: { id: 'api', label: 'HTTP API', sub: 'writes + history', kind: 'service', x: 30, y: 18 },
  gw: { id: 'gw', label: 'Gateway', sub: 'WebSocket sessions', kind: 'lb', x: 30, y: 50 },
  relay: { id: 'relay', label: 'Relays', sub: 'fan-out workers', kind: 'worker', x: 30, y: 82 },
  members: { id: 'members', label: 'Member lists', sub: 'Rust sorted set', kind: 'cache', x: 10, y: 82 },
  guild: { id: 'guild', label: 'Guild processes', sub: 'one per server', kind: 'service', x: 55, y: 50 },
  ds: { id: 'ds', label: 'Data services', sub: 'Rust · coalescing', kind: 'service', x: 55, y: 18 },
  idxq: { id: 'idxq', label: 'Index queue', sub: 'batch workers', kind: 'queue', x: 55, y: 82 },
  cass: { id: 'cass', label: 'Cassandra', sub: '(channel, bucket)', kind: 'db', x: 80, y: 18 },
  scylla: { id: 'scylla', label: 'ScyllaDB', sub: 'same data model', kind: 'db', x: 80, y: 18 },
  es: { id: 'es', label: 'Search clusters', sub: 'Elasticsearch', kind: 'search', x: 80, y: 50 },
  disk: { id: 'disk', label: 'Super-disk', sub: 'local SSD + PD mirror', kind: 'storage', x: 80, y: 50 },
  voice: { id: 'voice', label: 'Voice servers', sub: 'SFU · many regions', kind: 'external', x: 80, y: 82 },
} satisfies Record<string, ArchNode>

export const de = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })

/** Edges shared by every stage after the gateway split. */
export const CORE_EDGES: ArchEdge[] = [de('client', 'api'), de('client', 'gw'), de('api', 'guild', { async: true }), de('guild', 'gw')]
