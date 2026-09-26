import type { ArchEdge, ArchNode } from '../../components/ui'

// Fixed slots so a component never jumps between stages. Columns x: 10/30/50/70/90, rows y: 18/50/82.
export const FN = {
  editor: { id: 'editor', label: 'Browser editor', sub: 'C++ · WebGL', kind: 'client', x: 10, y: 50 },
  peer: { id: 'peer', label: 'Collaborator', sub: 'another browser', kind: 'client', x: 10, y: 82 },
  api: { id: 'api', label: 'API servers', sub: 'files · teams · auth', kind: 'service', x: 30, y: 18 },
  mp: { id: 'mp', label: 'Multiplayer', sub: 'one process per file', kind: 'service', x: 30, y: 50 },
  plugin: { id: 'plugin', label: 'Plugin sandbox', sub: 'main thread + iframe', kind: 'worker', x: 30, y: 82 },
  proxy: { id: 'proxy', label: 'DBProxy', sub: 'routing · scatter-gather', kind: 'lb', x: 50, y: 18 },
  journal: { id: 'journal', label: 'Journal', sub: 'DynamoDB', kind: 'db', x: 50, y: 50 },
  s3: { id: 's3', label: 'File checkpoints', sub: 'S3', kind: 'storage', x: 50, y: 82 },
  pg: { id: 'pg', label: 'Postgres', sub: 'one RDS instance', kind: 'db', x: 70, y: 18 },
  lg: { id: 'lg', label: 'LiveGraph', sub: 'tails the WAL', kind: 'service', x: 70, y: 50 },
  replicas: { id: 'replicas', label: 'Read replicas', sub: '+ PgBouncer', kind: 'db', x: 90, y: 18 },
  lgcache: { id: 'lgcache', label: 'LiveGraph cache', sub: 'sharded by query', kind: 'cache', x: 90, y: 50 },
} satisfies Record<string, ArchNode>

/** Same node with a stage-specific label or subtitle. */
export const fAs = (n: ArchNode, label: string, sub?: string): ArchNode => ({ ...n, label, sub })

export const fe = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })

/** Live editing core: both browsers talk to the file's multiplayer process, which checkpoints to S3. */
export const F_CORE_EDGES: ArchEdge[] = [fe('editor', 'mp'), fe('mp', 'peer'), fe('mp', 's3', { async: true }), fe('editor', 'api'), fe('api', 'pg')]
