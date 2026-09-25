import {
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode } from '../components/ui'
import { EpisodeAmazonInventoryDemo } from './demos/episode-amazon-inventory-demo'
import { AMAZON_STAGES } from './demos/episode-amazon-stages'

const ORDER_NODES: ArchNode[] = [
  { id: 'shopper', label: 'Shopper', kind: 'client', x: 10, y: 50 },
  { id: 'gw', label: 'Checkout API', kind: 'lb', x: 30, y: 50,
    detail: 'Validates the cart, re-prices it (cached prices may be stale), and starts the order workflow with an idempotent order id.' },
  { id: 'cart', label: 'Cart', kind: 'service', x: 30, y: 14, detail: 'Read to get the items; cleared only after the order is committed.' },
  { id: 'orders', label: 'Order workflow', sub: 'orchestrator', kind: 'worker', x: 52, y: 50,
    detail: 'Durable state machine: each step is persisted before the next starts, so a crash resumes instead of restarting.' },
  { id: 'inv', label: 'Inventory', kind: 'service', x: 52, y: 14, detail: 'Converts the checkout hold into a firm reservation; compensation releases it.' },
  { id: 'pay', label: 'Payments', kind: 'external', x: 72, y: 30, detail: 'Authorize now, capture at shipment; a decline triggers compensation.' },
  { id: 'orderdb', label: 'Orders DB', kind: 'db', x: 72, y: 70, detail: 'Order record plus workflow state; the confirmation email is driven from here.' },
  { id: 'fulfil', label: 'Fulfillment', kind: 'worker', x: 90, y: 50, detail: 'Chooses a warehouse, picks, packs, and ships, all asynchronously after the customer sees “order placed”.' },
  { id: 'notify', label: 'Notifications', kind: 'queue', x: 52, y: 86 },
]
const ORDER_EDGES: ArchEdge[] = [
  { from: 'shopper', to: 'gw' }, { from: 'gw', to: 'cart' }, { from: 'gw', to: 'orders' }, { from: 'orders', to: 'inv' },
  { from: 'orders', to: 'pay' }, { from: 'orders', to: 'orderdb' }, { from: 'orders', to: 'fulfil', async: true },
  { from: 'orders', to: 'notify', async: true },
]

