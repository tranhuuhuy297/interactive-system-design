import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements, References, TLDR, Term,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { ExchangeOrderBookDemo } from './demos/exchange-order-book-demo'
import { ExchangeSequencerReplayDemo } from './demos/exchange-sequencer-replay-demo'

const NODES: ArchNode[] = [
  { id: 'broker', label: 'Brokers', sub: 'FIX / binary', kind: 'client', x: 8, y: 50 },
  { id: 'gw', label: 'Gateway', sub: 'session, throttle', kind: 'lb', x: 25, y: 50,
    detail: 'Handles broker sessions, message validation and per-client rate limits. Stateless apart from session sequence numbers, and co-located with brokers in the same data center.' },
  { id: 'risk', label: 'Risk checks', sub: 'pre-trade', kind: 'service', x: 44, y: 18,
    detail: 'Price bands, fat-finger limits, credit and position limits. Must finish in microseconds, so state is held in memory and updated from the engine output stream.' },
  { id: 'seq', label: 'Sequencer', sub: 'total order', kind: 'queue', x: 44, y: 80,
    detail: 'Stamps every inbound message with a gap-free sequence number and persists it. From this point the order of events is fixed and replayable. It is the heart of determinism and fairness.' },
  { id: 'engine', label: 'Matching engine', sub: 'single-threaded', kind: 'service', x: 66, y: 50,
    detail: 'One thread per symbol (or symbol shard) applies sequenced events to an in-memory order book. No locks, no I/O on the hot path; outputs (acks, fills) are themselves sequenced.' },
  { id: 'standby', label: 'Standby engine', sub: 'hot replica', kind: 'service', x: 66, y: 88,
    detail: 'Consumes the same sequenced log and holds an identical book. Failover means catching up to the log tail and taking over, typically in well under a second.' },
  { id: 'md', label: 'Market data', sub: 'L1 / L2 feed', kind: 'service', x: 88, y: 18,
    detail: 'Publishes top-of-book, depth and trades, usually over UDP multicast so every subscriber receives updates at the same time, with a TCP recovery channel for gaps.' },
  { id: 'rep', label: 'Reporter', sub: 'clearing, audit', kind: 'db', x: 88, y: 55,
    detail: 'Off the hot path: persists executions for clearing and settlement, regulatory audit trails and end-of-day reports.' },
  { id: 'log', label: 'Event log', sub: 'replicated', kind: 'storage', x: 88, y: 88,
    detail: 'Durable, replicated journal of every sequenced input. The whole exchange state is a pure function of this log.' },
]

const EDGES: ArchEdge[] = [
  { from: 'broker', to: 'gw' }, { from: 'gw', to: 'risk' }, { from: 'risk', to: 'seq' }, { from: 'seq', to: 'engine' },
  { from: 'seq', to: 'log' }, { from: 'log', to: 'standby', async: true }, { from: 'engine', to: 'md' },
  { from: 'engine', to: 'rep', async: true },
]

const REFS: Reference[] = [
  { title: 'The LMAX Architecture', source: 'M. Fowler', year: 2011, url: 'https://martinfowler.com/articles/lmax.html', kind: 'blog', note: 'single-threaded engine, event sourcing, replay' },
  { title: 'LMAX Disruptor', source: 'LMAX Exchange', url: 'https://lmax-exchange.github.io/disruptor/', kind: 'docs', note: 'pre-allocated ring buffers between stages' },
  { title: 'FIX Protocol standards', source: 'FIX Trading Community', url: 'https://www.fixtrading.org/standards/', kind: 'docs', note: 'NewOrderSingle, ExecutionReport messages' },
  { title: 'Nasdaq TotalView-ITCH 5.0 specification', source: 'Nasdaq', url: 'https://www.nasdaqtrader.com/content/technicalsupport/specifications/dataproducts/NQTVITCHspecification.pdf', kind: 'docs', note: 'sequenced binary market data' },
  { title: 'System Design Interview – An Insider’s Guide, Volume 2', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'stock exchange prompt' },
]

