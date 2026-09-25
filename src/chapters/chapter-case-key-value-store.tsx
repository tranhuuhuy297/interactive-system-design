import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, FlowDiagram, H2, InterviewQuestion,
  KeyTakeaways, References, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { KvDynamoClusterSim } from './demos/kv-dynamo-cluster-sim'
import { KvMerkleDemo } from './demos/kv-merkle-demo'

const REFS: Reference[] = [
  { title: 'Dynamo: Amazon’s Highly Available Key-value Store', source: 'G. DeCandia et al. (SOSP)', year: 2007, url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf', kind: 'paper', note: 'ring, sloppy quorum, hinted handoff, vector clocks, Merkle anti-entropy' },
  { title: 'Consistent hashing and random trees', source: 'D. Karger et al. (STOC)', year: 1997, url: 'https://doi.org/10.1145/258533.258660', kind: 'paper' },
  { title: 'A Digital Signature Based on a Conventional Encryption Function (Merkle trees)', source: 'Ralph C. Merkle (CRYPTO ’87)', year: 1987, url: 'https://link.springer.com/chapter/10.1007/3-540-48184-2_32', kind: 'paper' },
  { title: 'The log-structured merge-tree (LSM-tree)', source: 'P. O’Neil, E. Cheng, D. Gawlick, E. O’Neil, Acta Informatica', year: 1996, url: 'https://link.springer.com/article/10.1007/s002360050048', kind: 'paper' },
  { title: 'Bigtable: A Distributed Storage System for Structured Data', source: 'F. Chang et al. (OSDI)', year: 2006, url: 'https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/', kind: 'paper', note: 'memtable + SSTables + Bloom filters' },
  { title: 'Dynamo (architecture overview)', source: 'Apache Cassandra documentation', url: 'https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html', kind: 'docs', note: 'tunable consistency, gossip, repair, tombstones' },
  { title: 'Designing Data-Intensive Applications', source: 'Martin Kleppmann', year: 2017, kind: 'book', note: 'ch. 5–6 on leaderless replication and partitioning' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 1 (ch. “Design a Key-value Store”)', source: 'Alex Xu', year: 2020, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'client', label: 'Client', sub: 'smart or thin', kind: 'client', x: 10, y: 50,
    detail: 'A smart client knows the ring (via gossip or a config endpoint) and sends requests straight to a replica. A thin client goes through a load balancer to any node, which then forwards.' },
  { id: 'coord', label: 'Coordinator', sub: 'any node', kind: 'service', x: 33, y: 50,
    detail: 'The node that receives the request becomes its coordinator. It hashes the key, finds the preference list, fans out to N replicas, and waits for W (write) or R (read) responses.' },
  { id: 'r1', label: 'Replica 1', sub: 'home', kind: 'db', x: 63, y: 16,
    detail: 'Each node runs the same storage engine: commit log → memtable → SSTables with Bloom filters. No leader: every replica accepts writes for its key ranges.' },
  { id: 'r2', label: 'Replica 2', sub: 'home', kind: 'db', x: 70, y: 50 },
  { id: 'r3', label: 'Replica 3', sub: 'home (down?)', kind: 'db', x: 63, y: 84,
    detail: 'If this node is down, sloppy quorum writes to the next healthy node on the ring with a hint. The hint is replayed when this node returns (hinted handoff).' },
  { id: 'r4', label: 'Next on ring', sub: 'hint holder', kind: 'db', x: 90, y: 84 },
  { id: 'gossip', label: 'Gossip', sub: 'membership', kind: 'external', x: 90, y: 22,
    detail: 'Nodes periodically exchange heartbeat tables with random peers. A node whose heartbeat stops advancing is suspected down. There is no central coordinator to fail.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'coord' }, { from: 'coord', to: 'r1' }, { from: 'coord', to: 'r2' }, { from: 'coord', to: 'r3' },
  { from: 'coord', to: 'r4', async: true }, { from: 'r4', to: 'r3', label: 'handoff', async: true },
  { from: 'r1', to: 'gossip', async: true }, { from: 'r2', to: 'gossip', async: true },
]

export default function KeyValueStoreChapter() {
  return (
    <>
      <p>
        Designing a distributed key-value store is the interview version of reading the Dynamo paper. It is less about
        the <code>get</code>/<code>put</code> API and more about <strong>which guarantees you give up, and how you
        repair what breaks</strong>: partitioning, replication, tunable consistency, conflict handling, failure
        detection, and anti-entropy. Every choice is a trade-off you should be able to defend.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['put(key, value)', 'get(key) → value', 'Values small (< 10 KB); keys opaque bytes']}
        nonFunctional={['Always writable (high availability)', 'Scale to 10+ TB and 1M+ ops/s by adding nodes', 'Tunable consistency per request', 'Low latency (single-digit ms p99 within a region)', 'Automatic failure handling']}
        outOfScope={['Range scans and secondary indexes', 'Multi-key transactions', 'Cross-region strong consistency']}
      />
      <Callout kind="tip">
        Ask whether the business prefers <strong>availability or consistency during a partition</strong>. A shopping
        cart (Dynamo's original use case) must accept writes and can merge later. A bank balance cannot. That one
        answer sets the whole design.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['10B keys × 1 KB avg (illustrative)', 'Replication factor N = 3', '1M ops/s peak, 80% reads', 'One node: ~2 TB usable SSD, ~50K ops/s']}
        rows={[
          { label: 'Raw data', math: '10B × 1 KB', result: '≈ 10 TB' },
          { label: 'Replicated', math: '10 TB × 3', result: '≈ 30 TB' },
          { label: 'Nodes (storage)', math: '30 TB ÷ 2 TB × 1.5 headroom', result: '≈ 23 nodes' },
          { label: 'Nodes (throughput)', math: '1M × (0.8 + 0.2×3 replicas) ÷ 50K', result: '≈ 28 nodes' },
          { label: 'Plan', math: 'max of both + failure headroom', result: '~32 nodes' },
        ]}
      />
      <p>Throughput, not storage, sets the node count here, because each write fans out to N replicas. Say this out loud: it is the kind of reasoning interviewers look for.</p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'PUT', path: '/kv/{key}', desc: 'Write a value; the client may pass the causal context (version) it read to help conflict resolution.', body: '{ value, context?, w? }', returns: '200 { context }' },
        { method: 'GET', path: '/kv/{key}', desc: 'Read; may return multiple sibling versions if concurrent writes conflicted.', body: '?r=2', returns: '{ values: [ … ], context }' },
        { method: 'DELETE', path: '/kv/{key}', desc: 'Writes a tombstone (a real delete would be resurrected by anti-entropy).', returns: '200' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={380}
        caption="Leaderless: any node can coordinate any request"
        flows={[
          { name: 'Write (W=2)', path: ['client', 'coord', 'r1', 'coord', 'r2'], steps: ['Client sends put(k, v)', 'Coordinator hashes k and writes to replica 1', 'Ack received', 'Second ack from replica 2, so W=2 is met and the write succeeds'] },
          { name: 'Read (R=2)', path: ['client', 'coord', 'r2', 'coord', 'r1'], steps: ['Client sends get(k)', 'Coordinator queries replicas', 'Response from replica 2', 'Response from replica 1; return the newest and read-repair any stale replica'] },
          { name: 'Node down', path: ['coord', 'r4', 'r3'], steps: ['Replica 3 unreachable, so write to the next node with a hint', 'When replica 3 recovers, the hint is handed off'] },
        ]} />

      <H2 id="partitioning">5 · Deep dive: partitioning & replication</H2>
      <ul>
        <li><strong>Consistent hashing</strong> places nodes and keys on a ring. A key belongs to the first node clockwise, and adding a node moves only about 1/n of the keys.</li>
        <li><strong>Virtual nodes</strong>: each physical node owns many small ranges. This evens out load, lets bigger machines take more ranges, and spreads a failed node's load across the cluster.</li>
        <li><strong>Replication</strong>: a key is stored on the next N distinct physical nodes clockwise (its preference list). Make them rack- or AZ-aware so one failure domain can't hold every copy.</li>
      </ul>

      <H2 id="quorum">6 · Deep dive: quorums & failures</H2>
      <p>
        With N replicas, a write waits for <strong>W</strong> acks and a read for <strong>R</strong> replies. If{' '}
        <code>W + R &gt; N</code>, every read quorum overlaps every write quorum, so a read sees the latest
        acknowledged write (absent sloppy quorums and concurrent writes). Lower W and R buy latency and availability
        at the cost of staleness.
      </p>
      <KvDynamoClusterSim />
      <CompareTable
        columns={['N/W/R', 'Behavior', 'Use for']}
        rows={[
          { label: '3 / 2 / 2', cells: ['Overlapping quorums; tolerates 1 failure for both reads and writes', 'Balanced default'] },
          { label: '3 / 3 / 1', cells: ['Fast reads, but writes fail if any replica is down', 'Read-heavy, rarely-written config'] },
          { label: '3 / 1 / 3', cells: ['Fast, always-available writes; slow, fragile reads', 'Write-heavy logging / ingest'] },
          { label: '3 / 1 / 1', cells: ['Lowest latency; stale reads expected', 'Caches, session data, counters that tolerate drift'] },
        ]}
      />
      <FlowDiagram steps={[
        { label: 'Temporary failure', sub: 'sloppy quorum + hinted handoff' },
        { label: 'Stale replica on read', sub: 'read repair' },
        { label: 'Long-lived divergence', sub: 'Merkle-tree anti-entropy' },
        { label: 'Dead node', sub: 'gossip detects → re-replicate ranges' },
      ]} caption="Layered repair: cheap mechanisms handle common failures, heavier ones catch what slips through" />

      <H2 id="anti-entropy">7 · Deep dive: anti-entropy with Merkle trees</H2>
      <p>
        Hints can be lost if the hint holder also dies, and read repair only fixes keys that are actually read. So
        replicas periodically compare <strong>Merkle trees</strong> of each key range. Matching roots mean the whole
        range is in sync. A mismatch leads you down only the branches that differ.
      </p>
      <KvMerkleDemo />

      <H2 id="conflicts">8 · Deep dive: conflicts & storage engine</H2>
      <CompareTable
        columns={['Last-write-wins (timestamps)', 'Vector clocks / siblings', 'CRDTs']}
        rows={[
          { label: 'Mechanism', cells: ['Highest timestamp wins', 'Detect concurrency, return all siblings', 'Data types whose merge is mathematically defined'] },
          { label: 'Data loss?', cells: ['Yes: concurrent writes silently dropped; clock skew makes it worse', 'No; the client merges', 'No; merges automatically'] },
          { label: 'Complexity', cells: ['Lowest', 'Client-side merge logic', 'Limited to supported types (counters, sets, maps)'] },
          { label: 'Seen in', cells: ['Cassandra', 'Dynamo paper, Riak', 'Riak data types, Redis Enterprise CRDBs'] },
        ]}
      />
      <CodeBlock lang="ts" title="write & read path on one node (LSM)" code={`
put(key, value):
  commitLog.append(key, value)        // sequential disk write → durability
  memtable.set(key, value)            // sorted in-memory structure
  if memtable.size > LIMIT:
    flushToSSTable(memtable)          // immutable sorted file + Bloom filter + index

get(key):
  if memtable.has(key) return it
  for sstable in newestFirst(sstables):
    if !sstable.bloom.mightContain(key) continue   // skip most files cheaply
    if (v = sstable.lookup(key)) return v
  return NOT_FOUND
// background: compaction merges SSTables, drops overwritten values and expired tombstones`} />

      <H2 id="staff">9 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>W+R&gt;N is not linearizability.</strong> Sloppy quorums, concurrent writes, and a failed write that still landed on some replicas can all produce anomalies. If the product needs compare-and-set, use a consensus-based store (Raft/Paxos per range, as in Spanner, CockroachDB, or etcd). Don't bolt it onto Dynamo semantics.</li>
          <li><strong>Tombstones are an operational hazard</strong>: deletes must outlive the anti-entropy window (Cassandra's <code>gc_grace_seconds</code>), otherwise a stale replica resurrects deleted data. Tombstone-heavy partitions also slow reads.</li>
          <li><strong>Hot keys</strong> break the uniformity assumption of consistent hashing. Detect them, then split or cache them, or add a client-side random suffix for write-heavy counters.</li>
          <li><strong>Multi-region</strong>: run a quorum per region (LOCAL_QUORUM) with async cross-region replication. State the conflict story explicitly.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="With N=3, W=2, R=2, can a client ever read a stale value?"
        senior={<p>Normally no, because W+R &gt; N means the read and write sets overlap, so at least one replica in every read has the latest write.</p>}
        staff={<>
          <p>Yes, in several edge cases:</p>
          <ul>
            <li><strong>Sloppy quorum</strong>: the write's W acks may land on fallback nodes outside the home set, so a read of the home replicas misses them until hinted handoff.</li>
            <li><strong>A failed write</strong> (only 1 ack) is still stored on that replica, so later reads may or may not see it. The write is neither committed nor rolled back.</li>
            <li><strong>Concurrent writes</strong> with LWW and clock skew can drop the “later” write.</li>
            <li><strong>Read during a write</strong>: one read sees the new value and a subsequent read might not (no read-your-writes across coordinators).</li>
          </ul>
          <p>That's why Dynamo-style stores are described as “eventually consistent with tunable staleness”, not strongly consistent.</p>
        </>}
        followUps={['How would you give a user read-your-writes?', 'When would you choose a Raft-based store instead?']}
      />
      <InterviewQuestion
        q="How does the cluster notice a node has died, and what happens to its data?"
        senior={<p>Nodes send heartbeats. If a node stops responding, the others mark it dead and its data is re-replicated from other replicas.</p>}
        staff={<>
          <p>Use gossip-based membership: each node periodically exchanges a heartbeat table with a few random peers, so failure information spreads in O(log n) rounds with no central monitor. Treat detection as <strong>suspicion</strong> (e.g. a phi-accrual detector), not a hard verdict.</p>
          <p>Separate <strong>transient</strong> from <strong>permanent</strong> failures. Transient: sloppy quorum and hints, no data movement. Permanent: an operator or automation removes the node, its ranges get new owners via the ring, and streaming from surviving replicas restores N copies. Rate-limit that streaming so recovery doesn't overload the cluster and cause a cascade.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Consistent hashing with virtual nodes partitions data; N replicas follow the key clockwise, spread across failure domains.',
        'Quorums (W+R>N) give tunable consistency, but not linearizability.',
        'Layered repair: hinted handoff, then read repair, then Merkle anti-entropy, then re-replication.',
        'Conflicts: LWW loses data, vector clocks push merging to clients, CRDTs merge automatically for supported types.',
        'Staff depth: tombstones, hot keys, multi-region quorums, and knowing when to switch to a consensus-based store.',
      ]} />
    </>
  )
}
