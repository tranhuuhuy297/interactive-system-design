import type { ArchEdge, ArchNode } from '../../components/ui'

// Fixed slots so a component never jumps between stages. Columns x: 10/28/46/64/82, rows y: 18/50/82.
export const IN = {
  client: { id: 'client', label: 'Mobile app', sub: 'iOS · Android', kind: 'client', x: 10, y: 50 },
  lb: { id: 'lb', label: 'Load balancer', sub: 'ELB + nginx', kind: 'lb', x: 28, y: 50 },
  web: { id: 'web', label: 'App servers', sub: 'Python / Django', kind: 'service', x: 46, y: 50 },
  feed: { id: 'feed', label: 'Feed service', sub: 'rank + hydrate', kind: 'service', x: 64, y: 50 },
  pg: { id: 'pg', label: 'PostgreSQL', sub: 'primary + replicas', kind: 'db', x: 82, y: 50 },
  cdn: { id: 'cdn', label: 'CDN', sub: 'CloudFront', kind: 'cdn', x: 28, y: 18 },
  redis: { id: 'redis', label: 'Redis + memcached', sub: 'feeds · sessions', kind: 'cache', x: 46, y: 18 },
  cass: { id: 'cass', label: 'Cassandra', sub: 'write-heavy data', kind: 'db', x: 64, y: 18 },
  stories: { id: 'stories', label: 'Stories', sub: 'expire in 24h', kind: 'service', x: 82, y: 18 },
  dc: { id: 'dc', label: 'Other data centers', sub: 'replicas + local data', kind: 'external', x: 82, y: 18 },
  fbdc: { id: 'fbdc', label: 'Facebook DCs', sub: 'migration target', kind: 'external', x: 10, y: 18 },
  eu: { id: 'eu', label: 'EU data centers', sub: 'local partitions', kind: 'external', x: 10, y: 18 },
  q: { id: 'q', label: 'Task queue', sub: 'Gearman', kind: 'queue', x: 46, y: 82 },
  workers: { id: 'workers', label: 'Workers', sub: 'Python', kind: 'worker', x: 64, y: 82 },
  transcode: { id: 'transcode', label: 'Video pipeline', sub: 'encode ladder', kind: 'worker', x: 64, y: 82 },
  s3: { id: 's3', label: 'Object storage', sub: 'S3', kind: 'storage', x: 82, y: 82 },
} satisfies Record<string, ArchNode>

export const shards: ArchNode = { ...IN.pg, label: 'Postgres shards', sub: 'logical → physical' }

export const ie = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })

/** Request path shared by every stage after the load balancer arrives. */
export const FRONT: ArchEdge[] = [ie('client', 'lb'), ie('lb', 'web')]
