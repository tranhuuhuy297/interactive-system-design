import type { ArchEdge, ArchNode } from '../../components/ui'

// One fixed slot per id; ids sharing a slot never appear in the same stage.
export const A = {
  guest: { id: 'guest', label: 'Guest', sub: 'web · app', kind: 'client', x: 10, y: 30 },
  host: { id: 'host', label: 'Host', sub: 'web · app', kind: 'client', x: 10, y: 70 },
  mono: { id: 'mono', label: 'Rails monolith', sub: '“monorail”', kind: 'service', x: 46, y: 50 },
  db: { id: 'db', label: 'Primary DB', sub: 'listings · bookings', kind: 'db', x: 82, y: 50 },
  risk: { id: 'risk', label: 'Fraud prediction', sub: 'real-time scores', kind: 'service', x: 64, y: 20 },
  models: { id: 'models', label: 'Model training', sub: 'offline', kind: 'worker', x: 82, y: 20 },
  erf: { id: 'erf', label: 'Experiment reports', kind: 'worker', x: 64, y: 80 },
  wh: { id: 'wh', label: 'Data warehouse', sub: 'Hive', kind: 'storage', x: 82, y: 80 },
  airflow: { id: 'airflow', label: 'Airflow', sub: 'pipeline scheduler', kind: 'worker', x: 46, y: 85 },
  search: { id: 'search', label: 'Search service', kind: 'service', x: 46, y: 20 },
  index: { id: 'index', label: 'Search index', sub: 'sharded', kind: 'search', x: 82, y: 20 },
  nebula: { id: 'nebula', label: 'Index builder', sub: 'versioned snapshots', kind: 'worker', x: 64, y: 50 },
  cdc: { id: 'cdc', label: 'Change stream', sub: 'CDC', kind: 'queue', x: 64, y: 80 },
  hold: { id: 'hold', label: 'Holds', sub: 'short expiry', kind: 'cache', x: 64, y: 50 },
  gw: { id: 'gw', label: 'API gateway', kind: 'lb', x: 28, y: 50 },
  listing: { id: 'listing', label: 'Listing service', kind: 'service', x: 46, y: 35 },
  booking: { id: 'booking', label: 'Booking service', kind: 'service', x: 46, y: 65 },
  pricing: { id: 'pricing', label: 'Pricing models', sub: 'per listing-night', kind: 'worker', x: 64, y: 35 },
  ranker: { id: 'ranker', label: 'Ranker', sub: 'neural network', kind: 'service', x: 64, y: 20 },
  retr: { id: 'retr', label: 'Retrieval', sub: 'embeddings · IVF', kind: 'search', x: 64, y: 50 },
  pay: { id: 'pay', label: 'Payment services', sub: 'with Orpheus', kind: 'service', x: 64, y: 65 },
  psp: { id: 'psp', label: 'Payment processor', kind: 'external', x: 82, y: 65 },
  idem: { id: 'idem', label: 'Idempotency store', sub: 'sharded by key', kind: 'db', x: 64, y: 88 },
} satisfies Record<string, ArchNode>

export const ae = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })
