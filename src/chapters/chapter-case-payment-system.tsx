import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, FlowDiagram, H2,
  InterviewQuestion, KeyTakeaways, MentalModel, References, Requirements, StatRow, Term, TLDR,
} from '../components/ui'
import { ArrowRightLeft, BookOpen, CircleCheck, FilePlus, Hourglass, KeyRound, Radio, Undo2 } from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { PayIdempotencyDemo } from './demos/pay-idempotency-demo'
import { PayLedgerDemo } from './demos/pay-ledger-demo'

const REFS: Reference[] = [
  { title: 'Designing robust and predictable APIs with idempotency', source: 'Brandur Leach, Stripe', year: 2017, url: 'https://stripe.com/blog/idempotency', kind: 'blog' },
  { title: 'Idempotent requests', source: 'Stripe API reference', url: 'https://docs.stripe.com/api/idempotent_requests', kind: 'docs' },
  { title: 'Receive Stripe events in your webhook endpoint', source: 'Stripe documentation', url: 'https://docs.stripe.com/webhooks', kind: 'docs', note: 'signature verification, duplicate and out-of-order events' },
  { title: 'Avoiding Double Payments in a Distributed Payments System', source: 'Jon Chew & Ninad Khisti, Airbnb Engineering', year: 2019, url: 'https://medium.com/airbnb-engineering/avoiding-double-payments-in-a-distributed-payments-system-2981f6b070bb', kind: 'blog' },
  { title: 'Ledger: Stripe’s system for tracking and validating money movement', source: 'Ilya Ganelin, Stripe', year: 2024, url: 'https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement', kind: 'blog', note: 'double-entry ledger and reconciliation' },
  { title: 'Accounting for Developers, Part I: The Fundamentals', source: 'Lucas Rocha, Modern Treasury', year: 2022, url: 'https://www.moderntreasury.com/journal/accounting-for-developers-part-i', kind: 'blog', note: 'double-entry basics' },
  { title: 'PCI Security Standards document library (PCI DSS)', source: 'PCI Security Standards Council', url: 'https://www.pcisecuritystandards.org/document_library/', kind: 'docs' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 2 (ch. “Payment System”)', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'client', label: 'Checkout', sub: 'web / app', kind: 'client', x: 10, y: 30 },
  { id: 'api', label: 'Payment service', sub: 'orchestrator', kind: 'service', x: 29, y: 30,
    detail: 'Owns the payment state machine. Validates the order, records the payment row and idempotency key in one transaction, and hands off execution. It never stores raw card numbers.' },
  { id: 'pdb', label: 'Payments DB', sub: 'idempotency keys', kind: 'db', x: 29, y: 78,
    detail: 'A relational store with strong consistency and ACID transactions. The payment row, its state transitions and the outbox record are committed atomically.' },
  { id: 'exec', label: 'Payment executor', sub: 'workers', kind: 'worker', x: 50, y: 30,
    detail: 'Calls the PSP with the idempotency key forwarded. If the outcome is unknown (timeout), it queries the PSP for status instead of blindly retrying the charge.' },
  { id: 'psp', label: 'PSP', sub: 'Stripe / Adyen', kind: 'external', x: 73, y: 30,
    detail: 'Handles card networks, 3-D Secure and tokenization. The hosted payment fields keep card data out of your servers, which shrinks PCI DSS scope.' },
  { id: 'hook', label: 'Webhook handler', kind: 'service', x: 73, y: 72,
    detail: 'Receives asynchronous PSP events (succeeded, failed, disputed). It verifies signatures, dedupes by event ID and updates the state machine.' },
  { id: 'outbox', label: 'Outbox → Kafka', kind: 'queue', x: 50, y: 78,
    detail: 'The transactional outbox guarantees that a committed state change is eventually published exactly as committed. Consumers must be idempotent.' },
  { id: 'ledger', label: 'Ledger', sub: 'double-entry', kind: 'db', x: 50, y: 55,
    detail: 'Immutable journal of balanced debit/credit entries. Balances are derived. Corrections are new reversing entries, never UPDATEs.' },
  { id: 'recon', label: 'Reconciliation', sub: 'nightly batch', kind: 'worker', x: 90, y: 55,
    detail: 'Compares the ledger with the PSP settlement files and bank statements. Mismatches go to a finance queue, and some are auto-fixable.' },
  { id: 'files', label: 'PSP files', sub: 'settlement', kind: 'storage', x: 89, y: 88 },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'api' }, { from: 'api', to: 'pdb' }, { from: 'api', to: 'exec' }, { from: 'exec', to: 'psp' },
  { from: 'psp', to: 'hook', async: true, label: 'webhook' }, { from: 'hook', to: 'pdb' },
  { from: 'pdb', to: 'outbox', async: true }, { from: 'outbox', to: 'ledger', async: true },
  { from: 'files', to: 'recon' }, { from: 'recon', to: 'ledger' },
]

export default function PaymentSystemChapter() {
  return (
    <>
      <TLDR items={[
        'Charge customers through a payment provider and pay sellers out, with no double charges and no lost money.',
        'Traffic is modest; correctness under failure is the whole interview.',
        'Idempotency keys turn at-least-once retries into an exactly-once effect.',
        'A strict state machine with conditional updates makes late or duplicate webhooks harmless.',
        'An append-only double-entry ledger plus daily reconciliation catches every bug you did not predict.',
      ]} />
      <MentalModel id="payments" />

      <p>
        Payments look like a small CRUD problem: the traffic is modest and the objects are simple. What makes the
        problem hard is that <strong>every bug is somebody's money</strong>.
      </p>
      <p>
        The interview is about correctness under failure. Timeouts hide whether a charge happened. Retries duplicate
        it. <Term def="HTTP callbacks a provider sends to your server when something happens, such as a payment succeeding.">Webhooks</Term>{' '}
        arrive twice or out of order. And the ledger must balance to the cent years later.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>
        Scope the money flows first: charging buyers (pay-in) and settling to sellers (pay-out), all through a{' '}
        <Term def="Payment service provider, such as Stripe or Adyen: the company that actually talks to card networks and banks.">PSP</Term>.
      </p>
      <Requirements
        functional={['Pay-in: charge a customer for an order via a PSP', 'Pay-out: settle funds to sellers', 'Refunds and partial refunds', 'Payment status query + webhooks to the order service']}
        nonFunctional={['No double charges, no lost payments (correctness over availability)', 'Full audit trail, retained for years', 'p99 checkout call < 2 s excluding the PSP', 'PCI DSS scope kept minimal']}
        outOfScope={['Building our own card-network integration', 'Fraud ML models (assume a risk service exists)', 'Multi-currency FX treasury']}
      />
      <Callout kind="tip">
        Ask early: <strong>are we a marketplace</strong> (money flows buyer → platform → seller) <strong>or a
        merchant</strong>? A marketplace needs pay-outs, seller balances and a real ledger. A single merchant can
        lean on the PSP's dashboard for much of that.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>Size the load quickly, mainly to show that throughput is not the hard part.</p>
      <EstimationTable
        assumptions={['10M payments/day (illustrative, large marketplace)', 'Peak = 10× average (sales events)', '~3 ledger entries per payment, ~200 B each']}
        rows={[
          { label: 'Average TPS', math: '10M / 86,400 s', result: '≈ 116/s' },
          { label: 'Peak TPS', math: '116 × 10', result: '≈ 1.2K/s' },
          { label: 'Ledger rows/day', math: '10M × 3', result: '30M' },
          { label: 'Ledger growth', math: '30M × 200 B × 365', result: '≈ 2.2 TB/yr' },
        ]}
      />
      <StatRow caption="Small numbers: throughput is not the hard part" stats={[
        { value: '116/s', label: 'average payments', note: '≈ 1.2K/s at peak' },
        { value: '30M', label: 'ledger rows per day' },
        { value: '2.2 TB', label: 'ledger growth per year' },
      ]} />
      <p>
        One well-tuned relational primary handles this write rate. <strong>Throughput is not the problem</strong>.
        Say so explicitly, and spend your time on the failure modes.
      </p>

      <H2 id="api">3 · API</H2>
      <p>Every call that moves money carries an idempotency key, so retries are always safe.</p>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/payments', desc: <>Create and execute a payment. Requires an <code>Idempotency-Key</code> header.</>, body: '{ orderId, amount: 5000, currency: "USD", paymentMethodToken }', returns: '201 { paymentId, status }' },
        { method: 'GET', path: '/v1/payments/{id}', desc: 'Current state, used by clients after an ambiguous timeout.', returns: '{ status: pending | succeeded | failed | refunded }' },
        { method: 'POST', path: '/v1/payments/{id}/refunds', desc: 'Full or partial refund. Also idempotent.', body: '{ amount }' },
        { method: 'POST', path: '/webhooks/psp', desc: 'Signed PSP events. Dedupe by event ID and tolerate out-of-order delivery.' },
      ]} />
      <Callout kind="pitfall">
        Floats for money. Store <strong>integer minor units</strong> (cents) plus an ISO-4217 currency code, and
        define rounding rules for fees and splits explicitly.
      </Callout>

      <H2 id="high-level">4 · High-level design</H2>
      <p>
        The synchronous path ends at the PSP call. Everything after it, such as ledger writes and notifying the order
        service, runs on events through an{' '}
        <Term def="A table written in the same transaction as the business change; a relay later publishes its rows as events, so the two never diverge.">outbox</Term>.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="The synchronous path stops at the PSP. Everything after is event-driven and idempotent."
        flows={[
          { name: 'Pay-in', path: ['client', 'api', 'pdb', 'api', 'exec', 'psp'], steps: ['Checkout sends the tokenized card and an Idempotency-Key', 'Insert the payment (PENDING) and the key row in one transaction', 'Commit, then dispatch to the executor', 'Executor forwards the key', 'PSP authorizes and captures'] },
          { name: 'Confirmation', path: ['psp', 'hook', 'pdb', 'outbox', 'ledger'], steps: ['PSP sends a signed webhook', 'Handler dedupes the event ID and moves the state to SUCCEEDED', 'The same transaction writes an outbox row', 'Relay publishes, and the ledger posts balanced entries'] },
          { name: 'Reconciliation', path: ['files', 'recon', 'ledger'], steps: ['Download the PSP settlement file daily', 'Match by PSP reference and amount; mismatches go to the finance queue'] },
        ]} />

      <H2 id="idempotency">5 · Deep dive: idempotency, exactly-once effect</H2>
      <p>
        The first deep dive stops double charges. Exactly-once <em>delivery</em> is impossible over an unreliable
        network. What you build instead is{' '}
        <strong>at-least-once delivery + idempotent processing = exactly-once effect</strong>.
      </p>
      <p>
        The client generates a key per logical payment attempt. The server stores that key with a{' '}
        <Term def="A hash of the request body, used to detect the same key being reused for a different request.">request fingerprint</Term>{' '}
        and the final response. Retry a timed-out payment in the demo to see why this matters.
      </p>
      <PayIdempotencyDemo />
      <CodeBlock lang="ts" title="idempotency middleware (sketch)" code={`
async function withIdempotency(key: string, fingerprint: string, run: () => Promise<Resp>) {
  // Unique PK on key: concurrent duplicates lose the race here.
  const row = await db.insertOrGet('idempotency_keys', { key, fingerprint, status: 'processing' })
  if (row.inserted) {
    const resp = await run()                       // PSP call also receives \`key\`
    await db.update('idempotency_keys', key, { status: 'done', response: resp })
    return resp
  }
  if (row.fingerprint !== fingerprint) throw new Http422('Key reused with different body')
  if (row.status === 'processing') throw new Http409('Request in progress, retry later')
  return row.response                              // replay, no side effects
}`} />
      <Callout kind="warn">
        The dangerous state is <strong>“PSP called, outcome unknown”</strong> (timeout, crash). Never resolve it by
        charging again. Resolve it by <strong>querying the PSP with the same key</strong>, and let a sweeper job do
        that for payments stuck in PENDING.
      </Callout>

      <H2 id="state-machine">6 · Deep dive: the payment state machine</H2>
      <p>Next, make status changes safe. A payment may only move along legal transitions, enforced in the database.</p>
      <FlowDiagram caption="Happy path; PENDING can also go to FAILED, or UNKNOWN on timeout until reconciled" steps={[
        { label: 'CREATED', icon: FilePlus },
        { label: 'PENDING', sub: 'sent to the PSP', icon: Hourglass },
        { label: 'SUCCEEDED', sub: 'confirmed by webhook', icon: CircleCheck },
        { label: 'REFUNDED', sub: 'or DISPUTED', icon: Undo2 },
      ]} />
      <CodeBlock lang="ts" title="legal transitions only" code={`
const transitions: Record<Status, Status[]> = {
  CREATED:    ['PENDING'],
  PENDING:    ['SUCCEEDED', 'FAILED', 'UNKNOWN'],   // UNKNOWN = timeout, reconcile via status query
  UNKNOWN:    ['SUCCEEDED', 'FAILED'],
  SUCCEEDED:  ['REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED'],
  PARTIALLY_REFUNDED: ['REFUNDED', 'DISPUTED'],
  FAILED: [], REFUNDED: [], DISPUTED: ['SUCCEEDED', 'REFUNDED'],
}
// UPDATE payments SET status = $next, version = version + 1
//  WHERE id = $id AND status = $expected AND version = $v   -- optimistic guard`} />
      <p>
        The conditional <code>UPDATE … WHERE status = $expected</code> makes out-of-order webhooks harmless. A late{' '}
        <code>payment.failed</code> after <code>SUCCEEDED</code> simply matches zero rows and gets logged for review.
      </p>

      <H2 id="ledger">7 · Deep dive: the double-entry ledger & reconciliation</H2>
      <p>
        Finally, record where the money is. In a{' '}
        <Term def="Bookkeeping where every transaction is recorded as equal debits and credits across accounts, so the books always balance.">double-entry ledger</Term>,
        each business event produces entries whose debits equal their credits.
      </p>
      <p>
        Nothing is ever updated or deleted. Mistakes are fixed with reversing entries, and the audit trail comes for
        free.
      </p>
      <PayLedgerDemo />
      <CompareTable
        columns={['Mutable balance column', 'Double-entry journal']}
        rows={[
          { label: 'Audit', cells: ['Lost history; needs a separate log', 'The journal is the history'] },
          { label: 'Invariant', cells: ['None enforced', 'Σ debits = Σ credits per transaction'] },
          { label: 'Concurrency', cells: ['Hot row contention on popular accounts', 'Appends; balances cached or derived'] },
          { label: 'Correction', cells: ['Overwrite (dangerous)', 'Reversing entry (traceable)'] },
        ]}
      />
      <p>
        <Term def="Comparing your own records with an external source, such as the provider’s settlement file, to find mismatches.">Reconciliation</Term>{' '}
        is the safety net for every bug you didn't anticipate. Compare the internal ledger with the PSP settlement file
        and the bank statement. Route every mismatch to a queue with an owner.
      </p>

      <H2 id="data-model">8 · Data model</H2>
      <p>Four tables hold the state: payments, idempotency keys, ledger entries and the outbox.</p>
      <FlowDiagram caption="Each arrow is a commit boundary; nothing is published that wasn't committed" steps={[
        { label: 'Payment + key', sub: 'one transaction', icon: KeyRound },
        { label: 'State change + outbox', sub: 'one transaction', icon: ArrowRightLeft },
        { label: 'Relay publishes', sub: 'outbox → Kafka', icon: Radio },
        { label: 'Ledger entries', sub: 'balanced debit + credit', icon: BookOpen },
      ]} />
      <CodeBlock lang="ts" title="core tables (SQL)" code={`
// payments(id PK, order_id, amount_minor BIGINT, currency CHAR(3),
//          status, psp_ref UNIQUE, version INT, created_at, updated_at)
// idempotency_keys(key PK, fingerprint, status, response JSONB, created_at)  -- TTL ~24h+
// ledger_entries(id PK, txn_id, account_id, debit_minor, credit_minor, created_at)
//          CHECK (debit_minor = 0 OR credit_minor = 0)
// outbox(id PK, aggregate_id, event_type, payload, published_at NULL)`} />

      <H2 id="staff">9 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>PCI scope as architecture</strong>: tokenize at the edge with PSP-hosted fields so no service you run ever sees a PAN. That decision removes most of your compliance cost.</li>
          <li><strong>Multi-PSP routing</strong>: add a second PSP for failover and cost, keyed by the same idempotency key per attempt. Watch out for a double capture across providers.</li>
          <li><strong>Consistency boundaries</strong>: payments + ledger + outbox in one database beats a distributed saga. Split only when team or scale forces it, and then use sagas with compensations such as refunds.</li>
          <li><strong>Operational truth</strong>: dashboards for payments stuck in UNKNOWN/PENDING, reconciliation break counts and dispute rate. Name owners for each queue.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="The PSP call times out. Did the customer get charged? What does your system do?"
        senior={<p>We don't know, so we mark the payment as pending and retry with the same idempotency key, so the PSP won't double charge.</p>}
        staff={<>
          <p>Move the payment to <strong>UNKNOWN</strong>, not FAILED, and tell the client “processing” rather than an error, so they don't click pay again with a new key. Resolution is a <strong>status query</strong> to the PSP keyed by our idempotency key or reference, from a sweeper with backoff, plus the webhook that usually arrives first.</p>
          <p>A retry with the same key is only safe if the PSP guarantees key-scoped dedup over the retry window. I'd verify their retention period. Anything still unresolved after N hours goes to reconciliation and a human queue. The product decision is whether to ship the order while UNKNOWN (usually no for digital goods, maybe for low-value physical goods).</p>
        </>}
        followUps={['What if the webhook says succeeded but your DB write fails?', 'How long do you keep idempotency keys?', 'How would you add a second PSP?']}
      />
      <InterviewQuestion
        q="How do you guarantee the ledger is updated exactly once per successful payment?"
        senior={<p>Publish an event to Kafka when the payment succeeds, and have the ledger consume it with an idempotent consumer.</p>}
        staff={<>
          <p>Use a <strong>transactional outbox</strong>: the state change to SUCCEEDED and the outbox row commit atomically, which removes the dual-write problem. A relay publishes at-least-once. The ledger enforces a <strong>unique constraint on (payment_id, entry_type)</strong>, so a redelivered event is a no-op.</p>
          <p>Nightly reconciliation between payments and ledger is the backstop for bugs. At our volume the ledger could live in the same database and write in the same transaction, which is simpler. I'd make that call explicitly.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Throughput is easy here. Correctness under partial failure is the whole interview.',
        'Idempotency key + at-least-once = exactly-once effect. Forward the key to the PSP.',
        'Timeouts produce UNKNOWN, resolved by a status query, never by blind re-charging.',
        'The append-only double-entry ledger plus reconciliation is the audit and the safety net.',
        'Integer minor units, a state machine with guarded transitions, and an outbox for events.',
      ]} />
    </>
  )
}
