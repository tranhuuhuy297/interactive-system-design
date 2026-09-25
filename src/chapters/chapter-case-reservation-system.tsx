import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements, References,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { ReserveRaceDemo } from './demos/reserve-race-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Guest', sub: 'web / app', kind: 'client', x: 10, y: 45 },
  { id: 'cdn', label: 'CDN', sub: 'photos, static', kind: 'cdn', x: 26, y: 15 },
  { id: 'gw', label: 'API gateway', sub: 'auth, rate limit', kind: 'lb', x: 26, y: 62 },
  { id: 'wait', label: 'Waiting room', sub: 'flash sales only', kind: 'service', x: 26, y: 90,
    detail: 'For ticket drops: admit users at a controlled rate with signed tokens, so the booking tier sees a steady flow instead of a stampede.' },
  { id: 'search', label: 'Search & rates', kind: 'service', x: 48, y: 25,
    detail: 'Read-heavy and stale-tolerant. Serve availability from a cache or search index refreshed from inventory events. Re-check truth at booking time.' },
  { id: 'cache', label: 'Availability cache', kind: 'cache', x: 70, y: 12 },
  { id: 'resv', label: 'Reservation service', kind: 'service', x: 48, y: 65,
    detail: 'Owns the invariant that no room-night is sold beyond capacity. Uses an atomic conditional update in the same transaction as the reservation insert, plus an idempotency key.' },
  { id: 'db', label: 'Inventory + reservations', sub: 'SQL, sharded by hotel', kind: 'db', x: 73, y: 62,
    detail: 'One row per (hotel, room_type, date). Every booking touches only one hotel, so sharding by hotel_id keeps each transaction on a single shard.' },
  { id: 'pay', label: 'Payment service', kind: 'external', x: 90, y: 40 },
  { id: 'q', label: 'Events', sub: 'Kafka', kind: 'queue', x: 73, y: 90,
    detail: 'Emits reservation.created and cancelled for the availability cache, email and analytics. Written through an outbox.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'cdn' }, { from: 'client', to: 'gw' }, { from: 'client', to: 'wait' }, { from: 'wait', to: 'gw' },
  { from: 'gw', to: 'search' }, { from: 'gw', to: 'resv' }, { from: 'search', to: 'cache' },
  { from: 'resv', to: 'db' }, { from: 'resv', to: 'pay' }, { from: 'db', to: 'q', async: true }, { from: 'q', to: 'cache', async: true },
]

const REFS: Reference[] = [
  { title: 'Transaction isolation (READ COMMITTED update re-check)', source: 'PostgreSQL documentation', url: 'https://www.postgresql.org/docs/current/transaction-iso.html', kind: 'docs', note: 'a blocked UPDATE re-evaluates its WHERE clause' },
  { title: 'Explicit locking (row-level locks)', source: 'PostgreSQL documentation', url: 'https://www.postgresql.org/docs/current/explicit-locking.html', kind: 'docs', note: 'SELECT … FOR UPDATE, deadlocks' },
  { title: 'Constraints (CHECK, UNIQUE)', source: 'PostgreSQL documentation', url: 'https://www.postgresql.org/docs/current/ddl-constraints.html', kind: 'docs', note: 'database-enforced backstops' },
  { title: 'SET command (NX, EX options)', source: 'Redis documentation', url: 'https://redis.io/docs/latest/commands/set/', kind: 'docs', note: 'per-seat holds with a TTL' },
  { title: 'Cloudflare Waiting Room', source: 'Cloudflare blog', year: 2021, url: 'https://blog.cloudflare.com/cloudflare-waiting-room/', kind: 'blog', note: 'an edge queue in front of on-sales' },
  { title: 'Designing Data-Intensive Applications', source: 'Martin Kleppmann (O’Reilly)', year: 2017, url: 'https://dataintensive.net/', kind: 'book', note: 'chapter 7: transactions, write skew, locking' },
  { title: 'System Design Interview – An Insider’s Guide, Volume 2', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'hotel reservation prompt' },
]

export default function ReservationSystemChapter() {
  return (
    <>
      <p>
        Hotel and ticket booking is the canonical <strong>“don't sell the same thing twice”</strong> problem. The
        write rate is tiny next to the browse rate, so the design splits into a cheap, stale-tolerant read path and
        a small, strictly correct write path. Flash sales then break every assumption about the write rate.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Search hotels and see availability for a date range', 'Reserve a room type for N nights', 'Pay, then confirm; cancel with refund policy', 'Admin: set inventory and rates']}
        nonFunctional={['Never exceed capacity (with an optional overbooking allowance)', 'Booking p99 < 1 s excluding payment', 'Availability views may be slightly stale', 'Survive flash-sale spikes (ticketing variant)']}
        outOfScope={['Dynamic pricing algorithms', 'Loyalty programme']}
      />
      <Callout kind="tip">
        Ask: <strong>specific room or room type?</strong> Hotels sell room types (“deluxe king”) and assign
        physical rooms at check-in. Modelling inventory as counts per type and date is far simpler than modelling
        individual rooms, and it's how the industry works.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['5,000 hotels, 1M rooms total (illustrative chain)', '70% occupancy, 3-night average stay', 'Views : bookings ≈ 100 : 1']}
        rows={[
          { label: 'Room-nights sold/day', math: '1M × 0.7', result: '700K' },
          { label: 'Reservations/day', math: '700K / 3 nights', result: '≈ 233K' },
          { label: 'Booking TPS', math: '233K / 86,400', result: '≈ 3/s' },
          { label: 'Search QPS', math: '3 × 100 (× peak factor)', result: '≈ 300–3K/s' },
          { label: 'Inventory rows', math: '5K hotels × ~20 types × 365 days × 2 yrs', result: '≈ 73M' },
        ]}
      />
      <p>Three bookings per second fits on one relational database. The write path is a <strong>correctness</strong> problem, not a scale problem. A concert on-sale is different: a million users competing for 50K seats in minutes.</p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'GET', path: '/v1/hotels/{id}/availability', desc: 'Cached, may be seconds stale.', body: '?roomType&checkIn&checkOut', returns: '{ available: true, nightlyRates: [...] }' },
        { method: 'POST', path: '/v1/reservations', desc: 'Creates a HELD reservation with an expiry. Idempotency-Key required.', body: '{ hotelId, roomTypeId, checkIn, checkOut, guest }', returns: '201 { reservationId, status: HELD, holdExpiresAt }' },
        { method: 'POST', path: '/v1/reservations/{id}/confirm', desc: 'After payment succeeds.' },
        { method: 'DELETE', path: '/v1/reservations/{id}', desc: 'Cancel and release inventory.' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="The read path is cached and approximate. The booking path hits the source of truth."
        flows={[
          { name: 'Browse', path: ['client', 'gw', 'search', 'cache'], steps: ['Guest searches dates', 'Gateway → search', 'Availability served from cache/index'] },
          { name: 'Book', path: ['client', 'gw', 'resv', 'db', 'resv', 'pay'], steps: ['POST /reservations with idempotency key', 'Gateway → reservation service', 'Atomic decrement per night + insert HELD, one transaction', 'Commit', 'Charge; on success confirm, on failure or expiry release'] },
          { name: 'Flash sale', path: ['client', 'wait', 'gw', 'resv', 'db'], steps: ['Users queue in the waiting room', 'Admitted at N/s with a signed token', 'Only token holders reach booking', 'Inventory decremented atomically'] },
        ]} />

      <H2 id="concurrency">5 · Deep dive: preventing double booking</H2>
      <ReserveRaceDemo />
      <CompareTable
        columns={['Pessimistic (FOR UPDATE)', 'Optimistic (version)', 'Atomic conditional update']}
        rows={[
          { label: 'Mechanism', cells: ['Lock the row, then read and write', 'Read version, write if unchanged', 'Single UPDATE … WHERE available > 0'] },
          { label: 'Under low contention', cells: ['Fine', 'Best, no waiting', 'Best'] },
          { label: 'Under high contention', cells: ['Queues on the lock; deadlock risk across nights', 'Retry storms', 'Row lock held only for a short transaction; no retries'] },
          { label: 'Gotcha', cells: ['Lock multi-night rows in date order', 'Needs a retry budget', 'Must affect exactly N rows for N nights'] },
        ]}
      />
      <CodeBlock lang="ts" title="multi-night booking in one transaction (SQL)" code={`
-- Decrement every night of the stay; succeed only if ALL nights had room.
BEGIN;
UPDATE room_inventory
   SET reserved = reserved + 1
 WHERE hotel_id = $1 AND room_type_id = $2
   AND date >= $checkIn AND date < $checkOut
   AND reserved < total * 1.10;          -- 10% overbooking policy, a business decision
-- affected rows must equal number of nights, else ROLLBACK (some night was full)
INSERT INTO reservations (id, idempotency_key, hotel_id, room_type_id, check_in, check_out, status, hold_expires_at)
VALUES ($id, $key, $1, $2, $checkIn, $checkOut, 'HELD', now() + interval '10 minutes');
COMMIT;`} />

      <H2 id="holds">6 · Deep dive: holds, payment & expiry</H2>
      <p>
        Never hold a database transaction open while calling a payment provider. Instead: <strong>HELD</strong> with an
        expiry → pay → <strong>CONFIRMED</strong>. A sweeper releases expired holds by incrementing inventory back.
        The state guard (<code>WHERE status = 'HELD'</code>) makes release and confirm race-safe against each other.
      </p>
      <CodeBlock lang="ts" title="reservation lifecycle" code={`
HELD ──pay ok──▶ CONFIRMED ──cancel──▶ CANCELLED (inventory released, refund per policy)
  │
  └──expired / pay failed──▶ RELEASED (inventory released)`} />

      <H2 id="flash-sale">7 · Deep dive: flash sales & ticketing</H2>
      <p>When demand exceeds supply by 20× in the first minute, the database row for “section A” becomes the hottest lock on the planet. Layered defences:</p>
      <ul>
        <li><strong>Virtual waiting room</strong>: a static page with a queue position. Admit users at the rate the booking tier can sustain, and issue signed, short-lived admission tokens.</li>
        <li><strong>Pre-sharded inventory in memory</strong>: split 50K seats into buckets in Redis and <code>DECR</code> atomically (Lua for multi-key). The fast “you got one” answer then gets persisted asynchronously with a durable queue behind it.</li>
        <li><strong>Seat maps</strong>: holds per seat ID with a TTL (<code>SET seat:123 user NX EX 600</code>) so two users can't pick the same seat.</li>
        <li><strong>Bots</strong>: rate limits per account and device, and challenges at the admission gate rather than at checkout.</li>
      </ul>

      <H2 id="data-model">8 · Data model</H2>
      <CodeBlock lang="ts" title="core tables (shard key: hotel_id)" code={`
// room_inventory(hotel_id, room_type_id, date, total, reserved,
//                PRIMARY KEY (hotel_id, room_type_id, date),
//                CHECK (reserved <= total * 1.10))
// reservations(id PK, idempotency_key UNIQUE, hotel_id, room_type_id,
//              check_in, check_out, status, hold_expires_at, guest_id)`} />

      <H2 id="staff">9 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Shard key choice follows the transaction boundary</strong>: every booking touches one hotel, so <code>hotel_id</code> keeps it a single-shard ACID transaction. Designing to avoid distributed transactions beats implementing them.</li>
          <li><strong>Overbooking is a business lever</strong>: the 10% factor is revenue management's call, with a “walk the guest” cost model. Make it configurable per hotel and date, and don't hardcode it.</li>
          <li><strong>Channel managers</strong>: the same inventory is sold via OTAs such as Booking.com. You then need allotments or an event-driven sync with conflict handling, which is where real double-bookings come from.</li>
          <li><strong>Fairness</strong> in ticket drops is a product requirement (a FIFO queue vs a lottery). Get it explicitly from product.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Two users click 'book' on the last room at the same millisecond. Walk me through what happens."
        senior={<p>Use optimistic locking with a version column. One update succeeds, and the other sees zero affected rows, so it re-reads and shows sold out.</p>}
        staff={<>
          <p>I'd make the check and the write <strong>one statement</strong>: <code>UPDATE … SET reserved = reserved + 1 WHERE … AND reserved &lt; total</code>, in the same transaction as the reservation insert. The row lock lasts only for that short transaction (milliseconds), with no read-modify-write gap and no retry loop: a concurrent booker simply waits, re-checks the condition, and gets 0 rows. For multi-night stays, the affected-row count must equal the number of nights, otherwise roll back.</p>
          <p>Around it: an idempotency key so a double click or retry doesn't create two holds, a CHECK constraint as a backstop, and payment outside the transaction using a HELD state with expiry. Under flash-sale contention I'd move the counter into Redis behind a waiting room.</p>
        </>}
        followUps={['What if payment succeeds after the hold expired?', 'How do you avoid deadlocks for multi-night stays?', 'How does availability search stay fast?']}
      />
      <InterviewQuestion
        q="A concert with 50K seats goes on sale and 2M users arrive at once. What changes?"
        senior={<p>Add a queue in front so requests are processed in order, and cache seat availability in Redis.</p>}
        staff={<>
          <p>The bottleneck is contention on a small amount of inventory, not raw QPS. I'd put a <strong>virtual waiting room</strong> at the edge (static, CDN-served), admitting users at the rate checkout can finish, maybe 2–5K per minute, with signed tokens. Inventory lives in pre-bucketed Redis counters or per-seat NX holds with a TTL, and confirmed orders persist asynchronously to SQL through a durable queue.</p>
          <p>Then the product decisions: queue vs lottery fairness, per-account limits, bot defence at admission. Also the failure plan: if Redis fails over and loses the last seconds of holds, reconciliation against the order DB must catch any oversell.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Model inventory as counts per (hotel, room type, date), not individual rooms.',
        'Writes are rare, so correctness wins: an atomic conditional update + reservation insert in one transaction.',
        'Idempotency keys and HELD-with-expiry keep payments out of database transactions.',
        'Shard by hotel_id so every booking stays a single-shard transaction.',
        'Flash sales are a different system: waiting room, in-memory inventory, async persistence.',
      ]} />
    </>
  )
}
