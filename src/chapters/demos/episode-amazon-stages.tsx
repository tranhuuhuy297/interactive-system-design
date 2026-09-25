import type { ArchEdge, ArchNode, EpisodeStage } from '../../components/ui'

// Stable positions across stages; the monolith and its DB disappear once services take over.
const N = {
  shopper: { id: 'shopper', label: 'Shoppers', sub: 'web · app', kind: 'client', x: 10, y: 50 },
  mono: { id: 'mono', label: 'Store monolith', kind: 'service', x: 30, y: 50 },
  bigdb: { id: 'bigdb', label: 'Relational DB', sub: 'everything', kind: 'db', x: 52, y: 50 },
  cdn: { id: 'cdn', label: 'CDN', sub: 'images, static', kind: 'cdn', x: 30, y: 14 },
  catalog: { id: 'catalog', label: 'Catalog service', kind: 'service', x: 52, y: 14 },
  catcache: { id: 'catcache', label: 'Catalog cache', kind: 'cache', x: 72, y: 14 },
  gw: { id: 'gw', label: 'Edge / gateway', kind: 'lb', x: 30, y: 50 },
  cart: { id: 'cart', label: 'Cart service', kind: 'service', x: 52, y: 38 },
  cartdb: { id: 'cartdb', label: 'Cart store', sub: 'Dynamo-style KV', kind: 'db', x: 72, y: 38 },
  orderdb: { id: 'orderdb', label: 'Orders DB', kind: 'db', x: 72, y: 62 },
  inv: { id: 'inv', label: 'Inventory', sub: 'holds + stock', kind: 'service', x: 52, y: 62 },
  invdb: { id: 'invdb', label: 'Stock ledger', sub: 'per SKU × FC', kind: 'db', x: 90, y: 62 },
  orders: { id: 'orders', label: 'Order workflow', sub: 'saga', kind: 'worker', x: 52, y: 86 },
  pay: { id: 'pay', label: 'Payments', kind: 'external', x: 72, y: 86 },
  fulfil: { id: 'fulfil', label: 'Fulfillment', sub: 'warehouses', kind: 'worker', x: 90, y: 86 },
  search: { id: 'search', label: 'Search + recs', kind: 'search', x: 90, y: 14 },
  waitq: { id: 'waitq', label: 'Checkout queue', sub: 'admission control', kind: 'queue', x: 30, y: 86 },
  cells: { id: 'cells', label: 'Cells 2…N', sub: 'same stack', kind: 'external', x: 90, y: 38 },
} satisfies Record<string, ArchNode>

const e = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })

const BROWSE = [e('shopper', 'cdn'), e('catalog', 'catcache')]
const SERVICES = [e('shopper', 'gw'), e('gw', 'catalog'), e('gw', 'cart'), e('cart', 'cartdb')]
const SAGA = [e('gw', 'orders'), e('orders', 'inv'), e('inv', 'invdb'), e('orders', 'pay'), e('orders', 'fulfil', { async: true }), e('orders', 'orderdb')]
const LATE = [...BROWSE, ...SERVICES, ...SAGA, e('gw', 'search'), e('search', 'catcache')]

