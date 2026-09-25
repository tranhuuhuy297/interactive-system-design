import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, Tabs,
} from '../components/ui'
import { ConsensusQuorumPlaygroundDemo } from './demos/consensus-quorum-playground-demo'
import { ConsensusRaftElectionDemo } from './demos/consensus-raft-election-demo'
import { ConsensusReplicationLagDemo } from './demos/consensus-replication-lag-demo'

export default function ConsistencyChapter() {
  return (
    <>
      <p>
        Replication keeps copies of data on several machines for durability, availability and read scale. As
        soon as there are copies, you have to decide <strong>what a reader is allowed to see</strong> and
        <strong> who gets to decide the order of writes</strong>. This chapter covers the models, the maths of
        quorums, and how consensus protocols like Raft keep a cluster agreeing on one leader and one history.
      </p>

      <H2 id="replication">Replication topologies</H2>
      <CompareTable
        columns={['Single-leader', 'Multi-leader', 'Leaderless']}
        rows={[
          { label: 'Writes go to', cells: ['One leader per partition', 'Any leader (often one per region)', 'Any replica; the client or coordinator writes to W of N'] },
          { label: 'Conflicts', cells: ['None: the leader orders writes', 'Yes: needs resolution (LWW, CRDTs, app merge)', 'Yes: version vectors plus read repair'] },
          { label: 'Failover', cells: ['Promote a follower; risk of split brain', 'Other leaders keep going', 'No failover needed; quorums absorb failures'] },
          { label: 'Write latency', cells: ['One round trip to the leader', 'Local-region write', 'Wait for W acks'] },
          { label: 'Examples', cells: ['PostgreSQL, MySQL, Kafka partitions, etcd', 'Multi-region active-active, CouchDB, collaborative editing', 'Dynamo-style: Cassandra, Riak, ScyllaDB'] },
        ]}
      />
      <Tabs items={[
        { label: 'Sync vs async', content: <p className="muted"><strong>Synchronous</strong> replication waits for followers before acking, so there is no data loss on leader failure but latency and availability depend on the slowest replica. <strong>Asynchronous</strong> is fast, but acknowledged writes can be lost on failover. The common middle ground is <strong>semi-synchronous</strong>: wait for one follower (or a quorum), and let the rest catch up.</p> },
        { label: 'Failover hazards', content: <ul>
          <li><strong>Split brain</strong>: two nodes both believe they are leader. Prevent it with fencing tokens or epochs, and a majority-based election.</li>
          <li><strong>Lost writes</strong>: an async follower promoted without the last writes. Anything built on those IDs may now be inconsistent.</li>
          <li><strong>Timeouts</strong>: too short and you get unnecessary failovers under load; too long and you get long outages.</li>
        </ul> },
      ]} />

      <H2 id="lag">Replication lag anomalies</H2>
      <p>
        With async read replicas, “eventually consistent” shows up as very concrete bugs. Users see their own
        change disappear, or a page flips between old and new data on refresh.
      </p>
      <ConsensusReplicationLagDemo />
      <ul>
        <li><strong>Read-your-writes</strong>: after a user writes, route their reads to the leader for a window, or read from a replica only if it has caught up to the user's last write position (LSN/GTID in the session).</li>
        <li><strong>Monotonic reads</strong>: pin a user to one replica (hash of user ID), so time never goes backwards for them.</li>
        <li><strong>Consistent prefix</strong>: causally related writes (a question, then its answer) must be seen in order, so keep them on the same partition or track causality.</li>
      </ul>

      <H2 id="models">Consistency models</H2>
      <FlowDiagram steps={[
        { label: 'Linearizable', sub: 'one copy, real-time order' },
        { label: 'Sequential', sub: 'one global order, not real-time' },
        { label: 'Causal', sub: 'cause before effect' },
        { label: 'Session guarantees', sub: 'RYW, monotonic reads' },
        { label: 'Eventual', sub: 'converges if writes stop' },
      ]} caption="Strongest to weakest. Stronger means easier to reason about, and costlier in latency and availability" />
      <Callout kind="info">
        Don't confuse <strong>linearizability</strong> (a single-object recency guarantee) with
        <strong> serializability</strong> (multi-object transaction isolation). Spanner provides both, known as{' '}
        <em>strict serializability</em>. Many systems provide one without the other.
      </Callout>

      <H2 id="cap">CAP and PACELC</H2>
      <p>
        <strong>CAP</strong>: during a network <strong>partition</strong>, a replicated system must choose between
        <strong> consistency</strong> (linearizability, refusing some requests) and <strong>availability</strong>{' '}
        (answering from any reachable node, possibly stale). Partitions are not optional, so the real choice is CP
        or AP <em>when things break</em>.
      </p>
      <p>
        <strong>PACELC</strong> completes the picture: if Partition, choose A or C; <strong>E</strong>lse (normal
        operation), choose <strong>L</strong>atency or <strong>C</strong>onsistency. This is the trade-off you pay
        every day, not just during rare partitions.
      </p>
      <CompareTable
        columns={['During partition', 'Normal operation', 'Example']}
        rows={[
          { label: 'PC/EC', cells: ['Consistency', 'Consistency', 'Spanner, etcd/ZooKeeper, HBase'] },
          { label: 'PA/EL', cells: ['Availability', 'Latency', 'Dynamo-style stores at default quorum settings, Cassandra (ONE)'] },
          { label: 'PA/EC', cells: ['Availability', 'Consistency', 'Some configurations of MongoDB'] },
          { label: 'Tunable', cells: ['Per request', 'Per request', 'Cassandra/DynamoDB consistency levels'] },
        ]}
      />

      <H2 id="quorums">Quorums: N, R, W</H2>
      <p>
        In leaderless systems each key is stored on N replicas. A write waits for W acks and a read queries R
        replicas and takes the newest version. If <strong>R + W &gt; N</strong>, every read set overlaps every write
        set in at least one replica, so the read sees the latest <em>acknowledged</em> write.
      </p>
      <ConsensusQuorumPlaygroundDemo />
      <Callout kind="warn">
        R + W &gt; N is not linearizability. Sloppy quorums (hinted handoff to non-home nodes), concurrent writes
        resolved by last-write-wins with skewed clocks, and partially failed writes can all still return
        surprising results. Say “strong-ish” and name the edge cases.
      </Callout>

      <H2 id="consensus">Consensus with Raft</H2>
      <p>
        Consensus lets a group of nodes agree on a sequence of values even when some crash, as long as a majority
        is up. It is what makes leader election safe (no split brain) and underpins etcd, Consul, CockroachDB,
        TiKV and Kafka's KRaft mode.
      </p>
      <ConsensusRaftElectionDemo />
      <ul>
        <li><strong>Terms</strong> are logical epochs. A node that sees a higher term immediately steps down. That is the fencing mechanism.</li>
        <li><strong>Randomized election timeouts</strong> make split votes rare and self-resolving.</li>
        <li><strong>One vote per term</strong> plus <strong>majority</strong> means at most one leader per term.</li>
        <li><strong>Log replication</strong>: the leader appends entries and commits once a majority stores them. Voters refuse candidates whose log is behind theirs, so committed entries are never lost.</li>
        <li>A 5-node cluster tolerates 2 failures. Going to 6 nodes adds cost without adding tolerance, which is why clusters use odd sizes.</li>
      </ul>

      <H2 id="conflicts">Conflicts, clocks & distributed transactions</H2>
      <Tabs items={[
        { label: 'Version vectors', content: <>
          <p className="muted">Wall clocks drift, so last-write-wins by timestamp silently drops writes. A <strong>version vector</strong> keeps a counter per replica. If one vector dominates the other, it wins. If neither does, the writes were <em>concurrent</em>, and the system keeps both as siblings and asks the app or a merge function to resolve.</p>
          <CodeBlock lang="ts" code={`
type VV = Record<string, number>
function compare(a: VV, b: VV): 'before' | 'after' | 'equal' | 'concurrent' {
  let aGreater = false, bGreater = false
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[k] ?? 0) > (b[k] ?? 0)) aGreater = true
    if ((b[k] ?? 0) > (a[k] ?? 0)) bGreater = true
  }
  return aGreater && bGreater ? 'concurrent' : aGreater ? 'after' : bGreater ? 'before' : 'equal'
}`} />
        </> },
        { label: 'CRDTs', content: <p className="muted"><strong>Conflict-free replicated data types</strong> (G-counters, OR-sets, LWW-registers, sequence CRDTs for text) are designed so that merging replicas in any order converges to the same state. They power offline-first apps and collaborative editors, at the cost of metadata overhead and restricted operations.</p> },
        { label: '2PC vs sagas', content: <CompareTable columns={['Two-phase commit', 'Saga']} rows={[
          { label: 'Guarantee', cells: ['Atomic across participants', 'Eventual; compensating actions undo steps'] },
          { label: 'Failure mode', cells: ['Blocks if the coordinator dies mid-commit (locks held)', 'Intermediate states are visible; compensation can fail'] },
          { label: 'Use', cells: ['Inside one database or tightly coupled resources', 'Across microservices (order → payment → shipping)'] },
        ]} /> },
      ]} />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Choose consistency per operation, not per system.</strong> Payment debits are linearizable; like counts are eventual; the profile page is read-your-writes. Mixed consistency is normal and cheaper.</li>
          <li><strong>Put consensus on the control plane, not the data path.</strong> Use etcd or ZooKeeper for membership, leases and config, not for every user write. Consensus writes cost a majority round trip.</li>
          <li><strong>Multi-region</strong>: a quorum spanning regions puts 50–150 ms of cross-region latency on every write. Alternatives: a home region per user, async replication with conflict handling, or a regional leader per partition.</li>
          <li><strong>Test it.</strong> Jepsen-style fault injection has found consistency bugs in many well-known databases. Don't trust the marketing page.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Explain the CAP theorem and how it applies to a system you'd design."
        senior={<p>When there's a network partition, you choose consistency or availability. Payments choose CP, social feeds choose AP. You can't have all three.</p>}
        staff={<>
          <p>CAP only constrains behaviour <em>during a partition</em>, and “C” there means linearizability, a narrow definition. The more useful framing is PACELC: in normal operation we trade latency against consistency all the time.</p>
          <p>For concrete design I'd pick per operation. Wallet balance changes go through a single leader per account with synchronous replication, so they refuse writes if the leader loses quorum (CP). The activity feed is served from async replicas and caches (AP/EL), with read-your-writes for the author. Then I'd say what users actually see during a regional partition, which is the part interviewers want.</p>
        </>}
        followUps={['What does “C” in CAP mean vs “C” in ACID?', 'How would you give read-your-writes across regions?', 'Is Cassandra CP or AP?']}
      />
      <InterviewQuestion
        q="Your leader-based database failed over and some acknowledged writes are gone. How did that happen and how do you prevent it?"
        senior={<p>The replication was asynchronous, so the new leader hadn't received the latest writes. Use synchronous or semi-sync replication so writes are acknowledged by a replica before success.</p>}
        staff={<>
          <p>With async replication, “ack” meant “on the old leader's disk”, and the promoted follower was behind. Beyond switching to semi-sync or quorum acks:</p>
          <ul>
            <li>Failover should promote the <strong>most caught-up</strong> replica (compare log positions).</li>
            <li>The old leader must be <strong>fenced</strong> (epoch or term tokens, STONITH) so it cannot accept writes if it comes back.</li>
            <li>Downstream systems that consumed the lost writes (caches, IDs reused by auto-increment, events already published) need reconciliation.</li>
          </ul>
          <p>If this data can't tolerate loss, move it to a consensus-replicated store and accept the write latency.</p>
        </>}
      />
      <InterviewQuestion
        q="Two workers must never process the same job at once. How would you implement the distributed lock?"
        senior={<p>Use Redis <code>SET key value NX PX 30000</code> with a unique value, and release it with a Lua script that deletes only if the value matches. For stronger guarantees use ZooKeeper or etcd.</p>}
        staff={<>
          <p>A lock with a timeout is really a <strong>lease</strong>, and a lease alone is not safe. A worker can pause (GC, VM migration, network stall) past its lease, another worker acquires the lock, and the first one wakes up and writes anyway. Both think they hold the lock.</p>
          <ul>
            <li><strong>Fencing tokens</strong>: the lock service hands out a monotonically increasing number with each grant (etcd revision, ZooKeeper zxid). The storage being protected rejects any write carrying a token lower than one it has already seen. That makes the stale holder harmless.</li>
            <li><strong>Where the lock lives</strong>: for correctness I'd use a consensus-backed store (etcd, ZooKeeper, or a DB row with a version check). A single Redis node loses the lock on failover, and multi-node Redis locking still depends on timing assumptions.</li>
            <li><strong>Often you don't need a lock</strong>: make the work idempotent, or partition jobs so each has exactly one owner (a Kafka partition per consumer), and let the data model enforce exclusivity with conditional writes.</li>
          </ul>
        </>}
        followUps={['What happens if the lock holder crashes mid-job?', 'How does the protected resource check a fencing token?', 'Why is a GC pause dangerous here?']}
      />

      <KeyTakeaways items={[
        'Single-leader is simplest; multi-leader and leaderless buy availability at the cost of conflict resolution.',
        'Async replicas create read-your-writes and monotonic-read bugs. Fix with routing policies, not hope.',
        'CAP is about partitions; PACELC adds the everyday latency-versus-consistency trade-off.',
        'R + W > N gives overlapping quorums, but it is not linearizability. Know the edge cases.',
        'Raft uses terms, randomized timeouts and majority votes for safe leader election. Keep consensus on the control plane.',
        'A lock with a timeout is a lease. Fencing tokens checked by the protected resource are what make it safe.',
      ]} />
    </>
  )
}
