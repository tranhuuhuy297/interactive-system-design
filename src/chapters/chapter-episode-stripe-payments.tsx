import {
  References, TLDR, Term,
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeStripeRoutingDemo } from './demos/episode-stripe-routing-demo'
import { STRIPE_SRC } from './demos/episode-stripe-sources'
import { STRIPE_STAGES } from './demos/episode-stripe-stages'

const CHARGE_NODES: ArchNode[] = [
  { id: 'merchant', label: 'Merchant server', kind: 'client', x: 10, y: 50 },
  { id: 'api', label: 'Payments API', kind: 'service', x: 30, y: 50,
    detail: 'Authenticates the merchant key, validates the request, and claims the idempotency key before any side effect.' },
  { id: 'idem', label: 'Idempotency store', kind: 'cache', x: 30, y: 14,
    detail: 'Key → request fingerprint → in-flight marker → final response. A duplicate waits or gets the stored response.' },
  { id: 'db', label: 'Payments DB', kind: 'db', x: 52, y: 14,
    detail: 'Holds the payment state machine. Transitions are conditional writes (UPDATE … WHERE state = expected), so each happens once.' },
  { id: 'risk', label: 'Risk scoring', kind: 'service', x: 52, y: 50, detail: 'Model plus rules with a hard timeout. If the model is slow, rules decide alone.' },
  { id: 'router', label: 'Processor router', kind: 'service', x: 72, y: 50, detail: 'Chooses a processor per charge. Fails over only on errors that prove no charge happened.' },
  { id: 'psp', label: 'Processor', sub: 'card networks', kind: 'external', x: 90, y: 50 },
  { id: 'ledger', label: 'Ledger', kind: 'db', x: 72, y: 14, detail: 'Balanced entries written when the payment reaches a final state.' },
  { id: 'events', label: 'Event log', kind: 'queue', x: 52, y: 86 },
  { id: 'hooks', label: 'Webhooks', kind: 'worker', x: 30, y: 86 },
]
const CHARGE_EDGES: ArchEdge[] = [
  { from: 'merchant', to: 'api' }, { from: 'api', to: 'idem' }, { from: 'api', to: 'db' }, { from: 'api', to: 'risk' },
  { from: 'risk', to: 'router' }, { from: 'router', to: 'psp' }, { from: 'db', to: 'ledger' },
  { from: 'api', to: 'events', async: true }, { from: 'events', to: 'hooks' }, { from: 'hooks', to: 'merchant', async: true },
]

const REFS: Reference[] = Object.values(STRIPE_SRC)

// Timeline rows derive from the stage data so the two never drift apart.
const TIMELINE = STRIPE_STAGES.map((s) => {
  const [version, name] = s.title.split(' · ')
  return { label: version, cells: [s.era ?? '', name ?? s.title] }
})

