import {
  References,
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeStripeRoutingDemo } from './demos/episode-stripe-routing-demo'
import { STRIPE_STAGES } from './demos/episode-stripe-stages'

const CHARGE_NODES: ArchNode[] = [
  { id: 'merchant', label: 'Merchant server', kind: 'client', x: 10, y: 50 },
  { id: 'api', label: 'Payments API', kind: 'service', x: 30, y: 50,
    detail: 'Authenticates the merchant key, validates the request, and checks the idempotency key before doing anything with side effects.' },
  { id: 'idem', label: 'Idempotency store', kind: 'cache', x: 30, y: 14,
    detail: 'Key → request fingerprint → locked/in-flight marker → final response. A second request with the same key waits or gets the stored response.' },
  { id: 'db', label: 'Payments DB', kind: 'db', x: 52, y: 14,
    detail: 'Holds the payment state machine. Transitions are conditional writes (UPDATE … WHERE state = expected), so each happens exactly once.' },
  { id: 'risk', label: 'Risk scoring', kind: 'service', x: 52, y: 50, detail: 'Inline model plus rules with a hard timeout; if it blows the budget, rules decide alone.' },
  { id: 'router', label: 'Processor router', kind: 'service', x: 72, y: 50, detail: 'Chooses a processor per charge; fails over only on errors that prove no charge occurred.' },
  { id: 'psp', label: 'Processor', sub: 'card networks', kind: 'external', x: 90, y: 50 },
  { id: 'ledger', label: 'Ledger', kind: 'db', x: 72, y: 14, detail: 'Balanced entries written when the payment reaches a terminal state.' },
  { id: 'events', label: 'Event log', kind: 'queue', x: 52, y: 86 },
  { id: 'hooks', label: 'Webhooks', kind: 'worker', x: 30, y: 86 },
]
const CHARGE_EDGES: ArchEdge[] = [
  { from: 'merchant', to: 'api' }, { from: 'api', to: 'idem' }, { from: 'api', to: 'db' }, { from: 'api', to: 'risk' },
  { from: 'risk', to: 'router' }, { from: 'router', to: 'psp' }, { from: 'db', to: 'ledger' },
  { from: 'api', to: 'events', async: true }, { from: 'events', to: 'hooks' }, { from: 'hooks', to: 'merchant', async: true },
]

// Primary public sources behind the “In the real world” notes.
const REFS: Reference[] = [
  { title: "Idempotent requests", source: "Stripe API reference", url: "https://docs.stripe.com/api/idempotent_requests", kind: "docs", note: "keys prunable after 24 hours" },
  { title: "Designing robust and predictable APIs with idempotency", source: "Brandur Leach, Stripe blog", year: 2017, url: "https://stripe.com/blog/idempotency", kind: "blog" },
  { title: "Receive Stripe events in your webhook endpoint", source: "Stripe docs", url: "https://docs.stripe.com/webhooks", kind: "docs", note: "Stripe-Signature; live retries up to 3 days" },
  { title: "Ledger: Stripe’s system for tracking and validating money movement", source: "Stripe engineering", year: 2024, url: "https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement", kind: "blog" },
  { title: "Stripe Radar", source: "Stripe", url: "https://stripe.com/radar", kind: "docs", note: "AI trained on Stripe network data" },
  { title: "How Radar works", source: "Stripe docs", url: "https://docs.stripe.com/radar/how-radar-works", kind: "docs" },
  { title: "Storage of Payment System Data (RBI/2017-18/153)", source: "Reserve Bank of India", year: 2018, url: "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11244", kind: "docs" },
  { title: "Stripe’s 2023 annual letter", source: "Stripe", year: 2024, url: "https://stripe.com/annual-updates/2023", kind: "blog", note: "$1T total payment volume in 2023" },
]

