import {
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, MentalModel, References, SideBySide, StatRow, Term, TLDR, VisualTimeline,
} from '../components/ui'
import {
  Blocks, Boxes, CreditCard, Lock, Rocket, Server, ShoppingCart, Sparkles, Truck, Workflow, Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeAmazonInventoryDemo } from './demos/episode-amazon-inventory-demo'
import { AMAZON_SRC } from './demos/episode-amazon-sources'
import { AMAZON_STAGES } from './demos/episode-amazon-stages'

const ORDER_NODES: ArchNode[] = [
  { id: 'shopper', label: 'Shopper', kind: 'client', x: 10, y: 50 },
  { id: 'gw', label: 'Checkout API', kind: 'lb', x: 30, y: 50,
    detail: 'Validates the cart, re-prices it (cached prices may be stale), and starts the order workflow with an idempotent order id.' },
  { id: 'cart', label: 'Cart', kind: 'service', x: 30, y: 14, detail: 'Read to get the items; cleared only after the order is committed.' },
  { id: 'orders', label: 'Order workflow', sub: 'orchestrator', kind: 'worker', x: 52, y: 50,
    detail: 'Durable state machine: each step is saved before the next starts, so a crash resumes instead of restarting.' },
  { id: 'inv', label: 'Inventory', kind: 'service', x: 52, y: 14, detail: 'Turns the checkout hold into a firm reservation; compensation releases it.' },
  { id: 'pay', label: 'Payments', kind: 'external', x: 72, y: 30, detail: 'Authorize now, capture at shipment; a decline triggers compensation.' },
  { id: 'orderdb', label: 'Orders DB', kind: 'db', x: 72, y: 70, detail: 'Order record plus workflow state; the confirmation email is driven from here.' },
  { id: 'fulfil', label: 'Fulfillment', kind: 'worker', x: 90, y: 50, detail: 'Chooses a warehouse, picks, packs, and ships, after the customer already sees “order placed”.' },
  { id: 'notify', label: 'Notifications', kind: 'queue', x: 52, y: 86 },
]
const ORDER_EDGES: ArchEdge[] = [
  { from: 'shopper', to: 'gw' }, { from: 'gw', to: 'cart' }, { from: 'gw', to: 'orders' }, { from: 'orders', to: 'inv' },
  { from: 'orders', to: 'pay' }, { from: 'orders', to: 'orderdb' }, { from: 'orders', to: 'fulfil', async: true },
  { from: 'orders', to: 'notify', async: true },
]

const REFS: Reference[] = Object.values(AMAZON_SRC)

// Timeline rows derive from the stage data so the two never drift apart.
const STAGE_ICONS: Record<string, LucideIcon> = {
  v0: Server, v1: Zap, v2: Sparkles, v3: Blocks, v4: ShoppingCart, v5: Lock, v6: Workflow, v7: CreditCard, v8: Boxes, v9: Rocket, v10: Truck,
}
const TIMELINE = AMAZON_STAGES.map((s) => {
  const [version, name] = s.title.split(' · ')
  return { when: s.era ?? '', title: name ?? s.title, note: typeof s.summary === 'string' ? s.summary : undefined, icon: STAGE_ICONS[version] }
})

