import type { CompKind, Severity } from './studio-types'

// Toy capacities for teaching: round numbers chosen to make trade-offs visible, not benchmarks.
export interface CatalogItem {
  kind: CompKind
  name: string
  short: string
  unitLabel: string
  defaultUnits: number
  /** Requests/s one unit can serve (reads + writes unless writeCap is set). */
  cap: number
  /** Total write capacity regardless of units (e.g. a single SQL primary). */
  writeCap?: number
  /** Usable storage in TB: per unit, or for the whole node when storageShared. */
  storageTb?: number
  storageShared?: boolean
  /** Units needed to survive one failure; 0 means managed / highly available. */
  minHA: number
  spofSeverity: Severity
  latencyMs: number
  serveReads: boolean
  acceptWrites: boolean
  defaultHit?: number
  chapter: string
  blurb: string
}

const INF = Number.POSITIVE_INFINITY

export const CATALOG: Record<CompKind, CatalogItem> = {
  client: { kind: 'client', name: 'Clients', short: 'Clients', unitLabel: 'Clients', defaultUnits: 1, cap: INF, minHA: 0, spofSeverity: 'info', latencyMs: 0, serveReads: false, acceptWrites: false, chapter: 'networking', blurb: 'Where traffic starts.' },
  cdn: { kind: 'cdn', name: 'CDN / edge cache', short: 'CDN', unitLabel: 'PoPs', defaultUnits: 1, cap: INF, minHA: 0, spofSeverity: 'info', latencyMs: 15, serveReads: true, acceptWrites: true, defaultHit: 0.6, chapter: 'caching', blurb: 'Managed; serves cacheable reads near users.' },
  lb: { kind: 'lb', name: 'Load balancer / gateway', short: 'LB', unitLabel: 'Instances', defaultUnits: 2, cap: 50_000, minHA: 2, spofSeverity: 'critical', latencyMs: 1, serveReads: true, acceptWrites: true, chapter: 'load-balancing', blurb: 'Spreads requests over replicas.' },
  ratelimit: { kind: 'ratelimit', name: 'Rate limiter', short: 'Rate limit', unitLabel: 'Instances', defaultUnits: 2, cap: 100_000, minHA: 2, spofSeverity: 'warning', latencyMs: 1, serveReads: true, acceptWrites: true, chapter: 'rate-limiting', blurb: 'Rejects abusive traffic early.' },
  service: { kind: 'service', name: 'Stateless service', short: 'Service', unitLabel: 'Replicas', defaultUnits: 2, cap: 2_000, minHA: 2, spofSeverity: 'critical', latencyMs: 8, serveReads: true, acceptWrites: true, chapter: 'scaling', blurb: 'Business logic; scale by adding replicas.' },
  ws: { kind: 'ws', name: 'WebSocket gateway', short: 'WS gateway', unitLabel: 'Nodes', defaultUnits: 2, cap: 10_000, minHA: 2, spofSeverity: 'critical', latencyMs: 2, serveReads: true, acceptWrites: true, chapter: 'chat', blurb: 'Holds long-lived connections for push.' },
  cache: { kind: 'cache', name: 'Cache', short: 'Cache', unitLabel: 'Nodes', defaultUnits: 2, cap: 50_000, minHA: 2, spofSeverity: 'warning', latencyMs: 1, serveReads: true, acceptWrites: false, defaultHit: 0.8, chapter: 'caching', blurb: 'In-memory copies of hot reads.' },
  sql: { kind: 'sql', name: 'SQL database', short: 'SQL DB', unitLabel: 'Nodes (1 primary + replicas)', defaultUnits: 2, cap: 10_000, writeCap: 5_000, storageTb: 5, storageShared: true, minHA: 2, spofSeverity: 'critical', latencyMs: 8, serveReads: true, acceptWrites: true, chapter: 'databases', blurb: 'Transactions; one primary takes all writes.' },
  kv: { kind: 'kv', name: 'Wide-column / KV store', short: 'KV store', unitLabel: 'Nodes (RF 3)', defaultUnits: 3, cap: 20_000, storageTb: 4, minHA: 3, spofSeverity: 'critical', latencyMs: 4, serveReads: true, acceptWrites: true, chapter: 'databases', blurb: 'Partitioned and replicated; scales writes.' },
  blob: { kind: 'blob', name: 'Object storage', short: 'Object store', unitLabel: 'Buckets', defaultUnits: 1, cap: INF, storageTb: INF, minHA: 0, spofSeverity: 'info', latencyMs: 30, serveReads: true, acceptWrites: true, chapter: 'object-storage', blurb: 'Managed; big files at low cost.' },
  queue: { kind: 'queue', name: 'Message queue / log', short: 'Queue', unitLabel: 'Partitions', defaultUnits: 3, cap: 10_000, minHA: 0, spofSeverity: 'info', latencyMs: 2, serveReads: false, acceptWrites: true, chapter: 'messaging', blurb: 'Buffers writes for async workers (replicated).' },
  worker: { kind: 'worker', name: 'Worker pool', short: 'Workers', unitLabel: 'Replicas', defaultUnits: 2, cap: 1_000, minHA: 2, spofSeverity: 'warning', latencyMs: 0, serveReads: false, acceptWrites: true, chapter: 'messaging', blurb: 'Consumes the queue in the background.' },
  search: { kind: 'search', name: 'Search index', short: 'Search', unitLabel: 'Nodes', defaultUnits: 2, cap: 5_000, storageTb: 1, minHA: 2, spofSeverity: 'critical', latencyMs: 15, serveReads: true, acceptWrites: true, chapter: 'search-engine', blurb: 'Full-text and prefix queries.' },
}

export const PALETTE_ORDER: CompKind[] = ['client', 'cdn', 'lb', 'ratelimit', 'service', 'ws', 'cache', 'sql', 'kv', 'blob', 'queue', 'worker', 'search']

export const isStore = (k: CompKind) => k === 'sql' || k === 'kv' || k === 'blob' || k === 'search'
