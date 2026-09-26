import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, EstimationTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways,
  LayerStack, MentalModel, References, Requirements, SideBySide, StatRow, TLDR, Term,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import {
  CheckCheck, Cloud, Crown, Eraser, FileText, Fingerprint, Handshake, KeyRound, Layers, ListOrdered,
  Radio, Rocket, Scissors, Search, Send, Split, Trash2, Users, Zap,
} from 'lucide-react'
import { MqdReplicationDemo } from './demos/mqd-replication-demo'

const REFS: Reference[] = [
  { title: 'Kafka: a Distributed Messaging System for Log Processing', source: 'J. Kreps, N. Narkhede, J. Rao (NetDB)', year: 2011, url: 'https://www.microsoft.com/en-us/research/wp-content/uploads/2017/09/Kafka.pdf', kind: 'paper', note: 'segment files, offsets as the only consumer state, pull-based consumers' },
  { title: 'Apache Kafka documentation: design and replication', source: 'Apache Software Foundation', url: 'https://kafka.apache.org/documentation/#replication', kind: 'docs', note: 'ISR, high watermark, acks, unclean leader election, log compaction' },
  { title: 'KIP-101: Use leader epoch rather than high watermark for truncation', source: 'Apache Kafka', year: 2017, url: 'https://cwiki.apache.org/confluence/display/KAFKA/KIP-101+-+Alter+Replication+Protocol+to+use+Leader+Epoch+rather+than+High+Watermark+for+Truncation', kind: 'docs' },
  { title: 'KIP-98: Exactly Once Delivery and Transactional Messaging', source: 'Apache Kafka', year: 2017, url: 'https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging', kind: 'docs', note: 'idempotent producer and transactions' },
  { title: 'KIP-500: Replace ZooKeeper with a Self-Managed Metadata Quorum', source: 'Apache Kafka', url: 'https://cwiki.apache.org/confluence/display/KAFKA/KIP-500%3A+Replace+ZooKeeper+with+a+Self-Managed+Metadata+Quorum', kind: 'docs', note: 'KRaft' },
  { title: 'Apache Kafka 4.0.0 release announcement', source: 'Apache Kafka blog', year: 2025, url: 'https://kafka.apache.org/blog/2025/03/18/apache-kafka-4.0.0-release-announcement/', kind: 'blog', note: 'first major release that runs entirely without ZooKeeper' },
  { title: 'KIP-405: Kafka Tiered Storage', source: 'Apache Kafka', url: 'https://cwiki.apache.org/confluence/display/KAFKA/KIP-405%3A+Kafka+Tiered+Storage', kind: 'docs' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 2 (ch. “Distributed Message Queue”)', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'producer', label: 'Producers', sub: 'batch by partition', kind: 'client', x: 10, y: 22,
    detail: 'Clients hash the record key to pick a partition, batch records per partition, compress the batch, and send it to that partition’s leader.' },
  { id: 'consumer', label: 'Consumer group', sub: 'one owner per partition', kind: 'client', x: 10, y: 82,
    detail: 'Each partition is read by exactly one member of the group at a time. Members fetch from the leader and commit offsets to track progress.' },
  { id: 'a', label: 'Broker A', sub: 'leader + coordinator', kind: 'service', x: 40, y: 50,
    detail: 'Leads partition 0: appends batches to the active segment, serves fetches, and advances the high watermark as followers catch up. It is also this group’s coordinator, so offset commits land here.' },
  { id: 'b', label: 'Broker B', sub: 'in-sync follower', kind: 'service', x: 64, y: 22,
    detail: 'Fetches from the leader the same way a consumer would. While it stays within the allowed lag it is in the ISR and can take over.' },
  { id: 'c', label: 'Broker C', sub: 'lagging follower', kind: 'service', x: 64, y: 82,
    detail: 'A follower that has fallen behind is removed from the in-sync replica set until it catches up. It cannot become leader in a clean election.' },
  { id: 'ctrl', label: 'Controller quorum', sub: 'KRaft metadata log', kind: 'external', x: 88, y: 50,
    detail: 'A small Raft group that owns cluster metadata: topics, partition leaders, ISR, configs. Brokers follow the metadata log instead of reading ZooKeeper.' },
  { id: 'tier', label: 'Tiered storage', sub: 'object store', kind: 'storage', x: 88, y: 82,
    detail: 'Closed segments are copied to object storage. Brokers keep only recent segments on local disk, so retention can grow without adding brokers.' },
]

