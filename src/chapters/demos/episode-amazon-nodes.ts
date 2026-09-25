import type { ArchEdge, ArchNode } from '../../components/ui'

// One fixed position per component id; stages add and retire nodes around a stable layout.
export const AN = {
  shopper: { id: 'shopper', label: 'Shoppers', sub: 'web · app', kind: 'client', x: 10, y: 50 },
  cdn: { id: 'cdn', label: 'CDN', sub: 'images, static', kind: 'cdn', x: 10, y: 20 },
  mono: { id: 'mono', label: 'Store app', sub: 'one codebase', kind: 'service', x: 30, y: 50 },
  bigdb: { id: 'bigdb', label: 'Relational DB', sub: 'everything', kind: 'db', x: 50, y: 50 },
  gw: { id: 'gw', label: 'Web tier', sub: 'calls services', kind: 'lb', x: 30, y: 50 },
  gwCell: { id: 'gw', label: 'Cell router', sub: 'thin, global', kind: 'lb', x: 30, y: 50 },
  gwPeak: { id: 'gw', label: 'Web tier', sub: 'sheds load', kind: 'lb', x: 30, y: 50 },
  catalog: { id: 'catalog', label: 'Catalog', kind: 'service', x: 50, y: 20 },
  catcache: { id: 'catcache', label: 'Catalog cache', kind: 'cache', x: 70, y: 20 },
  recs: { id: 'recs', label: 'Similar items', sub: 'built offline', kind: 'search', x: 90, y: 20 },
  cart: { id: 'cart', label: 'Cart service', kind: 'service', x: 50, y: 40 },
  cartdb: { id: 'cartdb', label: 'Cart DB', sub: 'relational', kind: 'db', x: 70, y: 40 },
  cartKv: { id: 'cartdb', label: 'Cart store', sub: 'always writable KV', kind: 'db', x: 70, y: 40 },
  inv: { id: 'inv', label: 'Inventory', sub: 'holds + stock', kind: 'service', x: 50, y: 62 },
  invdb: { id: 'invdb', label: 'Stock table', sub: 'per SKU × warehouse', kind: 'db', x: 70, y: 62 },
  orderdb: { id: 'orderdb', label: 'Orders DB', kind: 'db', x: 90, y: 62 },
  orders: { id: 'orders', label: 'Order workflow', sub: 'saga', kind: 'worker', x: 50, y: 84 },
  pay: { id: 'pay', label: 'Payments', kind: 'service', x: 70, y: 84 },
  fulfil: { id: 'fulfil', label: 'Fulfillment', sub: 'warehouses', kind: 'worker', x: 90, y: 84 },
  networks: { id: 'networks', label: 'Card networks', kind: 'external', x: 90, y: 40 },
  waitq: { id: 'waitq', label: 'Checkout queue', sub: 'admission control', kind: 'queue', x: 30, y: 84 },
  cellA: { id: 'cellA', label: 'Cell A', sub: 'full stack', kind: 'service', x: 62, y: 20 },
  cellB: { id: 'cellB', label: 'Cell B', sub: 'full stack', kind: 'service', x: 62, y: 50 },
  cellC: { id: 'cellC', label: 'Cell C', sub: 'full stack', kind: 'service', x: 62, y: 80 },
  deploy: { id: 'deploy', label: 'Deploy pipeline', sub: 'one cell at a time', kind: 'worker', x: 88, y: 50 },
  promise: { id: 'promise', label: 'Promise service', sub: 'delivery date', kind: 'service', x: 50, y: 20 },
  plan: { id: 'plan', label: 'Fulfillment planner', kind: 'worker', x: 70, y: 20 },
} satisfies Record<string, ArchNode>

export const ae = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })
