import type { ArchEdge, ArchNode } from '../../components/ui'

// One fixed slot per id, so the picture grows across stages instead of reshuffling.
// Grid: x ∈ {10, 28, 46, 64, 82} (18% apart); ids sharing a slot never appear in the same stage.
export const U = {
  rider: { id: 'rider', label: 'Rider app', kind: 'client', x: 10, y: 30 },
  driver: { id: 'driver', label: 'Driver app', kind: 'client', x: 10, y: 70 },
  gw: { id: 'gw', label: 'API edge', kind: 'lb', x: 28, y: 50 },
  mono: { id: 'mono', label: 'Monolith', sub: 'Python', kind: 'service', x: 46, y: 50 },
  pg: { id: 'pg', label: 'PostgreSQL', sub: 'single database', kind: 'db', x: 82, y: 50 },
  api: { id: 'api', label: 'API service', sub: 'Python', kind: 'service', x: 46, y: 20 },
  demand: { id: 'demand', label: 'Demand service', sub: 'riders, orders', kind: 'service', x: 46, y: 20 },
  dispatch: { id: 'dispatch', label: 'Dispatch', sub: 'Node.js', kind: 'service', x: 46, y: 50 },
  supply: { id: 'supply', label: 'Supply service', sub: 'drivers, vehicles', kind: 'service', x: 46, y: 80 },
  geo: { id: 'geo', label: 'Geo index', sub: 'latest positions', kind: 'cache', x: 64, y: 80 },
  eta: { id: 'eta', label: 'ETA / routing', kind: 'service', x: 64, y: 50 },
  trips: { id: 'trips', label: 'Trip service', sub: 'state machine', kind: 'service', x: 64, y: 20 },
  store: { id: 'store', label: 'Schemaless', sub: 'sharded MySQL', kind: 'db', x: 82, y: 20 },
  dc2: { id: 'dc2', label: 'Backup datacenter', kind: 'external', x: 82, y: 80 },
  svcs: { id: 'svcs', label: 'Service fleet', sub: '500+ → 2,000+', kind: 'service', x: 82, y: 50 },
  surge: { id: 'surge', label: 'Pricing', sub: 'surge per hexagon', kind: 'service', x: 28, y: 15 },
  jaeger: { id: 'jaeger', label: 'Tracing', sub: 'Jaeger', kind: 'worker', x: 28, y: 85 },
  kafka: { id: 'kafka', label: 'Regional Kafka', kind: 'queue', x: 82, y: 50 },
  agg: { id: 'agg', label: 'Aggregate Kafka', sub: 'all regions', kind: 'queue', x: 82, y: 85 },
  ml: { id: 'ml', label: 'ML platform', sub: 'Michelangelo', kind: 'worker', x: 82, y: 85 },
  dFul: { id: 'dFul', label: 'Fulfillment domain', kind: 'service', x: 46, y: 20 },
  dMkt: { id: 'dMkt', label: 'Marketplace domain', kind: 'service', x: 46, y: 50 },
  dMaps: { id: 'dMaps', label: 'Maps domain', kind: 'service', x: 46, y: 80 },
  dPay: { id: 'dPay', label: 'Payments domain', kind: 'service', x: 64, y: 20 },
  many: { id: 'many', label: 'Services behind gateways', sub: '~2,200 in ~70 domains', kind: 'service', x: 82, y: 50 },
  ful: { id: 'ful', label: 'Fulfillment platform', sub: 'trips + sessions', kind: 'service', x: 46, y: 20 },
  spanner: { id: 'spanner', label: 'Cloud Spanner', sub: 'multi-region', kind: 'db', x: 82, y: 20 },
  late: { id: 'late', label: 'LATE', sub: 'post-commit tasks', kind: 'worker', x: 82, y: 50 },
} satisfies Record<string, ArchNode>

export const ue = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })
