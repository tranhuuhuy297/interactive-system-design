import {
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, MentalModel, References, SideBySide, TLDR, Tabs, Term,
} from '../components/ui'
import { CreditCard, Inbox, PackageX, ScrollText, ShoppingCart, Undo2, XCircle } from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { MqDeliverySemanticsDemo } from './demos/mq-delivery-semantics-demo'
import { MqKafkaConsumerGroupDemo } from './demos/mq-kafka-consumer-group-demo'

const OUTBOX_NODES: ArchNode[] = [
  { id: 'api', label: 'Order service', kind: 'service', x: 10, y: 50 },
  { id: 'db', label: 'Orders DB', sub: 'orders + outbox', kind: 'db', x: 34, y: 50,
    detail: 'The business row and the outbox row are written in ONE local transaction. Either both exist or neither does, so there is no dual-write gap.' },
  { id: 'relay', label: 'Relay / CDC', sub: 'Debezium, poller', kind: 'worker', x: 56, y: 22,
    detail: 'Tails the outbox table (or the WAL/binlog via CDC) and publishes to the broker. It may publish twice after a crash, so consumers must be idempotent.' },
  { id: 'kafka', label: 'Broker', sub: 'topic: order-events', kind: 'queue', x: 74, y: 50 },
  { id: 'pay', label: 'Payment svc', kind: 'service', x: 92, y: 25 },
  { id: 'mail', label: 'Email svc', kind: 'service', x: 92, y: 75 },
]
const OUTBOX_EDGES: ArchEdge[] = [
  { from: 'api', to: 'db', label: 'single txn' }, { from: 'db', to: 'relay', async: true },
  { from: 'relay', to: 'kafka' }, { from: 'kafka', to: 'pay', async: true }, { from: 'kafka', to: 'mail', async: true },
]

const REFS: Reference[] = [
  { title: "Apache Kafka documentation", source: "Apache Software Foundation", url: "https://kafka.apache.org/documentation/", kind: "docs" },
  { title: "The Log: What every software engineer should know about real-time data’s unifying abstraction", source: "Jay Kreps", year: 2013, kind: "blog", note: "Originally published on the LinkedIn Engineering blog" },
  { title: "KIP-848: The Next Generation of the Consumer Rebalance Protocol", source: "Apache Kafka", url: "https://cwiki.apache.org/confluence/display/KAFKA/KIP-848%3A+The+Next+Generation+of+the+Consumer+Rebalance+Protocol", kind: "docs" },
  { title: "KIP-932: Queues for Kafka", source: "Apache Kafka", url: "https://cwiki.apache.org/confluence/display/KAFKA/KIP-932%3A+Queues+for+Kafka", kind: "docs" },
  { title: "Exactly-once Semantics Are Possible: Here’s How Kafka Does It", source: "Confluent blog", year: 2017, url: "https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/", kind: "blog" },
  { title: "Pattern: Transactional outbox", source: "Chris Richardson, microservices.io", url: "https://microservices.io/patterns/data/transactional-outbox.html", kind: "docs" },
  { title: "Sagas", source: "H. Garcia-Molina & K. Salem, SIGMOD", year: 1987, url: "https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf", kind: "paper" },
  { title: "Designing Data-Intensive Applications", source: "Martin Kleppmann (O’Reilly)", year: 2017, url: "https://dataintensive.net/", kind: "book" },
]

export default function QueuesStreamsChapter() {
  return (
    <>
      <p>
        Asynchronous messaging separates <strong>who produces work</strong> from <strong>who does it, and when</strong>.
        It absorbs traffic spikes, isolates failures, and lets new consumers subscribe without changing producers.
      </p>
      <TLDR items={[
        'Use a queue for commands (“do this job”). Use a log like Kafka for facts many teams read (“this happened”).',
        'The partition key sets ordering: events with the same key stay in order.',
        'Assume duplicates. Make consumers idempotent so processing twice has no extra effect.',
        'Move messages that keep failing to a dead-letter queue instead of blocking the stream.',
        'Use the outbox pattern to save data and publish its event without them getting out of sync.',
      ]} />
      <MentalModel id="messaging" />
      <p>
        The price is a new class of bugs: duplicates, reordering, messages that always fail, and invisible lag.
        Interviewers probe exactly those.
      </p>

      <H2 id="queue-vs-log">Queue vs log: two different tools</H2>
      <p>People often say “queue” for both, but they behave very differently once a message is read.</p>
      <SideBySide panels={[
        { title: 'Message queue', icon: Inbox, points: [
          'SQS, RabbitMQ',
          'Deleted once acknowledged; no replay',
          'Competing workers share one queue',
          '+ Delays, visibility timeouts, per-message ack, DLQ',
          '- Ordering is best effort (FIFO variants are slower)',
        ], verdict: 'Commands: task distribution, background jobs' },
        { title: 'Distributed log', icon: ScrollText, points: [
          'Kafka, Kinesis, Pulsar',
          'Append-only, retained by time or size',
          'Each consumer group keeps its own offset',
          '+ Replay by rewinding the offset',
          '+ Strict order within a partition',
        ], verdict: 'Facts: event streams, fan-out, analytics' },
      ]} />
      <Callout kind="tip">
        A quick heuristic: if the message is a <em>command</em> (“resize this image”), use a queue. If it is a
        <em> fact</em> (“order 42 was placed”) that several teams will care about, use a log.
      </Callout>

      <H2 id="partitions">Partitions, keys and consumer groups</H2>
      <p>
        A topic is split into <strong>partitions</strong>, and each is an ordered log. The producer picks a partition
        by hashing the message key, so <strong>all events for one key land in one partition, in order</strong>.
      </p>
      <p>
        Within a{' '}
        <Term def="A set of consumers that share the work of reading a topic; each partition goes to one member.">consumer group</Term>,
        each partition is owned by exactly one consumer at a time. Parallelism is therefore capped at the partition
        count, and extra consumers sit idle.
      </p>
      <MqKafkaConsumerGroupDemo />
      <ul>
        <li><strong>Choose the key by the ordering you need</strong>: <code>orderId</code> for order lifecycle events, <code>accountId</code> for balance changes. Ordering across keys is never guaranteed.</li>
        <li><strong>Hot keys</strong> put one partition behind while the others sit idle. Split hot keys with a suffix only if you can give up their ordering.</li>
        <li><strong><Term def="Reassigning partitions among consumers when one joins, leaves, or crashes.">Rebalances</Term></strong> pause the group. Incremental cooperative rebalancing and static membership reduce the pause, and Kafka 4.x's broker-driven consumer protocol (KIP-848) shrinks it further, but deploys still cause them.</li>
        <li><strong>Queue semantics on a log</strong>: Kafka's newer share groups (KIP-932, “queues for Kafka”) let many consumers pull from one partition with per-message acks, trading per-key ordering for parallelism beyond the partition count.</li>
        <li>Plan partition counts for peak throughput and future consumers. Adding partitions later changes the key → partition mapping and breaks per-key ordering across the change.</li>
      </ul>

      <H2 id="semantics">Delivery semantics</H2>
      <p>
        Crashes happen between reading a message and finishing the work. Where you record progress decides whether
        you lose messages or process some twice. Only{' '}
        <Term def="An operation you can safely repeat: doing it twice has the same effect as doing it once.">idempotent</Term>{' '}
        consumers make duplicates harmless.
      </p>
      <MqDeliverySemanticsDemo />
      <CompareTable
        columns={['How', 'Failure outcome', 'Use for']}
        rows={[
          { label: 'At-most-once', cells: ['Commit, then process', 'Lost messages', 'Metrics and telemetry where gaps are fine'] },
          { label: 'At-least-once', cells: ['Process, then commit', 'Duplicates', 'The default for almost everything'] },
          { label: 'Effectively once', cells: ['At-least-once + idempotent consumer', 'Duplicates are absorbed', 'Payments, inventory, anything with side effects'] },
        ]}
      />
      <Callout kind="warn">
        Kafka's “exactly-once” (idempotent producers + transactions) covers <strong>read-process-write within
        Kafka</strong>. The moment your consumer calls an external API or writes to another database, you are back
        to at-least-once and need your own idempotency, such as a processed-IDs table updated in the same
        transaction as the side effect, or a conditional write keyed by event ID.
      </Callout>

      <H2 id="failures">Poison messages, DLQs and backpressure</H2>
      <p>
        A <Term def="A message that fails every time it is processed, often because of bad data or a bug.">poison message</Term>{' '}
        can stall a whole partition. A{' '}
        <Term def="Dead-letter queue: a side queue where failed messages are parked for inspection and later replay.">DLQ</Term>{' '}
        keeps the main stream moving.
      </p>
      <FlowDiagram steps={[
        { label: 'Consume', sub: 'attempt 1' },
        { label: 'Retry', sub: 'backoff, N attempts' },
        { label: 'Retry topic', sub: 'delayed, off the main path' },
        { label: 'DLQ', sub: 'park + alert' },
        { label: 'Redrive', sub: 'after a fix' },
      ]} caption="Don’t block a partition on a message that will never succeed" />
      <ul>
        <li>A message that always fails blocks its partition forever if you retry inline. Move it to a <strong>retry topic</strong> with a delay, and after N attempts to a <strong>dead-letter queue</strong> with the error attached.</li>
        <li><strong>Backpressure</strong>: a log absorbs bursts because it is on disk, but lag grows. Alert on <em>consumer lag in time</em> (seconds behind), not message count, and autoscale consumers up to the partition count.</li>
        <li>Queues need a <strong>visibility timeout</strong> longer than the worst-case processing time, or two workers will process the same message.</li>
      </ul>

      <H2 id="outbox">The dual-write problem and the outbox</H2>
      <p>
        “Save the order, then publish OrderPlaced” is two writes to two systems. A crash between them leaves the
        database and the event stream disagreeing forever.
      </p>
      <p>
        The <strong>transactional outbox</strong> writes the event into the same database transaction as the order.
        A separate process publishes it afterwards.
      </p>
      <ArchitectureDiagram nodes={OUTBOX_NODES} edges={OUTBOX_EDGES} height={280}
        caption="Transactional outbox + CDC: atomic locally, eventually published"
        flows={[{ name: 'Place order', path: ['api', 'db', 'relay', 'kafka', 'pay'], steps: ['INSERT order + INSERT outbox in one txn', 'CDC reads the committed outbox row', 'Publish to the order-events topic', 'Payment consumes (idempotently)'] }]} />

      <H2 id="sagas">Sagas: transactions across services</H2>
      <p>
        Services don’t share a database, so one transaction can’t span them. A saga runs a sequence of local steps
        and undoes earlier ones with compensating actions if a later step fails.
      </p>
      <FlowDiagram caption="A failed saga: no rollback, only compensating actions" steps={[
        { label: 'Order placed', icon: ShoppingCart },
        { label: 'Charge card', sub: 'local commit', icon: CreditCard },
        { label: 'Reserve stock', sub: 'fails: out of stock', icon: PackageX },
        { label: 'Refund', sub: 'compensation', icon: Undo2 },
        { label: 'Order cancelled', icon: XCircle },
      ]} />
      <Tabs items={[
        { label: 'Choreography', content: <>
          <p>Each service reacts to events and emits its own. There is no central coordinator.</p>
          <CodeBlock lang="text" title="events" code={`
OrderPlaced → Payment charges → PaymentSucceeded → Inventory reserves → StockReserved → Shipping
                                          ↘ PaymentFailed → Order cancels`} />
          <p>Loosely coupled and simple for 2–3 steps. Beyond that the flow is implicit and spread across repos, so debugging means reconstructing it from logs.</p>
        </> },
        { label: 'Orchestration', content: <>
          <p>A coordinator, often a workflow engine such as Temporal or AWS Step Functions, drives the steps and calls <strong>compensations</strong> on failure.</p>
          <CodeBlock lang="ts" title="orchestrated saga" code={`
async function placeOrder(o: Order) {
  await payments.charge(o.id, o.total)            // idempotent by o.id
  try {
    await inventory.reserve(o.id, o.items)
  } catch (e) {
    await payments.refund(o.id)                    // compensation, not rollback
    throw e
  }
  await shipping.schedule(o.id)
}`} />
          <p>The flow is explicit and easy to observe. The coordinator is a dependency, which workflow engines make durable.</p>
        </> },
      ]} />
      <p>
        <strong>Event sourcing</strong> goes further: the event log <em>is</em> the source of truth. Current state is a
        projection rebuilt by replaying events.
      </p>
      <p>
        It gives a full audit trail and time travel, but schema evolution and rebuilding projections are real costs.
        Reach for it when audit history is a core requirement (ledgers), not by default.
      </p>

      <H2 id="staff">Staff-level lens</H2>
      <p>Event-driven systems fail in organizational ways as often as technical ones.</p>
      <Callout kind="staff">
        <ul>
          <li><strong>Events are APIs.</strong> Use a schema registry (Avro or Protobuf) with compatibility rules, versioned topics, and named owners. Most event-driven pain in practice is organizational: nobody knows who consumes <code>user-updated</code>.</li>
          <li><strong>Measure lag as time.</strong> “Payment events are 40 s behind” is an SLO you can page on. “12K messages of lag” is not.</li>
          <li><strong>Async is not free.</strong> The UX changes (the order is “processing”), and so do support (“where is my email?”) and testing. Say when a synchronous call is simply better.</li>
          <li><strong>Retention is a cost and compliance decision.</strong> Seven days of replay versus GDPR deletion obligations for PII in events.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Order events must be processed in order per order, but you need 50× more throughput. How?"
        senior={<p>Partition the topic by orderId, so each order's events stay in one partition in order. Increase the partition count and run more consumers in the group, up to one consumer per partition.</p>}
        staff={<>
          <p>Key by orderId and size partitions for peak, say 3× today's needs. Adding partitions later remaps keys, so I would do it during a drain or accept a brief ordering window.</p>
          <p>If consumer work per message is slow, per-partition parallelism can also come from <strong>key-level concurrency inside a consumer</strong>: a pool of workers, each owning a subset of keys, committing only the offset below which everything is done (what Confluent's Parallel Consumer does). That lifts throughput beyond the partition count while keeping per-key order.</p>
          <p>I would also check whether ordering is really needed: often events carry a version, and consumers can drop stale updates.</p>
        </>}
        followUps={['What happens to ordering during a rebalance?', 'How do you handle one very hot order ID?', 'How would you detect an ordering violation in production?']}
      />
      <InterviewQuestion
        q="Your consumer charges credit cards. How do you make sure nobody is charged twice?"
        senior={<p>Use at-least-once delivery with an idempotency key. Store processed event IDs and skip duplicates. Pass the idempotency key to the payment provider too.</p>}
        staff={<>
          <p>Idempotency at two layers:</p>
          <ul>
            <li><strong>Our side</strong>: insert the event ID into <code>processed_events</code> in the same DB transaction as the charge record. A unique constraint makes the duplicate fail atomically.</li>
            <li><strong>The provider side</strong>: send a stable idempotency key (derived from the payment intent, not the event) so a retry after a timeout doesn't double-charge.</li>
          </ul>
          <p>The subtle case is a timeout where we don't know if the charge happened. The answer is never “retry blindly”. Instead, query the provider by the idempotency key, and run a daily reconciliation job that compares the ledger with the provider's settlement report.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Queues distribute commands. Logs retain facts for many independent consumer groups.',
        'Ordering exists only per partition. Pick the key by the ordering you need, and partitions cap parallelism.',
        'At-least-once + idempotent consumers is the practical path to “exactly once” side effects.',
        'Fix dual writes with a transactional outbox + CDC. Coordinate multi-service workflows with sagas and compensations.',
        'Operate by consumer lag in seconds, DLQs with redrive, and schemas treated as public APIs.',
      ]} />
    </>
  )
}