export default function AmazonCheckoutEpisode() {
  return (
    <>
      <TLDR items={[
        'Each part of a store needs a different consistency model.',
        'Catalog: cached and slightly stale. Cart: always writable, merged later. Inventory: strict.',
        'An order is a saga: small local steps, each with an undo step.',
        'Flash sales are a hot-key problem; admission control beats adding shards.',
        'Cells, shuffle sharding, and pre-scaling keep big days boring.',
      ]} />
      <MentalModel id="ep-amazon" />
      <p>
        An online store looks like a simple database app until real traffic arrives. Browsing becomes a caching
        problem. The cart becomes an availability problem. Inventory becomes a race. The order becomes a transaction
        across many teams.
      </p>
      <p>
        This episode builds an Amazon-style checkout in 11 stages, from one database in 1995 to cells, Prime Day, and
        delivery promises. Two terms help. A <Term def="A sequence of local steps where each step has a compensating action that undoes it if a later step fails.">saga</Term> is
        how an order spans services without one big transaction. A <Term def="An independent copy of the whole stack that serves a subset of customers, so a failure stays inside it.">cell</Term> is
        a full copy of the stack that limits how many customers a failure can reach.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Notice how each part of the store picks a <em>different</em> consistency model. Open “Go deeper” on any stage
        for the request flow, numbers, alternatives, and sources.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Amazon; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <p>Years mark publicly documented milestones. “Design step” marks a step in our reconstruction that has no public date.</p>
      <VisualTimeline items={TIMELINE} />

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={AMAZON_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <StatRow caption="Illustrative figures from the assumptions below, not Amazon data" stats={[{ value: '≈ 2.8K / s', label: 'checkouts in the peak hour', note: 'illustrative' }, { value: '≈ 140K / s', label: 'catalog reads', note: 'illustrative' }, { value: '≈ 17K / s', label: 'writes on one hot item', note: 'illustrative' }]} />
      <EstimationTable
        assumptions={[
          'Peak hour: 10M checkouts (illustrative, not an Amazon figure)', '~50 page views per checkout (assumption)',
          'A hot deal: 1K units, 1M shoppers trying in the first minute (illustrative)',
        ]}
        rows={[
          { label: 'Checkout rate', math: '10M / 3,600 s', result: '≈ 2.8K/s' },
          { label: 'Catalog reads', math: '2.8K × 50', result: '≈ 140K/s' },
          { label: 'Read : checkout', math: '50 : 1', result: 'cache everything' },
          { label: 'Hot-item contention', math: '1M / 60 s on one row', result: '≈ 17K/s on 1 key' },
        ]}
      />
      <p>
        The totals are manageable by adding machines. The last number is the dangerous one: <strong>thousands of
        writes per second on a single item</strong>. Sharding cannot split one key, so you need admission control,
        holds, and sometimes a deliberate queue.
      </p>

      <H2 id="place-order">What happens when you click “Place order”</H2>
      <ArchitectureDiagram nodes={ORDER_NODES} edges={ORDER_EDGES} height={380}
        caption="The customer sees “order placed” after a few synchronous steps; everything else is asynchronous"
        flows={[
          { name: 'Place order', path: ['shopper', 'gw', 'orders', 'inv'], steps: ['Shopper clicks Place order', 'Checkout API starts the workflow with an idempotent order id', 'Workflow firms up the inventory reservation'] },
          { name: 'Pay', path: ['orders', 'pay', 'orders', 'orderdb'], steps: ['Authorize payment', 'Result recorded in the workflow', 'Order committed; the customer sees confirmation'] },
          { name: 'Ship', path: ['orders', 'fulfil'], steps: ['Fulfillment picks a warehouse and ships later'] },
        ]} />
      <CodeBlock lang="ts" title="order saga with compensations (sketch)" code={`
const placeOrder = workflow('place-order', async (ctx, order: Order) => {
  // Each step is persisted; on crash the engine resumes at the last completed step.
  const hold = await ctx.step('reserve', () => inventory.reserve(order.items, order.id))
  try {
    await ctx.step('authorize', () => payments.authorize(order.total, { idempotencyKey: order.id }))
  } catch (declined) {
    await ctx.step('release', () => inventory.release(hold.id)) // compensation
    return { status: 'payment_failed' }
  }
  await ctx.step('commit', () => orders.markPlaced(order.id))
  ctx.startChild('fulfil', order.id) // async, may take days
  return { status: 'placed' }
})`} />

      <H2 id="inventory">Deep dive: selling the last unit exactly once</H2>
      <p>
        Inventory is the one place in a store where “eventually consistent” means refunds and angry customers. Try the
        strategies below at high concurrency.
      </p>
      <ul>
        <li><strong>Read, then write</strong> oversells, because concurrent buyers read the same count.</li>
        <li>An <strong>atomic decrement</strong> never oversells, but abandoned checkouts leave units stuck.</li>
        <li><strong>Reservations with a timeout</strong> return those units, as long as the timeout is longer than a normal payment.</li>
      </ul>
      <EpisodeAmazonInventoryDemo />
      <CodeBlock lang="text" title="conditional decrement + hold (SQL-ish)" code={`
-- Succeeds only if stock remains; 0 rows updated means sold out.
UPDATE inventory SET available = available - 1
 WHERE sku = :sku AND available > 0;

INSERT INTO holds (hold_id, sku, order_id, expires_at)
VALUES (:hold, :sku, :order, now() + interval '10 minutes');

-- Sweeper: expired, unpaid holds go back on sale.
UPDATE inventory SET available = available + 1 WHERE sku = :sku;  -- per expired hold`} />

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <p>The three consistency choices at the heart of the store:</p>
      <SideBySide panels={[
        { title: 'Always-writable cart, merge on read', icon: ShoppingCart, tone: 'good', points: ['+ Losing an add-to-cart costs more than a returning item', '- Instead of: a strongly consistent SQL row'], verdict: 'Cart' },
        { title: 'Conditional decrement + expiring holds', icon: Lock, tone: 'good', points: ['+ No oversell', '+ No stock locked by abandoned carts', '- Instead of: decrement at payment only'], verdict: 'Inventory' },
        { title: 'Saga with compensations', icon: Workflow, tone: 'good', points: ['+ Steps span teams and payment providers', '- Instead of: distributed two-phase commit'], verdict: 'Order' },
      ]} />
      <p>Other decisions, in brief:</p>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Catalog', cells: ['Cached, slightly stale', 'Read from the source DB', 'Reads dwarf writes; staleness is re-checked at checkout'] },
          { label: 'Blast radius', cells: ['Cells + shuffle sharding', 'One shared fleet', 'A bad deploy or noisy customer hits a small slice'] },
          { label: 'Peak traffic', cells: ['Pre-scale + shed + queue', 'Reactive autoscaling', 'Planned spikes arrive faster than autoscaling reacts'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Consistency per domain.</strong> Say which parts can be stale, which must merge, and which must be strict, and why the business accepts each.</li>
          <li><strong>Hot keys beat averages.</strong> A flash sale is contention on one row. Talk about admission control and queues, not just shards.</li>
          <li><strong>Plan for the planned peak.</strong> Load tests at target traffic, pre-scaling, kill switches, and shedding the least valuable work first.</li>
          <li><strong>Blast radius.</strong> Cells turn a site-wide outage into a partial one; deploy cell by cell.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="A lightning deal has 1,000 units and a million shoppers click Buy in the same minute. How do you avoid overselling without melting the database?"
        senior={<p>Use an atomic conditional update (decrement where stock &gt; 0) so the database prevents overselling, and cache reads of the remaining count.</p>}
        staff={<>
          <p>The conditional decrement gives correctness, but one hot row cannot take a million attempts a minute. Put <strong>admission control</strong> in front: a queue or token gate that lets about the remaining stock (plus a margin) through, and tells everyone else “sold out” or “waitlist” right away.</p>
          <p>To spread writes, split stock into buckets (for example 10 rows of 100 units) and decrement a random bucket. Holds get a timeout a bit longer than a normal payment. The displayed count is approximate; the decrement is the only truth.</p>
        </>}
        followUps={['How do you size the hold timeout?', 'What does the shopper see while queued?', 'How do you stop bots from taking the stock?']}
      />
      <InterviewQuestion
        q="Why would you let the shopping cart accept conflicting writes instead of making it strongly consistent?"
        senior={<p>Availability matters more for the cart. If the database is partitioned, customers can still add items, and conflicts are resolved later.</p>}
        staff={<>
          <p>It is an explicit business trade-off. A rejected add-to-cart is lost revenue. A conflict is rare and cheap to merge. The visible failure, a deleted item returning, is easy for the user to fix.</p>
          <p>The key is scope: the relaxed model applies to the <em>cart only</em>. Checkout re-checks price and stock against strict systems, so a merged cart can never create a wrong order.</p>
        </>}
        followUps={['How would you merge a quantity change against a deletion?', 'Where exactly does the strict check happen?']}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Pick a consistency model per domain: cached catalog, mergeable cart, strict inventory, eventual fulfillment.',
        'Prevent overselling with atomic conditional writes; return abandoned stock with expiring holds.',
        'Orders span teams and providers, so model them as a durable saga with compensations, not 2PC.',
        'Cells and shuffle sharding shrink the blast radius of bad deploys and noisy customers.',
        'Planned peaks need pre-scaling, load shedding, and queues; delivery promises need stock and network data.',
      ]} />
    </>
  )
}