const EDGES: ArchEdge[] = [
  { from: 'producer', to: 'a', label: 'produce' }, { from: 'a', to: 'b', label: 'replicate' }, { from: 'a', to: 'c' },
  { from: 'consumer', to: 'a', label: 'fetch' }, { from: 'ctrl', to: 'a' }, { from: 'ctrl', to: 'b' },
  { from: 'a', to: 'tier', async: true },
]

export default function DistributedMessageQueueChapter() {
  return (
    <>
      <TLDR items={[
        'Build a durable, replayable queue: producers append records, many consumer groups read them independently.',
        'Key decision: model each partition as an append-only log on disk. Consumers own their position (an offset).',
        'Durability comes from leader-follower replication and the in-sync replica set, with acks=all for data you cannot lose.',
        'The high watermark separates records that are safe to read from records that could still vanish in a failover.',
        'Staff insight: partition count, key skew, and the unclean-election setting are product decisions, not just knobs.',
      ]} />
      <MentalModel id="message-queue" />

      <p>
        The <a href="#/messaging">Queues &amp; streams chapter</a> covers how to <em>use</em> a log like Kafka. Here we
        build one. The surprise is how simple the core is: files you only ever append to, and a number that says how far
        each reader got.
      </p>
      <p>
        Everything hard lives around that core: replication, failover, rebalancing consumers, and deciding what
        “acknowledged” promises.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>Durability and ordering guarantees decide more of this design than throughput does.</p>
      <Requirements
        functional={['Topics split into partitions', 'Produce records with an optional key', 'Consume as groups; each group sees every record', 'Replay from any retained offset', 'Retention by time or size; compaction by key']}
        nonFunctional={['1M records/s in, 1 KB average (illustrative)', 'Ordering guaranteed within a partition', 'No acknowledged record lost when one broker fails', 'Publish p99 in the tens of milliseconds', 'Scale by adding brokers']}
        outOfScope={['Per-message routing rules (AMQP-style exchanges)', 'Delayed and priority delivery']}
      />
      <Callout kind="tip">
        Ask whether consumers need <strong>replay</strong>. If messages disappear once processed, a classic queue
        fits. If several teams read the same data at their own pace, you want a log. This chapter builds a log.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>Replication multiplies disk and network traffic, so estimate after the replication factor.</p>
      <EstimationTable
        assumptions={['1M records/s × 1 KB, replication factor 3, 7-day retention', '3 consumer groups read everything', 'One partition comfortably handles ~10 MB/s; a broker ~100 MB/s of writes including replication (illustrative)']}
        rows={[
          { label: 'Ingress', math: '1M × 1 KB', result: '≈ 1 GB/s' },
          { label: 'Disk writes, cluster-wide', math: '1 GB/s × RF 3', result: '≈ 3 GB/s' },
          { label: 'Consumer egress', math: '1 GB/s × 3 groups', result: '≈ 3 GB/s' },
          { label: 'Retained data', math: '1 GB/s × 604,800 s × 3', result: '≈ 1.8 PB' },
          { label: 'Partitions', math: '1 GB/s ÷ 10 MB/s', result: '≈ 100+' },
          { label: 'Brokers', math: '3 GB/s ÷ 100 MB/s', result: '≈ 30, plus headroom' },
        ]}
      />
      <StatRow stats={[
        { value: '1 GB/s', label: 'ingress' },
        { value: '3 GB/s', label: 'disk writes with RF 3' },
        { value: '1.8 PB', label: 'retained for 7 days' },
        { value: '~30', label: 'brokers before headroom', note: 'illustrative' },
      ]} />
      <p>
        Retention dominates the hardware bill. That is why{' '}
        <Term def="Keeping recent log segments on local disk and moving older ones to cheap object storage.">tiered storage</Term>{' '}
        exists: it decouples how long you keep data from how many brokers you run.
      </p>

      <H2 id="api">3 · API</H2>
      <p>
        Real systems use a binary protocol over long-lived TCP connections. The shape of the calls is what matters.
      </p>
      <ApiSpec endpoints={[
        { method: 'POST', path: 'produce(topic, partition, batch, acks)', desc: 'Append a compressed batch to a partition leader.', body: '{ records[{key, value, headers}], producerId, sequence }', returns: '{ baseOffset } or NOT_LEADER / NOT_ENOUGH_REPLICAS' },
        { method: 'GET', path: 'fetch(topic, partition, offset, maxBytes)', desc: 'Read records from an offset. Long-polls until data arrives.', returns: '{ records[], highWatermark }' },
        { method: 'POST', path: 'joinGroup(group, topics)', desc: 'Join a consumer group; the coordinator assigns partitions.', returns: '{ memberId, assignment[] }' },
        { method: 'POST', path: 'commitOffsets(group, {partition: offset})', desc: 'Record progress, stored in an internal compacted topic.', returns: '200' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>
        Brokers store partitions. Each partition has one leader and some followers. A small controller quorum decides
        who leads what. Producers and consumers talk only to leaders.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="One partition’s view: a leader, two followers, the controller, and a consumer group"
        flows={[
          { name: 'Produce (acks=all)', path: ['producer', 'a', 'b'],
            steps: ['Producer sends a batch to the partition leader', 'Followers fetch the batch; the leader acks once every in-sync replica has it'] },
          { name: 'Consume', path: ['consumer', 'a'],
            steps: ['Consumer fetches from its committed offset, up to the high watermark'] },
          { name: 'Commit offsets', path: ['consumer', 'a'],
            steps: ['Consumer commits its position to the group coordinator, here also Broker A'] },
          { name: 'Failover', path: ['ctrl', 'b'],
            steps: ['Broker A stops heartbeating; the controller makes in-sync Broker B the leader and bumps the leader epoch'] },
        ]} />

      <H2 id="storage">5 · Deep dive: the log on disk</H2>
      <p>
        A partition is a directory of <Term def="A file holding a contiguous range of records. Only the newest segment is written to; older ones are read-only.">segments</Term>.
        Writes always go to the end of the newest one. That makes writes sequential, which disks and the OS page cache
        handle extremely well.
      </p>
      <LayerStack legend="From a partition down to one record"
        caption="A lookup binary-searches segment names, then a sparse index, then scans a few KB"
        layers={[
          { label: 'Partition', sub: 'orders-7/', icon: Layers, size: 1, value: 'ordered, append-only' },
          { label: 'Segments', sub: '00000000.log, 01048576.log …', icon: FileText, size: 0.8, value: 'rolled at ~1 GiB (default)' },
          { label: 'Offset index', sub: 'sparse: every ~4 KB of log', icon: Search, size: 0.55, value: 'offset → file position' },
          { label: 'Record batch', sub: 'compressed, CRC-checked', icon: ListOrdered, size: 0.35, value: 'the unit of I/O', highlight: true },
        ]} />
      <CodeBlock lang="bash" title="one partition on disk" code={`
orders-7/
  00000000000000000000.log        # records 0 … 1,048,575 (closed, read-only)
  00000000000000000000.index      # sparse offset → byte position
  00000000000000000000.timeindex  # timestamp → offset, for "seek to 9am"
  00000000000001048576.log        # active segment: appends go here
  00000000000001048576.index`} />
      <p>
        Deleting old data is cheap: drop whole closed segments. There is no per-record delete, which is exactly why
        the design stays fast.
      </p>

      <H2 id="replication">6 · Deep dive: replication, ISR, and the high watermark</H2>
      <p>
        Followers pull from the leader. The leader tracks which followers are close enough to count as the{' '}
        <Term def="In-sync replica set: the leader plus followers that are caught up within a configured lag. Only these can become leader in a clean election.">in-sync replicas (ISR)</Term>.
        The <Term def="The highest offset that every in-sync replica has. Consumers only read below it.">high watermark</Term>{' '}
        is the point every ISR member has reached.
      </p>
      <SideBySide caption="acks decides when the producer hears “done”, and therefore what a failover can take away" panels={[
        { title: 'acks=0', icon: Rocket, tone: 'bad', points: ['+ Lowest latency', '- Producer never learns about failures', '- Records can vanish silently'], verdict: 'Metrics you can afford to drop' },
        { title: 'acks=1', icon: Crown, points: ['+ Leader has written it', '- Lost if the leader dies before followers copy it'], verdict: 'Throughput over safety' },
        { title: 'acks=all', icon: CheckCheck, tone: 'good', points: ['+ Every in-sync replica has it', '+ Survives losing the leader', '- Waits for the slowest in-sync follower'], verdict: 'Orders, payments, anything you can’t lose' },
      ]} />
      <MqdReplicationDemo />
      <Callout kind="pitfall">
        acks=all with <code>min.insync.replicas=1</code>. When followers fall out of the ISR, “all” quietly means “just
        the leader”. Set the minimum to 2 with replication factor 3, so writes fail loudly instead of becoming unsafe.
      </Callout>

      <H2 id="groups">7 · Deep dive: consumer groups and rebalancing</H2>
      <p>
        A consumer group shares a topic’s partitions among its members. Each partition has one owner at a time, which
        preserves ordering. When members join or leave, the group{' '}
        <Term def="Reassigning partitions among the members of a consumer group after one joins, leaves, or dies.">rebalances</Term>.
      </p>
      <FlowDiagram steps={[
        { label: 'Join', sub: 'member contacts coordinator', icon: Users },
        { label: 'Assign', sub: 'partitions → members', icon: Split },
        { label: 'Fetch', sub: 'from committed offset', icon: Radio },
        { label: 'Process', sub: 'idempotently', icon: Zap },
        { label: 'Commit', sub: 'new offset', icon: CheckCheck },
      ]} caption="Commit after processing for at-least-once delivery; the consumer must tolerate replays" />
      <p>
        Older protocols paused the whole group during a rebalance. Kafka’s newer consumer protocol moves assignment to
        the broker and reassigns incrementally; see the <a href="#/messaging">messaging chapter</a> for details.
      </p>

      <H2 id="retention">8 · Deep dive: retention and compaction</H2>
      <p>A log cannot grow forever. There are two ways to bound it, chosen per topic.</p>
      <SideBySide caption="Compaction turns a topic into a changelog you can rebuild state from" panels={[
        { title: 'Delete by time or size', icon: Trash2, points: ['+ Drop whole old segments', '+ Simple and cheap', '- History older than N days is gone'], verdict: 'Event streams, logs, clickstreams' },
        { title: 'Compact by key', icon: Scissors, tone: 'good', points: ['+ Keeps the latest record per key', '+ A null value (tombstone) deletes a key', '- Background cleaner uses I/O'], verdict: 'Changelogs, current state per entity' },
      ]} />
      <p>
        Tiered storage adds a third lever. Closed segments move to object storage, and the broker fetches them back
        only when a consumer replays that far.
      </p>

      <H2 id="exactly-once">9 · Deep dive: exactly-once, carefully</H2>
      <p>
        The network can duplicate a produce request when a response is lost. Two mechanisms remove those duplicates
        inside the queue.
      </p>
      <FlowDiagram steps={[
        { label: 'Producer id', sub: 'assigned on init', icon: Fingerprint },
        { label: 'Sequence numbers', sub: 'per partition', icon: ListOrdered },
        { label: 'Broker dedupes', sub: 'rejects repeats', icon: Eraser },
        { label: 'Transaction', sub: 'atomic multi-partition write', icon: Handshake },
        { label: 'read_committed', sub: 'consumers skip aborted', icon: KeyRound },
      ]} caption="Idempotent producers stop duplicates; transactions make consume-transform-produce atomic" />
      <p>
        This gives exactly-once <em>within</em> the log. Side effects outside it, such as charging a card, still need
        their own idempotency keys. Promising more than that in an interview is a red flag.
      </p>

      <H2 id="metadata">10 · Deep dive: controller and metadata</H2>
      <p>Someone has to decide which broker leads each partition. That decision needs consensus.</p>
      <SideBySide caption="Kafka 4.0 (2025) is the first major release that runs entirely without ZooKeeper" panels={[
        { title: 'External coordinator', icon: Cloud, points: ['+ Proven for years', '- Second distributed system to run', '- Metadata changes slow at high partition counts'], verdict: 'ZooKeeper era' },
        { title: 'Built-in Raft quorum', icon: Send, tone: 'good', points: ['+ Metadata is itself a replicated log', '+ Brokers replay it to stay current', '+ Faster failover with many partitions'], verdict: 'KRaft (KIP-500)' },
      ]} />

      <H2 id="data-model">11 · Data model</H2>
      <p>The record batch is the unit that is written, replicated, and fetched.</p>
      <CodeBlock lang="ts" title="record batch (simplified)" code={`
type RecordBatch = {
  baseOffset: bigint          // assigned by the leader on append
  partitionLeaderEpoch: number // detects stale leaders after failover
  producerId: bigint; producerEpoch: number; baseSequence: number  // dedupe
  isTransactional: boolean
  compression: 'none' | 'gzip' | 'lz4' | 'zstd'
  crc: number
  records: { offsetDelta: number; timestampDelta: number; key?: Uint8Array; value?: Uint8Array; headers: [string, Uint8Array][] }[]
}

// Consumer progress lives in a compacted internal topic:
//   key = (group, topic, partition)  value = { offset, metadata }`} />

      <H2 id="staff">12 · Going beyond: staff-level extensions</H2>
      <p>Operating this system is where most of the risk sits. Staff answers cover the defaults you would set.</p>
      <Callout kind="staff">
        <ul>
          <li><strong>Partition count is a one-way door.</strong> It caps consumer parallelism, and adding partitions later reshuffles which keys land where, which breaks per-key ordering for in-flight data.</li>
          <li><strong>Key skew.</strong> One hot key means one hot partition and one overloaded consumer. Detect it, and if ordering allows, salt the key.</li>
          <li><strong>Unclean election is a business decision.</strong> Allowing an out-of-sync replica to lead restores availability but loses acknowledged data. Payments topics should say no; metrics topics may say yes.</li>
          <li><strong>Rack awareness.</strong> Spread each partition’s replicas across zones, or one zone outage takes out the whole ISR.</li>
          <li><strong>Multi-tenancy.</strong> Quotas on produce and fetch bytes per client keep one noisy team from starving the rest.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="The partition leader crashes right after acknowledging a write. Is the record lost?"
        senior={<p>It depends on acks. With acks=all the followers have it, so a new leader has the record. With acks=1 it might be lost.</p>}
        staff={<>
          <p>With acks=all, the leader acknowledges only after every in-sync replica has the record, and the controller elects the new leader from that set. So the record survives, provided min.insync.replicas was at least 2; otherwise “all” may have meant only the leader.</p>
          <p>With acks=1, the ack can race ahead of replication, and a new leader truncates what it never had. Leader epochs make that truncation precise. I would also ask about unclean election: if it is enabled and no in-sync replica survives, even acks=all data can be lost in exchange for availability.</p>
        </>}
        followUps={['What does a consumer see during the failover?', 'Why can consumers only read below the high watermark?', 'How would you size min.insync.replicas across three zones?']}
      />
      <InterviewQuestion
        q="How do you choose the number of partitions for a new topic?"
        senior={<p>Take target throughput divided by per-partition throughput, and make sure it is at least the number of consumers you want.</p>}
        staff={<>
          <p>Start from the larger of two numbers: throughput needed divided by what one partition sustains, and the peak consumer parallelism. Then add headroom, because increasing it later remaps keys and breaks per-key ordering.</p>
          <p>Too many partitions has costs too: more files, longer leader elections, more memory in clients. For keyed topics I would check the key distribution first; a skewed key set makes extra partitions useless.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'A partition is an append-only log of segment files; consumers track their own offsets.',
        'Followers pull from the leader; the in-sync replica set defines who can take over safely.',
        'acks=all plus min.insync.replicas ≥ 2 is how you avoid losing acknowledged data.',
        'Consumers read only up to the high watermark, so they never see data a failover could erase.',
        'Retention, compaction, tiered storage, and partition count are long-lived product decisions.',
      ]} />
    </>
  )
}
