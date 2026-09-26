import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, EstimationTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways,
  LayerStack, MentalModel, References, Requirements, SideBySide, StatRow, Term, TLDR,
} from '../components/ui'
import {
  Banknote, Camera, CheckCircle2, Cpu, Database, Eye, FileCheck2, Landmark, Layers, Lock, RotateCcw, ScrollText,
  Split, Undo2, Workflow,
} from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { WalletEventSourcingDemo } from './demos/wallet-event-sourcing-demo'

const REFS: Reference[] = [
  { title: 'Event Sourcing', source: 'Martin Fowler', year: 2005, url: 'https://martinfowler.com/eaaDev/EventSourcing.html', kind: 'blog', note: 'state as a fold over an event log; replay and temporal queries' },
  { title: 'CQRS', source: 'Martin Fowler', year: 2011, url: 'https://martinfowler.com/bliki/CQRS.html', kind: 'blog', note: 'separate write model from read models' },
  { title: 'The LMAX Architecture', source: 'Martin Fowler', year: 2011, url: 'https://martinfowler.com/articles/lmax.html', kind: 'blog', note: 'in-memory, single-threaded business logic rebuilt from an input log' },
  { title: 'Sagas', source: 'H. Garcia-Molina & K. Salem, SIGMOD', year: 1987, url: 'https://doi.org/10.1145/38713.38742', kind: 'paper', note: 'long-lived transactions as steps plus compensations' },
  { title: 'Consensus on Transaction Commit', source: 'J. Gray & L. Lamport', year: 2006, url: 'https://arxiv.org/abs/cs/0408036', kind: 'paper', note: 'why classic 2PC blocks when the coordinator fails' },
  { title: 'Life Beyond Distributed Transactions: An apostate’s opinion', source: 'Pat Helland, ACM Queue', year: 2016, url: 'https://queue.acm.org/detail.cfm?id=3025012', kind: 'paper', note: 'entities, idempotent messaging, no cross-entity transactions' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 2 (ch. “Digital Wallet”)', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'client', label: 'Wallet app', kind: 'client', x: 10, y: 50 },
  { id: 'api', label: 'Wallet API', sub: 'auth + validation', kind: 'service', x: 28, y: 50,
    detail: 'Stateless. Authenticates the caller, checks the Idempotency-Key format, and routes the command to the partition that owns the sender account.' },
  { id: 'cmd', label: 'Command log', sub: 'per partition', kind: 'queue', x: 47, y: 18,
    detail: 'Every request is appended here before any processing. It is the input for deterministic replay, and it records what users asked for, including rejected requests.' },
  { id: 'engine', label: 'State machine', sub: 'sharded by account', kind: 'worker', x: 47, y: 50,
    detail: 'Single-threaded per partition, with balances in memory. It validates each command against current state and emits events. Same input order always gives the same output.' },
  { id: 'events', label: 'Event log', sub: 'replicated, durable', kind: 'queue', x: 66, y: 50,
    detail: 'The source of truth. Append-only, replicated (e.g. Raft or Kafka with acks=all) before a transfer is acknowledged. Balances anywhere else are derived from it.' },
  { id: 'read', label: 'Read models', sub: 'balances, history', kind: 'db', x: 86, y: 50,
    detail: 'CQRS projections built from events: a balance table, per-user history, and analytics feeds. They lag the log slightly and can always be rebuilt.' },
  { id: 'snap', label: 'Snapshots', sub: 'object storage', kind: 'storage', x: 66, y: 84,
    detail: 'Periodic copies of the in-memory state tagged with the last event sequence. Recovery loads the newest snapshot and replays only the tail of the log.' },
  { id: 'recon', label: 'Reconciliation', sub: 'daily', kind: 'worker', x: 86, y: 84,
    detail: 'Replays events independently and compares totals with the read models and with bank or PSP statements. Any mismatch is a bug to investigate.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'api' }, { from: 'api', to: 'cmd' }, { from: 'cmd', to: 'engine' },
  { from: 'engine', to: 'events' }, { from: 'events', to: 'read', async: true }, { from: 'api', to: 'read' },
  { from: 'engine', to: 'snap', async: true, label: 'periodic' }, { from: 'events', to: 'recon', async: true },
]

export default function DigitalWalletChapter() {
  return (
    <>
      <TLDR items={[
        'Move money between wallets at very high throughput without ever creating or losing a cent.',
        'Keep balances in memory per partition and process each partition single-threaded: no locks, no deadlocks.',
        'Make the event log the source of truth; balances, snapshots and read models are all derived.',
        'Cross-partition transfers need 2PC, TC/C or a saga. Pick by how long funds may be held.',
        'Staff insight: replay turns auditing, debugging and recovery into the same operation.',
      ]} />
      <MentalModel id="digital-wallet" />

      <p>
        A digital wallet holds stored value: top up once, then pay friends and merchants instantly. Each payment is a{' '}
        <strong>balance transfer</strong> between two accounts you control, not a card charge.
      </p>
      <p>
        The card side lives in the <a href="#/payments">payment system</a> case study and the{' '}
        <a href="#/ep-stripe">Stripe episode</a>. This chapter is about the internal ledger at extreme throughput, where a
        normal database transaction per transfer stops being enough.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>Pin down what a transfer promises before choosing where balances live.</p>
      <Requirements
        functional={['Transfer between two wallets', 'Read balance and transaction history', 'Top up and withdraw through a PSP', 'Full audit trail of every change']}
        nonFunctional={['Target 1M transfers/s (a thought experiment)', 'Money is never created or destroyed', 'Exactly-once effect per transfer request', 'State must be reproducible for audits']}
        outOfScope={['Card network integration (see the payment system)', 'Currency exchange', 'Fraud models']}
      />
      <Callout kind="tip">
        Ask what users are promised on success. <strong>“Your transfer is done”</strong> means the event is durably
        replicated. <strong>“Your balance shows it”</strong> may lag slightly if balances are read from a projection.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>The numbers explain why the usual “one transaction per transfer” design runs out of road.</p>
      <EstimationTable
        assumptions={['1M transfers/s peak (illustrative target, not a real company’s figure)', 'Each transfer changes 2 balances', '~100 bytes per stored event']}
        rows={[
          { label: 'Balance updates', math: '1M × 2', result: '2M/s' },
          { label: 'Event log write rate', math: '1M × 100 B', result: '≈ 100 MB/s' },
          { label: 'Event log per day', math: '100 MB × 86,400 s', result: '≈ 8.6 TB/day' },
          { label: 'Partitions needed', math: '1M ÷ per-partition throughput', result: 'benchmark, then divide' },
        ]}
      />
      <StatRow caption="Illustrative target; the point is the shape, not the exact number" stats={[
        { value: '1M/s', label: 'transfers at peak', note: 'thought experiment' },
        { value: '2M/s', label: 'balance updates' },
        { value: '8.6 TB', label: 'event log per day', note: 'before compression' },
      ]} />
      <p>
        Every transfer touches two rows that other transfers also want. With row locks, hot accounts serialize and
        cross-shard transfers need coordination. That is the real bottleneck, not raw disk bandwidth.
      </p>

      <H2 id="api">3 · API</H2>
      <p>Transfers are commands with a client-chosen idempotency key, so a retried request never moves money twice.</p>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/transfers', desc: <>Submit a transfer. Requires an <code>Idempotency-Key</code> header.</>, body: '{ from, to, amountMinor: 5000, currency: "USD" }', returns: '201 { transferId, status: completed | rejected }' },
        { method: 'GET', path: '/v1/wallets/{id}/balance', desc: 'Current balance, read from a projection.', returns: '{ balanceMinor, asOfSeq }' },
        { method: 'GET', path: '/v1/wallets/{id}/transactions', desc: 'History page from the history read model.', returns: '{ items, nextCursor }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>
        Commands are logged, processed by a deterministic state machine, and turned into events. Everything a user reads
        is a projection of those events, which is the{' '}
        <Term def="Command Query Responsibility Segregation: writes go through one model, reads come from separate models built for querying.">CQRS</Term>{' '}
        split.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Writes flow left to right through the log; reads never touch the state machine"
        flows={[
          { name: 'Transfer', path: ['client', 'api', 'cmd', 'engine', 'events', 'read'], steps: ['App sends the transfer with an Idempotency-Key', 'API appends the command to the owner partition’s log', 'State machine reads the next command in order', 'Validated transfer becomes an event, replicated before the ack', 'Projections update the balance and history views'] },
          { name: 'Balance read', path: ['client', 'api', 'read'], steps: ['App asks for its balance', 'API reads the balance projection, tagged with its event sequence'] },
          { name: 'Recover', path: ['snap', 'engine', 'events'], steps: ['Restarted partition loads its newest snapshot', 'Then replays events after the snapshot’s sequence'] },
        ]} />

      <H2 id="where-balances-live">5 · Deep dive: where do balances live?</H2>
      <p>This is the first real decision. Each option trades simplicity for throughput differently.</p>
      <SideBySide caption="Most teams should start on the left and move right only when measurements force it" panels={[
        { title: 'Database transactions', icon: Database, points: ['+ Simple, familiar, ACID', '+ Tooling for audit and backup', '- Row locks serialize hot accounts', '- Cross-shard transfers need 2PC'], verdict: 'Default for most wallets' },
        { title: 'In-memory sharded state', icon: Cpu, points: ['+ Very fast updates', '- Memory is not durable', '- Crash loses state without a log'], verdict: 'Never on its own' },
        { title: 'Event-sourced state machine', icon: ScrollText, tone: 'good', points: ['+ In-memory speed, durable log', '+ Replay gives audit and recovery', '- More moving parts to operate'], verdict: 'Extreme throughput' },
      ]} />
      <p>
        The event-sourced design keeps state in memory but never trusts memory alone. Each partition is processed by a
        single thread, so there are no locks at all. The same idea powers the LMAX exchange architecture Fowler describes.
      </p>

      <H2 id="cross-shard">6 · Deep dive: transfers across partitions</H2>
      <p>
        When Alice and Bob live on different partitions, one local step cannot move the money. You need a protocol that
        keeps the total unchanged even if something crashes halfway.
      </p>
      <SideBySide caption="All three keep money conserved; they differ in how long funds are locked and who can block" panels={[
        { title: '2PC', icon: Lock, points: ['+ Atomic across shards', '- Locks held until the coordinator decides', '- Coordinator failure blocks participants'], verdict: 'Inside one trusted system, low latency links' },
        { title: 'TC/C', icon: CheckCircle2, points: ['+ Try reserves funds, then Confirm or Cancel', '+ Business-level, no DB locks', '- Every step needs an idempotent undo'], verdict: 'Reserve-then-commit money moves' },
        { title: 'Saga', icon: Undo2, tone: 'good', points: ['+ Steps commit independently', '+ Failures run compensations', '- Brief visible in-between states'], verdict: 'Long or cross-service flows' },
      ]} />
      <FlowDiagram caption="A saga for a cross-partition transfer; each step is an idempotent event on its own partition" steps={[
        { label: 'Debit Alice', sub: 'partition A', icon: Banknote },
        { label: 'Transfer in flight', sub: 'recorded as an event', icon: Workflow },
        { label: 'Credit Bob', sub: 'partition B', icon: Landmark },
        { label: 'If credit fails', sub: 'refund Alice', icon: Undo2 },
      ]} />
      <p>
        A{' '}
        <Term def="A transaction that undoes the business effect of an earlier committed step, such as refunding a debit.">compensating transaction</Term>{' '}
        is new money movement, not a rollback, so it appears in the audit trail. Crediting a valid account rarely fails,
        which is why debit-first sagas work well here.
      </p>

      <H2 id="event-sourcing">7 · Deep dive: command log, event log, snapshots</H2>
      <p>
        <Term def="Storing every state change as an immutable event and deriving current state by replaying them in order.">Event sourcing</Term>{' '}
        separates three things: what was asked (commands), what happened (events), and what is true now (state).
      </p>
      <FlowDiagram caption="Only the fold step changes state, and it is a pure function" steps={[
        { label: 'Command', sub: 'what the user asked', icon: ScrollText },
        { label: 'Validate', sub: 'against current state', icon: FileCheck2 },
        { label: 'Event', sub: 'what happened', icon: Layers },
        { label: 'Apply', sub: 'fold into balances', icon: Cpu },
        { label: 'Snapshot', sub: 'every N events', icon: Camera },
      ]} />
      <p>
        Try it below. Retry a transfer with idempotency off: the total stays conserved, yet Alice pays twice. That is why
        the invariant alone is not enough, and why the applied command ids must be part of the state.
      </p>
      <WalletEventSourcingDemo />
      <Callout kind="warn">
        Replay is only safe if the fold is <strong>deterministic</strong>. No wall-clock reads, random numbers, or calls to
        other services inside it. Put timestamps and external results into the command or event instead.
      </Callout>

      <H2 id="reads-and-audit">8 · Deep dive: reads, audit and reconciliation</H2>
      <p>Different consumers need different views, but they all derive from one log. Rank them by how much you trust them.</p>
      <LayerStack legend="Top = most trusted. Everything below the log can be rebuilt from it."
        caption="If two layers disagree, the higher one wins and the lower one is rebuilt"
        layers={[
          { label: 'Event log', sub: 'replicated, append-only', icon: ScrollText, size: 1, value: 'source of truth', highlight: true },
          { label: 'Snapshots', sub: 'state at sequence N', icon: Camera, size: 0.8, value: 'speeds recovery' },
          { label: 'Read models', sub: 'balances, history', icon: Eye, size: 0.65, value: 'may lag seconds' },
          { label: 'External statements', sub: 'bank and PSP files', icon: Landmark, size: 0.5, value: 'reconciled daily' },
        ]} />
      <p>
        Auditing becomes “replay the log and compare”. So does debugging: copy the log, replay it on a laptop, and watch
        the exact state at the moment of a bug. Reconciliation replays independently and checks totals against bank
        statements.
      </p>

      <H2 id="hot-accounts">9 · Deep dive: hot accounts</H2>
      <p>
        A big merchant can receive thousands of payments per second. With one partition per account, that single
        partition becomes the ceiling for the whole merchant.
      </p>
      <SideBySide caption="General industry patterns; combine them for the busiest accounts" panels={[
        { title: 'Split into sub-accounts', icon: Split, tone: 'good', points: ['+ Credits spread over N buckets', '+ Balance = sum of buckets', '- Debits must pick a bucket with funds'], verdict: 'Receive-heavy merchants' },
        { title: 'Batch credits', icon: Layers, points: ['+ One update for many payments', '- Adds a small delay to crediting'], verdict: 'High-volume payees' },
        { title: 'Credit asynchronously', icon: Workflow, points: ['+ Debit is the only blocking step', '- Balance briefly shows funds in flight'], verdict: 'When a credit cannot fail' },
      ]} />

      <H2 id="data-model">10 · Data model</H2>
      <p>Three durable structures: the command log, the event log, and snapshots keyed by sequence.</p>
      <FlowDiagram caption="Recovery reads right to left: newest snapshot, then the events after it" steps={[
        { label: 'Command log', sub: 'input, in order', icon: ScrollText },
        { label: 'Event log', sub: 'truth, seq numbered', icon: Layers },
        { label: 'Snapshot @seq', sub: 'balances + applied ids', icon: Camera },
        { label: 'Replay tail', sub: 'events after seq', icon: RotateCcw },
      ]} />
      <CodeBlock lang="ts" title="event and snapshot shapes" code={`
type TransferEvent = {
  seq: number            // strictly increasing per partition
  commandId: string      // the Idempotency-Key; dedupe on replay too
  from: string; to: string
  amountMinor: number    // integer cents, never floats
  at: string             // taken from the command, not the clock at apply time
}

type Snapshot = {
  partition: number
  seq: number                           // last event folded in
  balances: Record<string, number>
  appliedCommandIds: string[]           // or a bounded window plus a TTL policy
}`} />

      <H2 id="staff">11 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Start boring.</strong> A relational ledger with idempotency keys handles far more than most wallets need. Name the measured bottleneck before proposing event sourcing.</li>
          <li><strong>Partition by account, route by sender.</strong> Same-partition transfers become local and lock-free. Place accounts that trade together on the same partition when you can.</li>
          <li><strong>Replication before acknowledgement.</strong> An in-memory state machine is only as durable as its replicated log. Say which quorum acknowledges a transfer.</li>
          <li><strong>Schema evolution.</strong> Events live forever. Version them and keep old upcasters, or replays from three years ago will break.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How would you process one million wallet transfers per second?"
        senior={<p>Shard accounts across many databases, use transactions for same-shard transfers and a distributed transaction for cross-shard ones, and cache balances in Redis.</p>}
        staff={<>
          <p>First I'd challenge the number and find where the limit really is: lock contention on hot rows and cross-shard coordination, not disk. Then I'd move to <strong>in-memory state machines per partition</strong>, fed by a replicated command log and producing an event log that is the source of truth.</p>
          <p>Single-threaded partitions remove locking. Snapshots bound recovery time. Cross-partition transfers use a debit-first saga with idempotent steps. Reads come from projections. I'd also call out the costs: operational complexity, event schema evolution, and slightly stale balance reads.</p>
        </>}
        followUps={['How do you rebalance partitions without downtime?', 'What happens if a projection falls hours behind?', 'How do you prove to an auditor that balances are correct?']}
      />
      <InterviewQuestion
        q="A client retries a transfer after a timeout. How do you guarantee it moves money only once?"
        senior={<p>Store the idempotency key with the result, and return the stored result if the same key comes again.</p>}
        staff={<>
          <p>Make the <strong>set of applied command ids part of the replicated state</strong>, so deduplication survives failover and replay. A key-value store beside the state machine can drift from it after a crash.</p>
          <p>Define the retention window explicitly and reject keys older than it with a clear error. For cross-partition sagas, every step carries the same command id, so each partition dedupes its own step independently.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'The hard part is contention and coordination, not raw throughput. Say so with numbers.',
        'Event log = truth; in-memory balances, snapshots and read models are derived and rebuildable.',
        'Single-threaded partitions give lock-free, deterministic processing that replays exactly.',
        'Cross-partition money moves need 2PC, TC/C or a saga; debit-first sagas suit wallets.',
        'Idempotency ids live inside the state, so duplicates are caught even after replay or failover.',
      ]} />
    </>
  )
}