export const AMAZON_STAGES: EpisodeStage[] = [
  {
    title: 'v0 · The store monolith',
    scale: 'Thousands of orders/day',
    nodes: [N.shopper, N.mono, N.bigdb],
    edges: [e('shopper', 'mono'), e('mono', 'bigdb')],
    flows: [{ name: 'Buy', path: ['shopper', 'mono', 'bigdb'], steps: ['Shopper browses and checks out', 'Catalog, cart, and orders all live in one database'] }],
    problem: <p>Sell things online quickly with a small team. Correctness and speed of iteration matter more than scale.</p>,
    decision: <p>One application and one relational database for catalog, carts, inventory, and orders. Transactions make checkout trivially consistent.</p>,
    tradeoff: <p>Every team deploys the same binary, and the database is both the bottleneck and the single point of failure.</p>,
  },
  {
    title: 'v1 · Cache the catalog',
    scale: 'Millions of page views/day',
    added: ['cdn', 'catalog', 'catcache'],
    nodes: [N.shopper, N.mono, N.bigdb, N.cdn, N.catalog, N.catcache],
    edges: [e('shopper', 'mono'), e('mono', 'bigdb'), ...BROWSE, e('mono', 'catalog')],
    flows: [{ name: 'Browse', path: ['shopper', 'mono', 'catalog', 'catcache'], steps: ['Product page request', 'Monolith asks the catalog service', 'Served from cache; images come from the CDN'] }],
    problem: <p>Browsing outnumbers buying by orders of magnitude, and every product page hammers the same database checkout depends on.</p>,
    decision: <p>Split the read-heavy <strong>catalog</strong> out, put a cache in front of it, and move images and static assets to a CDN. Checkout traffic no longer competes with window shopping.</p>,
    tradeoff: <p>Prices and availability shown on a cached page can be slightly stale, so the real check must happen again at checkout.</p>,
    realWorld: <p>Amazon’s Builders’ Library has a public article, “Caching challenges and strategies”, on the pitfalls of caches in front of services, such as cold starts and cache-dependent load.</p>,
  },
  {
    title: 'v2 · Services + an always-writable cart',
    scale: 'Many teams, many regions',
    added: ['gw', 'cart', 'cartdb', 'orderdb'],
    nodes: [N.shopper, N.cdn, N.catalog, N.catcache, N.gw, N.cart, N.cartdb, N.orderdb],
    edges: [...BROWSE, ...SERVICES, e('gw', 'orderdb')],
    flows: [{ name: 'Add to cart', path: ['shopper', 'gw', 'cart', 'cartdb'], steps: ['Shopper adds an item', 'Gateway routes to the cart service', 'Write accepted even during partitions; divergent versions are merged later'] }],
    problem: <p>The monolith’s release train slows every team, and a failed “add to cart” is lost revenue. It is better to accept a cart write and reconcile than to reject it.</p>,
    decision: <p>Decompose into services owned by small teams behind APIs. Store carts in a highly available key-value store that <strong>always accepts writes</strong> and merges conflicting versions (union of items) on read.</p>,
    tradeoff: <p>Merging by union means a deleted item can occasionally reappear. That is a deliberate product call: a resurrected item is cheaper than a lost one.</p>,
    realWorld: <p>Amazon’s <strong>Dynamo paper</strong> (SOSP 2007) uses the shopping cart as its motivating example for an always-writeable store, including the deleted-items-resurfacing anomaly. Amazon’s move to service-oriented architecture in the early 2000s is widely discussed publicly; the famous “API mandate” memo story is secondhand folklore, so treat it as such.</p>,
  },
  {
    title: 'v3 · Don’t sell what you don’t have',
    scale: 'Limited-stock deals',
    added: ['inv', 'invdb'],
    nodes: [N.shopper, N.cdn, N.catalog, N.catcache, N.gw, N.cart, N.cartdb, N.orderdb, N.inv, N.invdb],
    edges: [...BROWSE, ...SERVICES, e('gw', 'orderdb'), e('gw', 'inv'), e('inv', 'invdb')],
    flows: [{ name: 'Reserve', path: ['shopper', 'gw', 'inv', 'invdb'], steps: ['Shopper proceeds to checkout', 'Gateway asks inventory for a hold', 'Conditional decrement creates a hold with an expiry'] }],
    problem: <p>Two shoppers buy the last unit at the same moment and both get a confirmation. Or checkouts that are abandoned lock units forever and a deal shows “sold out” while stock sits unpaid.</p>,
    decision: <p>Inventory becomes its own service with <strong>atomic conditional decrements</strong> and <strong>time-limited holds</strong> that expire back into stock. The cart is optimistic; inventory is the strict gate.</p>,
    tradeoff: <p>Hold TTLs trade conversion for fairness: too short and paying customers lose their unit, too long and stock sits locked. The demo below lets you feel both.</p>,
  },
  {
    title: 'v4 · Orders as a workflow',
    scale: 'Payment, warehouses, carriers',
    added: ['orders', 'pay', 'fulfil'],
    nodes: [N.shopper, N.cdn, N.catalog, N.catcache, N.gw, N.cart, N.cartdb, N.orderdb, N.inv, N.invdb, N.orders, N.pay, N.fulfil],
    edges: [...BROWSE, ...SERVICES, ...SAGA],
    flows: [{ name: 'Place order', path: ['shopper', 'gw', 'orders', 'inv'], steps: ['Place order', 'Gateway starts the order workflow', 'Step 1 converts the hold to a reservation'] },
      { name: 'Compensate', path: ['orders', 'pay', 'orders', 'inv'], steps: ['Payment is declined', 'Workflow runs compensation', 'The reservation is released back to stock'] }],
    problem: <p>An order spans inventory, payment, fraud checks, warehouse assignment, and shipping, owned by different teams and databases. No single transaction can cover them.</p>,
    decision: <p>Model the order as a durable <strong>saga</strong>: a sequence of local steps, each with a compensating action (release stock, refund, cancel shipment), driven by a workflow engine that survives crashes.</p>,
    tradeoff: <p>Intermediate states become visible (“payment pending”), and every step must be idempotent because the orchestrator will retry.</p>,
  },
  {
    title: 'v5 · Search and recommendations',
    scale: 'Hundreds of millions of products',
    added: ['search'],
    nodes: [N.shopper, N.cdn, N.catalog, N.catcache, N.gw, N.cart, N.cartdb, N.orderdb, N.inv, N.invdb, N.orders, N.pay, N.fulfil, N.search],
    edges: LATE,
    flows: [{ name: 'Search', path: ['shopper', 'gw', 'search', 'catcache'], steps: ['Shopper searches', 'Search ranks candidates and recommendations', 'Results are hydrated from the catalog cache'] }],
    problem: <p>With a huge catalog, what shoppers <em>find</em> determines what they buy. Category pages don’t scale.</p>,
    decision: <p>A dedicated search index fed by catalog change events, plus recommendation services precomputing related items. Both read heavily from caches, not from the source databases.</p>,
    tradeoff: <p>Index freshness lags catalog changes, so price and stock must be re-checked at render or checkout.</p>,
    realWorld: <p>Amazon researchers published “item-to-item collaborative filtering” (Linden, Smith, York, IEEE Internet Computing, 2003), describing how recommendations were computed from related-item similarity rather than user similarity.</p>,
  },
  {
    title: 'v6 · Surviving Prime Day',
    scale: 'Planned peak, many times normal',
    added: ['waitq', 'cells'],
    nodes: [N.shopper, N.cdn, N.catalog, N.catcache, N.gw, N.cart, N.cartdb, N.orderdb, N.inv, N.invdb, N.orders, N.pay, N.fulfil, N.search, N.waitq, N.cells],
    edges: [...LATE, e('gw', 'waitq'), e('waitq', 'orders'), e('gw', 'cells', { label: 'route by shard' })],
    flows: [{ name: 'Peak checkout', path: ['shopper', 'gw', 'waitq', 'orders'], steps: ['Traffic spike at deal launch', 'Gateway admits what downstream can handle', 'Queued checkouts drain at a safe rate'] }],
    problem: <p>A planned event multiplies traffic, and hot deals concentrate it on a handful of SKUs. One overloaded dependency can cascade across the whole site.</p>,
    decision: <p><strong>Pre-scale</strong> ahead of the event, <strong>shed load</strong> early at the edge, queue checkouts for hot items, and split the stack into <strong>cells</strong> so a failure hits only a slice of customers.</p>,
    tradeoff: <p>Shoppers sometimes wait in a queue or see a degraded page. That is better than everyone timing out together.</p>,
    realWorld: <p>The Amazon Builders’ Library article “Using load shedding to avoid overload” and AWS guidance on cell-based architecture describe these techniques publicly. AWS also publishes a blog post about Prime Day scale most years.</p>,
  },
]