export default function AmazonCheckoutEpisode() {
  return (
    <>
      <p>
        An online store looks like a CRUD app until real traffic arrives. Browsing is a caching problem, the cart is
        an availability problem, inventory is a concurrency problem, and the order is a distributed transaction
        across teams. This episode builds an Amazon-style checkout from a single database to a cell-based system
        that survives a planned traffic peak.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Notice how each part of the store gets a <em>different</em> consistency model: stale is fine for the catalog,
        merge-on-read for the cart, strict for inventory, eventual for fulfillment. Picking the right one per part is
        the skill being tested.
      </Callout>

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={AMAZON_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <EstimationTable
        assumptions={[
          'Peak hour: 10M checkouts (illustrative, not an Amazon figure)', '~50 page views per checkout (assumption)',
          'A hot deal: 1K units, 1M shoppers trying in the first minute (illustrative)',
        ]}
        rows={[
          { label: 'Checkout rate', math: '10M / 3,600 s', result: '≈ 2.8K/s' },
          { label: 'Catalog reads', math: '2.8K × 50', result: '≈ 140K/s' },
          { label: 'Read:checkout ratio', math: '50 : 1', result: 'cache everything' },
          { label: 'Hot-SKU contention', math: '1M / 60 s on one row', result: '≈ 17K/s on 1 key' },
        ]}
      />
      <p>
        The totals are manageable with horizontal scaling. The dangerous number is the last one: <strong>thousands of
        writes per second on a single SKU</strong>. No amount of sharding helps a hot key, so you need admission
        control, holds, and sometimes deliberate queueing.
      </p>

      <H2 id="place-order">What happens when you click “Place order”</H2>
      <ArchitectureDiagram nodes={ORDER_NODES} edges={ORDER_EDGES} height={380}
        caption="The customer sees “order placed” after a few synchronous steps; everything else is asynchronous"
        flows={[
          { name: 'Place order', path: ['shopper', 'gw', 'orders', 'inv'], steps: ['Shopper clicks Place order', 'Checkout API starts the workflow with an idempotent order id', 'Workflow firms up the inventory reservation'] },
          { name: 'Pay', path: ['orders', 'pay', 'orders', 'orderdb'], steps: ['Authorize payment', 'Result recorded in the workflow', 'Order committed; the customer sees confirmation'] },
          { name: 'Ship', path: ['orders', 'fulfil'], steps: ['Fulfillment picks a warehouse and ships asynchronously'] },
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
        Inventory is the one place in the store where “eventually consistent” means refunds and angry customers. Try
        the three strategies below with high concurrency. <strong>Read, then write</strong> oversells because
        concurrent buyers read the same count. An <strong>atomic decrement</strong> never oversells, but abandoned
        checkouts leave units stuck. <strong>Reservations with a TTL</strong> return those units to sale, as long as
        the TTL is longer than a normal payment takes.
      </p>
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
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Catalog', cells: ['Cached, eventually consistent', 'Read from source DB', 'Reads dwarf writes; staleness is re-checked at checkout'] },
          { label: 'Cart', cells: ['Always-writable KV, merge on read', 'Strongly consistent SQL row', 'Losing an add-to-cart costs more than a resurrected item'] },
          { label: 'Inventory', cells: ['Conditional decrement + TTL holds', 'Decrement at payment only', 'Prevents oversell without locking stock behind abandoned carts'] },
          { label: 'Order', cells: ['Saga with compensations', 'Distributed 2PC', 'Steps span teams and external payment providers; 2PC blocks on failure'] },
          { label: 'Peak traffic', cells: ['Pre-scale + shed + queue + cells', 'Autoscale reactively', 'Planned spikes arrive faster than autoscaling reacts'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Consistency per domain, not per system.</strong> Say out loud which parts can be stale, which must merge, and which must be strict, and why the business accepts each.</li>
          <li><strong>Hot keys beat averages.</strong> A flash sale is a contention problem on one row. Talk about admission control and queuing, not just adding shards.</li>
          <li><strong>Plan for the planned peak.</strong> Load tests at target traffic, pre-scaling, feature kill switches, and shedding the least valuable traffic first (recommendations before checkout).</li>
          <li><strong>Blast radius.</strong> Cells turn a site-wide outage into a partial one; deploy cell by cell.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="A lightning deal has 1,000 units and a million shoppers click Buy in the same minute. How do you avoid overselling without melting the database?"
        senior={<p>Use an atomic conditional update (decrement where stock &gt; 0) so the database prevents overselling, and put a cache in front for reads of the remaining count.</p>}
        staff={<>
          <p>The conditional decrement gives correctness, but a single hot row can’t take a million attempts a minute. I’d put <strong>admission control</strong> in front: a queue or token gate that lets roughly the remaining stock (plus a margin for abandonment) through to inventory and tells everyone else “sold out” or “waitlist” immediately.</p>
          <p>To spread write load, split the stock into sub-buckets (e.g. 10 rows of 100 units) and decrement a random bucket, retrying another bucket on empty. Holds carry a TTL a bit longer than normal payment latency so abandoned checkouts return stock. The displayed count is approximate and cached; the decrement is the only source of truth.</p>
        </>}
        followUps={['How do you size the hold TTL?', 'What does the shopper see while queued?', 'How do you stop bots from grabbing the stock?']}
      />
      <InterviewQuestion
        q="Why would you let the shopping cart accept conflicting writes instead of making it strongly consistent?"
        senior={<p>Availability matters more for the cart; if the database is partitioned, we still want customers to add items. We can resolve conflicts later.</p>}
        staff={<>
          <p>It’s a business trade-off made explicit. A rejected add-to-cart is lost revenue, while a conflict is rare and cheap to resolve by merging (union of items). The failure mode, a deleted item reappearing, is visible and the user can fix it.</p>
          <p>The key is scoping: this relaxed model applies to the <em>cart only</em>. Checkout re-validates price and stock against strict systems, so a stale or merged cart can never produce an incorrect order.</p>
        </>}
        followUps={['How would you merge a quantity change against a deletion?', 'Where exactly does the strict check happen?']}
      />

      <KeyTakeaways items={[
        'Pick a consistency model per domain: cached catalog, mergeable cart, strict inventory, eventual fulfillment.',
        'Oversell prevention needs atomic conditional writes; abandoned checkouts need holds that expire.',
        'Orders span teams and providers, so model them as a durable saga with compensations, not 2PC.',
        'Flash sales are hot-key problems: admission control and bucketed stock beat more shards.',
        'Planned peaks need pre-scaling, load shedding, queuing, and cells to cap the blast radius.',
      ]} />
    </>
  )
}
