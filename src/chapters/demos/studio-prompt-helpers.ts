import type { CompKind, RubricCheck, StudioEdge, StudioNode } from './studio-types'

// Layout grid for reference designs (canvas 960 × 560, node 132 × 48).
export const X = [20, 190, 360, 530, 700, 828] as const
export const Y = [40, 150, 260, 370, 480] as const

export const node = (id: string, kind: CompKind, col: number, row: number, units: number, extra: Partial<StudioNode> = {}): StudioNode =>
  ({ id, kind, x: X[col], y: Y[row], units, ...extra })

/** Edges from a compact "a>b" list. */
export const edges = (...pairs: string[]): StudioEdge[] => pairs.map((p) => {
  const [from, to] = p.split('>')
  return { from, to }
})

export const CHECK = {
  cache: { id: 'cache', label: 'Hot reads are served from a cache', kinds: ['cache'], mode: 'present', fix: 'Put a cache beside or in front of the read path.', chapter: 'caching' },
  cdn: { id: 'cdn', label: 'Users hit a CDN at the edge', kinds: ['cdn'], mode: 'fromClient', fix: 'Connect Clients to a CDN for static and cacheable content.', chapter: 'caching' },
  async: { id: 'async', label: 'Slow work runs async through a queue and workers', kinds: ['queue'], mode: 'consumed', fix: 'Publish slow work to a queue and consume it with a worker pool.', chapter: 'messaging' },
  sql: { id: 'sql', label: 'Money lives in a transactional SQL store', kinds: ['sql'], mode: 'present', fix: 'Keep balances and payment state in a database with ACID transactions.', chapter: 'payments' },
  kv: { id: 'kv', label: 'High-volume data goes to a partitioned store', kinds: ['kv'], mode: 'present', fix: 'Use a partitioned KV / wide-column store for high write volume.', chapter: 'databases' },
  ws: { id: 'ws', label: 'Clients hold a WebSocket connection for push', kinds: ['ws'], mode: 'fromClient', fix: 'Connect Clients to a WebSocket gateway so the server can push.', chapter: 'chat' },
  blob: { id: 'blob', label: 'Media lives in object storage', kinds: ['blob'], mode: 'present', fix: 'Store files in object storage; keep metadata in the database.', chapter: 'object-storage' },
  search: { id: 'search', label: 'Queries hit a search index', kinds: ['search'], mode: 'present', fix: 'Add a search index for text or prefix queries.', chapter: 'search-engine' },
  limiter: { id: 'limiter', label: 'A rate limiter guards the services', kinds: ['ratelimit'], mode: 'before', target: 'service', fix: 'Place a rate limiter in front of your services.', chapter: 'rate-limiting' },
  lb: { id: 'lb', label: 'Traffic is spread by a load balancer', kinds: ['lb'], mode: 'before', target: 'service', fix: 'Put a load balancer in front of the service replicas.', chapter: 'load-balancing' },
} satisfies Record<string, RubricCheck>