export default function StockExchangeChapter() {
  return (
    <>
      <TLDR items={[
        'Core problem: match buy and sell orders fairly, in microseconds, without ever losing or reordering one.',
        'Key decision: a sequencer gives every order a number, and a single-threaded in-memory engine processes them in that order.',
        'The hard part: tail latency. One pause or cache miss can cost more than the whole matching budget.',
        'Staff insight: the engine is a deterministic state machine, so the journal gives failover, replay and audit for free.',
      ]} />
      <p>
        Most system design questions reward horizontal scale and eventual consistency. The stock exchange rewards the
        opposite: <strong>one ordered stream, processed deterministically, as fast as physics allows</strong>.
      </p>
      <p>
        The core insight: a{' '}
        <Term def="The component that pairs incoming buy and sell orders according to the exchange's priority rules.">matching engine</Term>{' '}
        is a state machine. If every replica applies the same inputs in the same order, they reach the same state.
      </p>
      <p>
        So put a{' '}
        <Term def="The single component that stamps every incoming message with the next number in one global order.">sequencer</Term>{' '}
        in front and a{' '}
        <Term def="An append-only, durable log of every sequenced message.">journal</Term>{' '}
        behind. Keep the hot path single-threaded and in memory.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>First, agree on order types, fairness and latency. Here fairness and determinism are hard requirements, not nice-to-haves.</p>
      <Requirements
        functional={['Accept, cancel and amend limit and market orders', 'Match with price-time priority; partial fills', 'Publish market data (top of book, depth, trades)', 'Pre-trade risk checks; execution reports to brokers']}
        nonFunctional={['Deterministic and fair: same inputs → same outcome, no queue-jumping', 'Matching latency in microseconds; tail latency matters more than the average', 'No lost or duplicated orders; full audit trail', 'Fast failover with zero data loss']}
        outOfScope={['Clearing and settlement internals', 'Retail brokerage apps', 'Derivatives pricing']}
      />

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>Next, turn message volume into a per-message time budget. That budget, not throughput, drives the design.</p>
      <EstimationTable
        assumptions={['Illustrative mid-size venue: 100M order messages/day', '6.5 h trading session; opening and closing auctions create bursts', '~100 bytes per sequenced message']}
        rows={[
          { label: 'Session seconds', math: '6.5 h × 3,600', result: '23,400 s' },
          { label: 'Average rate', math: '100M / 23,400', result: '≈ 4.3K msg/s' },
          { label: 'Burst rate', math: '4.3K × 10–100', result: '≈ 50–400K msg/s' },
          { label: 'Journal size', math: '100M × 100 B', result: '≈ 10 GB/day' },
          { label: 'Budget per message', math: '1 s / 400K', result: '≈ 2.5 µs' },
        ]}
      />
      <p>
        Throughput is modest; a single core handles it. The hard part is <strong>latency and determinism at the
        tail</strong>.
      </p>
      <p>
        A single garbage-collection pause or cross-core cache miss can be worth more than the whole matching budget.
        Storage is tiny, so keep the entire book in memory.
      </p>

      <H2 id="api">3 · API</H2>
      <p>
        Brokers speak{' '}
        <Term def="Financial Information eXchange: the standard messaging protocol between brokers and trading venues.">FIX</Term>{' '}
        or a binary protocol over TCP, not REST. The operations map onto the order lifecycle plus a market-data feed.
      </p>
      <ApiSpec endpoints={[
        { method: 'POST', path: 'NewOrderSingle', desc: 'Submit an order (FIX or a binary protocol over TCP, not REST).', body: '{ clOrdId, symbol, side, type, price?, qty, tif }', returns: 'ExecutionReport: ack · fill · partial · reject' },
        { method: 'DELETE', path: 'OrderCancelRequest', desc: 'Cancel a resting order by clOrdId.', returns: 'ExecutionReport: cancelled | reject' },
        { method: 'PATCH', path: 'OrderCancelReplace', desc: 'Amend price or qty. Increasing qty or changing price loses time priority.', returns: 'ExecutionReport' },
        { method: 'WS', path: 'Market data feed', desc: 'Multicast L1/L2 updates with sequence numbers; recover gaps over a snapshot/retransmit channel.', returns: 'stream of book deltas + trades' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>Now connect the pieces. The sequencer divides the diagram: parallel work on the left, strictly ordered work on the right.</p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Everything left of the sequencer can be parallel; everything right of it is ordered"
        flows={[
          { name: 'New order', path: ['broker', 'gw', 'risk', 'seq', 'engine', 'md'],
            steps: ['Broker sends a limit order', 'Gateway validates the session and throttles', 'Pre-trade risk check passes', 'Sequencer assigns seq #N and journals it', 'Engine matches against the book, emits fills', 'Market data publishes the new top of book and the trade'] },
          { name: 'Failover', path: ['seq', 'log', 'standby'],
            steps: ['Every sequenced event is journaled', 'Standby replays the journal to the tail, then promotes itself'] },
          { name: 'Post-trade', path: ['engine', 'rep'],
            steps: ['Executions flow asynchronously to clearing, audit and reporting'] },
        ]} />

      <H2 id="matching">5 · Deep dive: order book and matching</H2>
      <p>
        Here we decide how orders are stored and matched. Each symbol's{' '}
        <Term def="The list of all resting buy orders (bids) and sell orders (asks) for one symbol, sorted by price.">order book</Term>{' '}
        has two sides. Bids are sorted by price descending, asks ascending. Within a price level, orders queue{' '}
        <strong>first in, first out</strong>.
      </p>
      <p>
        An incoming order that crosses the{' '}
        <Term def="The gap between the highest bid and the lowest ask.">spread</Term>{' '}
        trades against the best{' '}
        <Term def="An order sitting in the book waiting for a counterparty.">resting orders</Term>{' '}
        <em>at the resting price</em>. It keeps trading until it is filled or no longer crosses.
      </p>
      <p>The remainder of a limit order rests; the remainder of a market order is cancelled. Try it in the demo.</p>
      <ExchangeOrderBookDemo />
      <CodeBlock lang="ts" title="core matching loop (price-time priority)" code={`
function match(order: Order, book: Book): Trade[] {
  const opposite = order.side === 'buy' ? book.asks : book.bids
  const trades: Trade[] = []
  while (order.qty > 0 && !opposite.isEmpty() && crosses(order, opposite.best())) {
    const resting = opposite.best()          // best price, then oldest
    const qty = Math.min(order.qty, resting.qty)
    trades.push({ price: resting.price, qty, maker: resting.id, taker: order.id })
    order.qty -= qty
    resting.qty -= qty
    if (resting.qty === 0) opposite.popBest()
  }
  if (order.qty > 0 && order.type === 'limit') book.rest(order)
  return trades
}`} />
      <p>Which data structure holds each side? Cancels dominate traffic, so they must be cheap too.</p>
      <CompareTable
        columns={['Structure', 'Best price', 'Insert / cancel', 'Notes']}
        rows={[
          { label: 'Sorted map of price → FIFO list', cells: ['Red-black tree / skip list', 'O(1) cached', 'O(log P) + O(1) with an id → node index', 'The classic answer'] },
          { label: 'Array indexed by price tick', cells: ['Flat array + best pointer', 'O(1)', 'O(1)', 'Fastest when the price range is bounded; cache friendly'] },
          { label: 'Heap', cells: ['Binary heap', 'O(1)', 'O(log n); cancel is awkward', 'Poor fit: cancels are ~90%+ of traffic on many venues'] },
        ]}
      />

      <H2 id="sequencer">6 · Deep dive: sequencer, determinism and failover</H2>
      <p>Next, how the system stays correct when a machine dies. Kill the primary in the demo and watch the standby catch up.</p>
      <ExchangeSequencerReplayDemo />
      <ul>
        <li><strong>Total order</strong>: the sequencer is the single place where "who was first" is decided. Everything downstream is a deterministic function of its output. That is also the fairness guarantee.</li>
        <li><strong><Term def="Storing the sequence of events as the source of truth, and deriving current state by replaying them.">Event sourcing</Term></strong>: the journal <em>is</em> the database. The book is a cache you can rebuild by replaying from a snapshot plus the tail.</li>
        <li><strong>Determinism discipline</strong>: no wall-clock reads, random numbers or hash-map iteration order in the engine. Time comes from the sequencer's timestamp in the event.</li>
        <li><strong>Hot standby</strong>: replicas consume the same log. Promote only after the replica has applied the last committed sequence number, or you split-brain the market.</li>
      </ul>

      <H2 id="latency">7 · Deep dive: the low-latency toolbox</H2>
      <p>Last, how to hit a budget of a few microseconds. Each technique removes work from the hot path.</p>
      <CompareTable
        columns={['Technique', 'Why it helps']}
        rows={[
          { label: 'Single-threaded hot path', cells: ['Engine thread pinned to a core', 'No locks, no contention, predictable cache behaviour'] },
          { label: 'Ring buffers', cells: ['Pre-allocated, lock-free queues between stages', 'No allocation, so no GC pauses; mechanical sympathy'] },
          { label: 'Kernel bypass', cells: ['DPDK / RDMA / specialised NICs', 'Skip the kernel network stack: microseconds per hop'] },
          { label: 'mmap journal', cells: ['Append to memory-mapped files, replicate in parallel', 'Durability without blocking on fsync for every message'] },
          { label: 'Co-location', cells: ['Brokers rack-mounted next to the gateway', 'Speed of light: ~5 µs per km of fibre'] },
          { label: 'Symbol sharding', cells: ['One engine per symbol group', 'Scale out; no cross-symbol ordering needed'] },
        ]}
      />
      <Callout kind="pitfall">
        Proposing Kafka and a microservice per step on the order path. Those are fine for post-trade reporting, but on
        the hot path every network hop and broker adds tens to hundreds of microseconds and jitter. Keep the core in
        one process, or at most a few co-located processes on shared-memory queues.
      </Callout>

      <H2 id="data-model">8 · Data model</H2>
      <p>The book lives in memory; only the sequenced events are durably written on the hot path.</p>
      <CodeBlock lang="ts" title="in-memory structures + sequenced events" code={`
type Order = { id: bigint; side: 'buy' | 'sell'; price: number /* ticks */; qty: number; seq: bigint }
type PriceLevel = { price: number; totalQty: number; orders: Order[] /* FIFO */ }
type OrderBook = { symbol: string; bids: PriceLevel[]; asks: PriceLevel[]; byId: Map<bigint, Order> }

// Journal entry: the only thing that is durably persisted on the hot path
type SequencedEvent = {
  seq: bigint           // gap-free, assigned by the sequencer
  ts: bigint            // sequencer timestamp, used as the engine's clock
  kind: 'new' | 'cancel' | 'replace'
  payload: Uint8Array   // fixed-size binary message
}`} />

      <H2 id="staff">9 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Fairness is a product requirement</strong>: equal cable lengths in co-location, multicast market data so nobody sees it first, and a documented sequencing point. Some venues add deliberate speed bumps.</li>
          <li><strong>Auctions and circuit breakers</strong>: opening and closing auctions use a different matching algorithm (a uniform clearing price), and volatility halts must be deterministic events in the log.</li>
          <li><strong>Operability</strong>: replay from the journal gives you perfect reproduction of any incident, a "time machine" for debugging and audits.</li>
          <li><strong>Disaster recovery</strong>: the synchronous journal replicates within the metro area; the remote DR site is asynchronous. Be explicit about the RPO trade-off.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Why is the matching engine single-threaded? Wouldn't multiple threads be faster?"
        senior={<p>Matching must be done in strict order, so parallelism inside one order book would need locks and could reorder orders. A single thread avoids locks and is fast enough for one symbol.</p>}
        staff={<>
          <p>For one book, the work per message is tiny (a few hundred nanoseconds), so coordination costs would dominate. Locks, cache-line bouncing and memory fences cost more than the matching itself. </p>
          <p>Single-threading also gives <strong>determinism</strong>, which unlocks replicas, replay and audit for free.</p>
          <p>Parallelism happens <em>around</em> the core: gateways and risk scale out, and books shard by symbol, one engine thread per shard. The only cross-symbol concern is shared risk limits. Those can be checked pre-sequencer with a conservative reservation, or post-trade with kill switches.</p>
        </>}
        followUps={['How do you handle a symbol that gets 10× normal traffic?', 'How do cross-symbol risk limits work without breaking isolation?']}
      />
      <InterviewQuestion
        q="The primary matching engine crashes mid-session. Walk me through recovery."
        senior={<p>A hot standby with the same state takes over. Since both process the same log, the standby is already up to date, so we fail over and brokers reconnect.</p>}
        staff={<>
          <p>The journal decides what happened. Any message with a committed sequence number happened; anything not yet sequenced didn't, and brokers resend it using their session sequence numbers. The standby:</p>
          <ol>
            <li>Fences the old primary (epoch bump) so it can't publish again.</li>
            <li>Replays to the last committed sequence number and verifies a state checksum.</li>
            <li>Republishes any outputs the primary may not have emitted. Outputs carry sequence numbers, so downstream consumers dedupe.</li>
            <li>Resumes.</li>
          </ol>
          <p>If it can't reach the committed tail, I would <strong>halt the market</strong> rather than guess: trading on a divergent book is worse than a short halt.</p>
        </>}
        followUps={['How do you avoid split-brain between primary and standby?', 'What does the broker see during failover?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'An exchange is a deterministic state machine: sequencer → journal → single-threaded engine.',
        'Price-time priority: best price first, then FIFO within the level. Trades print at the resting order\'s price.',
        'The journal is the source of truth; the in-memory book can always be rebuilt by replay.',
        'Latency is won by removing work from the hot path: no locks, no allocation, no kernel, no extra hops.',
        'Failover = fence the old primary, replay to the committed tail, verify, resume. Halt if you can\'t be sure.',
      ]} />
    </>
  )
}