export default function StripeEpisode() {
  return (
    <>
      <TLDR items={[
        'Payments are a distributed system where every bug has a dollar amount.',
        'Every external call can end in success, failure, or unknown. Design for unknown.',
        'Idempotency keys make retries safe; webhooks deliver results that arrive later.',
        'A double-entry ledger, not a balance column, is the source of truth for money.',
        'Tokens shrink security scope; cells limit blast radius and keep data in-country.',
      ]} />
      <p>
        This episode builds a Stripe-like platform in 12 stages. It starts with one “charge a card” endpoint and ends
        with a global system that survives the busiest shopping weekend. At every stage, ask one question: <strong>what
        happens to the money when the network lies?</strong>
      </p>
      <p>
        A few terms first. A <Term def="The company that talks to card networks on a merchant’s behalf and approves or declines charges.">card processor</Term> sends
        charges to the card networks. An <Term def="A unique value the client sends with a request so the server can recognize and safely ignore retries.">idempotency key</Term> lets
        a client retry without paying twice. A <Term def="An HTTP request the platform sends to the merchant when something changes, such as a payment succeeding.">webhook</Term> tells
        the merchant about results that arrive later.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Before each stage, guess what breaks next. Open “Go deeper” for the step-by-step flow, numbers, and sources.
        For the interview-format version, see the <a href="#/payments">payment system case study</a>.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Stripe; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <p>Years mark publicly documented milestones. “Design step” marks a step in our reconstruction that has no public date.</p>
      <CompareTable columns={['When', 'What changed']} rows={TIMELINE} />

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={STRIPE_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <EstimationTable
        assumptions={[
          'Total payment volume ≈ $1T per year (Stripe reported about this for 2023)',
          'Average payment ≈ $50 (assumption)', 'Peak ≈ 10× average (assumption)', '~4 ledger entries and ~3 webhooks per payment (assumption)',
        ]}
        rows={[
          { label: 'Payments per year', math: '$1T / $50', result: '≈ 20B' },
          { label: 'Average rate', math: '20B / 31.5M s', result: '≈ 630/s' },
          { label: 'Peak rate', math: '630 × 10', result: '≈ 6K/s' },
          { label: 'Ledger writes at peak', math: '6K × 4', result: '≈ 25K/s' },
          { label: 'Webhooks at peak', math: '6K × 3 (+ retries)', result: '≈ 20K/s+' },
        ]}
      />
      <p>
        For comparison, Stripe reported a peak of 137,000 transactions per minute over Black Friday weekend 2024
        (about 2,300 per second). The raw rate is modest. The hard part is <strong>correctness when calls fail
        halfway</strong>, plus audits and results that arrive days later.
      </p>

      <H2 id="life-of-a-charge">Life of a charge</H2>
      <ArchitectureDiagram nodes={CHARGE_NODES} edges={CHARGE_EDGES} height={380}
        caption="The synchronous path stays short; everything else hangs off the event log"
        flows={[
          { name: 'Charge', path: ['merchant', 'api', 'risk', 'router', 'psp'], steps: ['POST /payments with an Idempotency-Key', 'API claims the key and records state = processing', 'Risk approves within its time budget', 'Router sends the authorization to a healthy processor'] },
          { name: 'Retry', path: ['merchant', 'api', 'idem'], steps: ['Merchant retries after a client timeout', 'Same key found: return the stored result (or 409 while still in flight)'] },
          { name: 'Settle', path: ['api', 'db', 'ledger'], steps: ['The processor result arrives', 'Conditional state change to succeeded', 'Balanced ledger entries written'] },
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
        Stage v10 adds a second processor. It is the most dangerous change in the episode. You may retry on another
        processor only if you <em>know</em> the first one did not charge.
      </p>
      <p>
        A refused connection proves that. A timeout does not. After a timeout, <strong>check the payment’s status</strong>{' '}
        (or wait for the processor’s notification) before trying elsewhere.
      </p>
      <EpisodeStripeRoutingDemo />
      <Callout kind="pitfall">
        “Just retry on the backup” sounds resilient but quietly double-charges customers. Turn on <em>Retry anything
        on B</em> with <em>A times out</em> and watch the double-charge counter climb.
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Duplicate protection', cells: ['Client-supplied idempotency keys', 'Server dedupe by amount + card + time', 'Only the client knows two requests are the same intent'] },
          { label: 'Money records', cells: ['Append-only double-entry ledger', 'Balance column on the account row', 'Auditable, self-checking, no lost updates'] },
          { label: 'Merchant updates', cells: ['Signed webhooks, at-least-once', 'Polling only', 'Results arrive days later; polling wastes both sides'] },
          { label: 'Card data', cells: ['Tokenize into an isolated vault', 'Encrypt in every service', 'Keeps security audits to one small system'] },
          { label: 'API changes', cells: ['Per-account date versions', 'URL versions (/v1, /v2)', 'Small opt-in upgrades instead of big rewrites'] },
          { label: 'Processor outage', cells: ['Health-aware routing + status checks', 'Blind retry on backup', 'Retries only when no charge can have happened'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Name the unknown.</strong> Every external call has three outcomes: success, failure, unknown. Design pending states, status checks, and reconciliation for the third.</li>
          <li><strong>Money is a ledger problem.</strong> The payments table drives workflow. The ledger is what finance and auditors trust.</li>
          <li><strong>Reconciliation is a product.</strong> Mismatches happen daily. Build exception queues and tools, not just a batch job.</li>
          <li><strong>Blast radius.</strong> Cells and regional data rules limit a bad deploy as much as they satisfy regulators.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="A merchant’s server times out waiting for your charge API and retries. How do you guarantee one charge?"
        senior={<p>Use idempotency keys. Store the key with the result; if the same key comes again, return the stored result instead of charging again.</p>}
        staff={<>
          <p>Idempotency keys, but the details matter. Claim the key <strong>atomically before any side effect</strong>. Fingerprint the body so a reused key with other parameters is rejected. Return 409 for duplicates that arrive while the first is still running.</p>
          <p>The key only protects our API boundary. Downstream I still need an idempotent processor call, a state machine with conditional transitions, and reconciliation for anything still unknown.</p>
        </>}
        followUps={['What do you store if the processor call times out?', 'How long should keys live, and why?', 'How do you make the processor call idempotent?']}
      />
      <InterviewQuestion
        q="Your primary card processor starts timing out. What does your system do?"
        senior={<p>A circuit breaker detects the failures and we fail over to the backup processor so payments keep succeeding.</p>}
        staff={<>
          <p>First, sort errors by type. A refused connection or an explicit “not processed” is safe to fail over. <strong>A timeout is not</strong>: the charge may have gone through. Mark it pending and check status before retrying elsewhere.</p>
          <p>The breaker then sends <em>new</em> payments to the backup, with a small probe share to the primary. Reconciliation voids any stray authorizations.</p>
        </>}
        followUps={['How do you avoid overloading the backup?', 'What if both processors time out?', 'How do merchants see a pending payment?']}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Every external call can end in “unknown”; design pending states, status checks, and reconciliation for it.',
        'Claim idempotency keys atomically before side effects and bind them to a request fingerprint.',
        'An append-only double-entry ledger is the source of truth for money.',
        'Fail over only when you can prove no charge happened. Blind retries turn outages into double charges.',
        'Versioned APIs, tokenization, and cells let the platform change and grow without breaking customers.',
      ]} />
    </>
  )
}
