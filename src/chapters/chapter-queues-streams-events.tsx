import {
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, Tabs,
} from '../components/ui'
import type { ArchEdge, ArchNode } from '../components/ui'
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

export default function QueuesStreamsChapter() {
  return (
    <>
      <p>
        Asynchronous messaging decouples <strong>who produces work</strong> from <strong>who does it, and when</strong>.
        It absorbs traffic spikes, isolates failures and lets new consumers subscribe without changing producers.
        The price is a new class of bugs: duplicates, reordering, poison messages and invisible lag. Interviewers
        probe exactly those.
      </p>

      <H2 id="queue-vs-log">Queue vs log: two different tools</H2>
      <CompareTable
        columns={['Message queue (SQS, RabbitMQ)', 'Distributed log (Kafka, Kinesis, Pulsar)']}
        rows={[
          { label: 'Model', cells: ['Messages are deleted once acknowledged', 'Append-only log, retained by time or size'] },
          { label: 'Consumers', cells: ['Competing workers share one queue', 'Each consumer group keeps its own offset'] },
          { label: 'Replay', cells: ['No, once it is consumed it is gone', 'Yes, rewind the offset'] },
          { label: 'Ordering', cells: ['Best effort (FIFO variants exist, with lower throughput)', 'Strict within a partition'] },
          { label: 'Per-message features', cells: ['Delays, visibility timeouts, per-message ack, DLQ', 'Mostly none; the consumer manages it'] },
          { label: 'Sweet spot', cells: ['Task distribution, background jobs', 'Event streams, fan-out to many systems, analytics'] },
        ]}
      />
      <Callout kind="tip">
        A quick heuristic: if the message is a <em>command</em> (“resize this image”), use a queue. If it is a
        <em> fact</em> (“order 42 was placed”) that several teams will care about, use a log.
      </Callout>

      <H2 id="partitions">Partitions, keys and consumer groups</H2>
      <p>
        A topic is split into <strong>partitions</strong>, and each is an ordered log. The producer picks a partition by
        hashing the message key, so <strong>all events for one key land in one partition, in order</strong>.
        Within a consumer group, each partition is owned by exactly one consumer at a time. Parallelism is therefore capped at the
        partition count, and consumers beyond that sit idle.
      </p>
      <MqKafkaConsumerGroupDemo />
      <ul>
        <li><strong>Choose the key by the ordering you need</strong>: <code>orderId</code> for order lifecycle events, <code>accountId</code> for balance changes. Ordering across keys is never guaranteed.</li>
        <li><strong>Hot keys</strong> put one partition behind while the others sit idle. Split hot keys with a suffix only if you can give up their ordering.</li>
        <li><strong>Rebalances</strong> pause the group. Incremental cooperative rebalancing and static membership reduce the pause, and Kafka 4.x's broker-driven consumer protocol (KIP-848) shrinks it further, but deploys still cause them.</li>
        <li><strong>Queue semantics on a log</strong>: Kafka's newer share groups (KIP-932, “queues for Kafka”) let many consumers pull from one partition with per-message acks, trading per-key ordering for parallelism beyond the partition count.</li>
        <li>Plan partition counts for peak throughput and future consumers. Adding partitions later changes the key → partition mapping and breaks per-key ordering across the change.</li>
      </ul>

      <H2 id="semantics">Delivery semantics</H2>
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
        database and the event stream disagreeing forever. The <strong>transactional outbox</strong> writes the event
        into the same database transaction and publishes it afterwards.
      </p>
      <ArchitectureDiagram nodes={OUTBOX_NODES} edges={OUTBOX_EDGES} height={280}
        caption="Transactional outbox + CDC: atomic locally, eventually published"
        flows={[{ name: 'Place order', path: ['api', 'db', 'relay', 'kafka', 'pay'], steps: ['INSERT order + INSERT outbox in one txn', 'CDC reads the committed outbox row', 'Publish to the order-events topic', 'Payment consumes (idempotently)'] }]} />

      <H2 id="sagas">Sagas: transactions across services</H2>
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
        <strong>Event sourcing</strong> goes further: the event log <em>is</em> the source of truth, and current state is a
        projection rebuilt by replaying events. It gives a full audit trail and time travel, but schema evolution and
        rebuilding projections are real costs. Reach for it when audit history is a core requirement (ledgers),
        not by default.
      </p>

      <H2 id="staff">Staff-level lens</H2>
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