export default function StripeEpisode() {
  return (
    <>
      <p>
        A payment system is a distributed system where every bug has a dollar amount attached. This episode builds a
        Stripe-like platform from a single “charge a card” endpoint to a global, multi-processor system. At every stage
        the question is the same: <strong>what happens to the money when the network lies to you?</strong>
      </p>
      <Callout kind="info" title="How to watch this episode">
        Before each stage, predict the failure that forces the next change. For the interview-format version of this
        problem (requirements, estimation, API, ledger demo), see the <a href="#/payments">payment system case study</a>.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Stripe; all trademarks belong to their owners.</em></p>

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={STRIPE_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <EstimationTable
        assumptions={[
          'Total payment volume ≈ $1T/yr (Stripe has publicly reported volume around this order for 2023)',
          'Average ticket ≈ $50 (assumption)', 'Peak ≈ 10× average (holiday sales)', '~4 ledger entries and ~3 webhook deliveries per payment (assumption)',
        ]}
        rows={[
          { label: 'Payments / year', math: '$1T / $50', result: '≈ 20B' },
          { label: 'Average rate', math: '20B / 31.5M s', result: '≈ 630/s' },
          { label: 'Peak rate', math: '630 × 10', result: '≈ 6K/s' },
          { label: 'Ledger writes at peak', math: '6K × 4', result: '≈ 25K/s' },
          { label: 'Webhook deliveries at peak', math: '6K × 3 (+ retries)', result: '≈ 20K/s+' },
        ]}
      />
      <p>
        The throughput is modest by internet standards. What makes payments hard is <strong>correctness under
        partial failure</strong>, auditability, and the long tail of asynchronous outcomes, not raw QPS.
      </p>

      <H2 id="life-of-a-charge">Life of a charge</H2>
      <ArchitectureDiagram nodes={CHARGE_NODES} edges={CHARGE_EDGES} height={380}
        caption="The synchronous path stays short; everything else hangs off the event log"
        flows={[
          { name: 'Charge', path: ['merchant', 'api', 'risk', 'router', 'psp'], steps: ['POST /payments with an Idempotency-Key', 'API claims the key and records state = processing', 'Risk approves within budget', 'Router sends the authorization to a healthy processor'] },
          { name: 'Retry', path: ['merchant', 'api', 'idem'], steps: ['Merchant retries after a client timeout', 'Same key found: return the stored result (or 409 while still in flight)'] },
          { name: 'Settle', path: ['api', 'db', 'ledger'], steps: ['Processor result arrives', 'Conditional state transition to succeeded', 'Balanced ledger entries written'] },
          { name: 'Webhook', path: ['api', 'events', 'hooks', 'merchant'], steps: ['State change emitted', 'Queued for delivery', 'Signed POST, retried until acknowledged'] },
        ]} />
      <CodeBlock lang="ts" title="idempotent charge handler (sketch)" code={`
async function createPayment(req: Req): Promise<Res> {
  const key = req.header('Idempotency-Key')
  const fp = hash(req.body)

  // Atomically claim the key; a concurrent duplicate sees 'in_flight'.
  const claim = await idem.putIfAbsent(key, { fp, status: 'in_flight' })
  if (claim.existing) {
    if (claim.existing.fp !== fp) return conflict('key reused with different body')
    if (claim.existing.status === 'in_flight') return conflict('retry later')
    return claim.existing.response // replay, never re-charge
  }

  const payment = await payments.insert({ state: 'processing', amount: req.body.amount })
  const result = await router.authorize(payment) // may throw on timeout

  const next = result.approved ? 'succeeded' : 'failed'
  await payments.transition(payment.id, 'processing', next) // conditional write
  const response = { id: payment.id, status: next }
  await idem.complete(key, response)
  return response
}`} />

      <H2 id="failover">Deep dive: failover without double charges</H2>
      <p>
        Multi-processor routing is the headline feature of stage v5, and the most dangerous. You can retry on another
        processor only if you <em>know</em> the first attempt did not charge. A refused connection proves that; a
        timeout does not. The safe move after a timeout is to <strong>query the payment’s status</strong> (or wait
        for the processor’s webhook) before retrying.
      </p>
      <EpisodeStripeRoutingDemo />
      <Callout kind="pitfall">
        “Just retry on the backup” is the classic answer that sounds resilient and quietly double-charges customers.
        Turn on <em>Retry anything on B</em> with <em>A times out</em> and watch the double-charge counter climb.
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Duplicate protection', cells: ['Client-supplied idempotency keys', 'Server-side dedupe by amount + card + time', 'Only the client knows two requests are the same intent'] },
          { label: 'Source of truth for money', cells: ['Append-only double-entry ledger', 'Balance column on the account row', 'Auditable, self-checking (debits = credits), no lost updates'] },
          { label: 'Merchant notifications', cells: ['Signed webhooks, at-least-once', 'Polling APIs only', 'Async outcomes arrive days later; polling wastes both sides'] },
          { label: 'Card data', cells: ['Tokenize into an isolated vault', 'Encrypt in every service', 'Shrinks PCI scope to one small, hardened system'] },
          { label: 'Processor outage', cells: ['Health-aware routing + status checks', 'Blind retry on backup', 'Retries only when no charge can have happened'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Name the ambiguity.</strong> Every external call has three outcomes: success, failure, <em>unknown</em>. Design explicitly for unknown with pending states, status queries, and reconciliation.</li>
          <li><strong>Money is a ledger problem, not a table problem.</strong> Payments DB drives workflow; the ledger is what finance and auditors trust.</li>
          <li><strong>Reconciliation is a product.</strong> Mismatches will happen daily. Build exception queues and tooling, not just a batch job.</li>
          <li><strong>Blast radius.</strong> Cells and regional residency are as much about limiting a bad deploy as about regulation.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="A merchant’s server times out waiting for your charge API and retries. How do you guarantee the customer is charged once?"
        senior={<p>Use idempotency keys. Store the key with the result; if the same key comes again, return the stored result instead of charging again.</p>}
        staff={<>
          <p>Idempotency keys, but the details matter. Claim the key <strong>atomically before any side effect</strong> (put-if-absent with an in-flight marker), fingerprint the body so a reused key with different parameters is rejected, and return 409 for concurrent duplicates while the first is in flight.</p>
          <p>The key protects only our API boundary. Downstream I still need an idempotent call to the processor (its own idempotency or a unique reference), a state machine with conditional transitions, and reconciliation as the backstop for anything still unknown. Keys expire after a window longer than any sane client retry policy.</p>
        </>}
        followUps={['What do you store if the processor call times out?', 'How long should keys live, and why?', 'How do you make the processor call itself idempotent?']}
      />
      <InterviewQuestion
        q="Your primary card processor starts timing out. What does your system do?"
        senior={<p>A circuit breaker detects the failures and we fail over to the backup processor so payments keep succeeding.</p>}
        staff={<>
          <p>Distinguish error types first. Connection refused or a 5xx with a clear “not processed” is safe to fail over. <strong>Timeouts are not</strong>: the charge may have gone through. For those I’d mark the payment pending and query the processor’s status API (or wait for its webhook) before retrying elsewhere.</p>
          <p>The breaker then routes <em>new</em> payments to the backup, with a small probe share back to the primary. I’d accept slightly lower approval rates on the backup, communicate pending states to merchants via webhooks, and let reconciliation catch any orphaned authorizations (void or refund them).</p>
        </>}
        followUps={['How do you avoid overloading the backup processor?', 'What if both processors time out?', 'How do merchants see a pending payment?']}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Every external call can end in “unknown”; design pending states, status checks, and reconciliation for it.',
        'Idempotency keys must be claimed atomically before side effects and bound to a request fingerprint.',
        'An append-only double-entry ledger is the source of truth for money; payments rows drive workflow.',
        'Fail over only when you can prove no charge happened. Blind retries turn outages into double charges.',
        'Tokenization shrinks PCI scope; cells limit blast radius and satisfy data-residency rules.',
      ]} />
    </>
  )
}
