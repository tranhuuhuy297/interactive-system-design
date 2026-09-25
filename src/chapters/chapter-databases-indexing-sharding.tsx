import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, References, TLDR, Tabs, Term,
} from '../components/ui'
import type { Reference } from '../components/ui'
import { DbIsolationAnomaliesDemo } from './demos/db-isolation-anomalies-demo'
import { DbLsmTreeVisualizerDemo } from './demos/db-lsm-tree-visualizer-demo'
import { DbShardingSimulatorDemo } from './demos/db-sharding-simulator-demo'

const REFS: Reference[] = [
  { title: "The Log-Structured Merge-Tree (LSM-Tree)", source: "O’Neil et al., Acta Informatica", year: 1996, url: "https://www.cs.umb.edu/~poneil/lsmtree.pdf", kind: "paper" },
  { title: "Bigtable: A Distributed Storage System for Structured Data", source: "Chang et al., OSDI", year: 2006, url: "https://static.googleusercontent.com/media/research.google.com/en//archive/bigtable-osdi06.pdf", kind: "paper", note: "Range partitioning and SSTables" },
  { title: "A Critique of ANSI SQL Isolation Levels", source: "Berenson et al., SIGMOD", year: 1995, url: "https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/", kind: "paper" },
  { title: "Transaction Isolation", source: "PostgreSQL documentation", url: "https://www.postgresql.org/docs/current/transaction-iso.html", kind: "docs" },
  { title: "Index Types", source: "PostgreSQL documentation", url: "https://www.postgresql.org/docs/current/indexes-types.html", kind: "docs" },
  { title: "Leveled Compaction", source: "RocksDB wiki", url: "https://github.com/facebook/rocksdb/wiki/Leveled-Compaction", kind: "docs" },
  { title: "Cassandra: A Decentralized Structured Storage System", source: "A. Lakshman & P. Malik, LADIS", year: 2009, url: "https://www.cs.cornell.edu/projects/ladis2009/papers/lakshman-ladis2009.pdf", kind: "paper" },
  { title: "Dynamo: Amazon’s Highly Available Key-value Store", source: "DeCandia et al., SOSP", year: 2007, url: "https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf", kind: "paper" },
  { title: "Designing Data-Intensive Applications", source: "Martin Kleppmann (O’Reilly)", year: 2017, url: "https://dataintensive.net/", kind: "book" },
]

export default function DatabasesChapter() {
  return (
    <>
      <p>
        “SQL or NoSQL?” is the wrong first question. Start from the <strong>access patterns</strong>: which queries
        run, how often, and with what consistency and latency needs.
      </p>
      <TLDR items={[
        'Choose a database from your queries and their rates, not from a favourite technology.',
        'Most databases run below full isolation by default, so some race conditions slip through.',
        'B-trees favour reads; LSM trees favour heavy writes.',
        'Tune, cache, and add replicas before you shard. Sharding is hard to undo.',
        'The shard key should keep your most common queries on one machine.',
      ]} />
      <p>
        The storage engine, data model, and partitioning scheme all follow from those. Interviewers want to hear you
        reason from workload to choice.
      </p>

      <H2 id="families">Database families</H2>
      <p>Each family is shaped around one kind of query. Match the family to your dominant access pattern.</p>
      <CompareTable
        columns={['Model', 'Strong at', 'Weak at', 'Examples']}
        rows={[
          { label: 'Relational', cells: ['Tables + joins + ACID', 'Complex queries, integrity, transactions', 'Horizontal write scaling (without extra machinery)', 'PostgreSQL, MySQL, Spanner, CockroachDB'] },
          { label: 'Key-value', cells: ['get/put by key', 'Massive scale, predictable latency', 'Queries not by key', 'DynamoDB, Redis, RocksDB'] },
          { label: 'Document', cells: ['Nested JSON docs', 'Flexible schema, aggregate-shaped reads', 'Many-to-many relations, cross-doc transactions', 'MongoDB, Couchbase, Firestore'] },
          { label: 'Wide-column', cells: ['Partition key + sorted clustering key', 'Write-heavy, time-ordered data at scale', 'Ad-hoc queries; design tables per query', 'Cassandra, ScyllaDB, Bigtable, HBase'] },
          { label: 'Graph', cells: ['Nodes + edges', 'Multi-hop traversals', 'Sharding, bulk analytics', 'Neo4j, Neptune'] },
          { label: 'Time-series', cells: ['Append-mostly timestamped points', 'Compression, downsampling, range scans', 'Updates, high-cardinality labels', 'Prometheus, InfluxDB, TimescaleDB'] },
          { label: 'Search', cells: ['Inverted index', 'Full-text, faceting, relevance', 'Being the source of truth', 'Elasticsearch, OpenSearch'] },
        ]}
      />
      <Callout kind="tip">
        A good default: <strong>start relational</strong> unless you can name the specific scale or access-pattern
        reason not to. Modern PostgreSQL on one big node handles more than most interview prompts need. Say when
        you would outgrow it and how you would know.
      </Callout>

      <H2 id="acid">ACID, BASE & isolation</H2>
      <p>
        <Term def="Atomicity, Consistency, Isolation, Durability: the guarantees a database transaction gives.">ACID</Term>’s
        “I” (isolation) is where the subtlety lives. Most databases do not default to{' '}
        <Term def="The strictest isolation level: transactions behave as if they ran one at a time.">serializable</Term>.
        Real apps run at weaker levels and get anomalies that are easy to miss in code review.
      </p>
      <DbIsolationAnomaliesDemo />
      <p>
        <strong>BASE</strong> (basically available, soft state, eventually consistent) describes many NoSQL systems.
        They give up cross-item transactions and immediate consistency in exchange for availability and scale.
      </p>
      <p>
        The line is blurring. DynamoDB, MongoDB, and Cassandra (lightweight transactions) all offer some
        transactional features now. NewSQL systems give serializable transactions across shards.
      </p>

      <H2 id="indexing">Storage engines: B-tree vs LSM</H2>
      <p>
        The storage engine decides how data sits on disk. That sets the cost of reads versus writes. An{' '}
        <Term def="Log-structured merge tree: buffers writes in memory, flushes them as sorted files, and merges those files in the background.">LSM tree</Term>{' '}
        trades read work for fast writes.
      </p>
      <CompareTable
        columns={['B-tree', 'LSM tree']}
        rows={[
          { label: 'Write path', cells: ['Update the page in place (+ WAL)', 'Append to memtable (+ WAL); flush sorted SSTables'] },
          { label: 'Read path', cells: ['O(log n) page lookups, predictable', 'Check memtable + several SSTables (bloom filters help)'] },
          { label: 'Write amplification', cells: ['Page rewrites for small updates', 'Compaction rewrites data repeatedly'] },
          { label: 'Space', cells: ['Fragmentation in pages', 'Obsolete versions until compaction'] },
          { label: 'Best for', cells: ['Read-heavy, OLTP, range scans', 'Write-heavy ingestion, time-series, KV'] },
          { label: 'Used by', cells: ['PostgreSQL, MySQL InnoDB, SQL Server', 'RocksDB, Cassandra, ScyllaDB, LevelDB'] },
        ]}
      />
      <DbLsmTreeVisualizerDemo />
      <Tabs items={[
        { label: 'Index types', content: <ul>
          <li><strong>Primary / clustered</strong>: rows stored in key order, so range scans are cheap.</li>
          <li><strong>Secondary</strong>: a separate structure pointing to rows. Every write updates every index.</li>
          <li><strong>Composite</strong> <code>(user_id, created_at)</code>: left-prefix rule. It serves “by user, newest first” queries without a sort.</li>
          <li><strong>Covering</strong>: includes the queried columns so the table is never touched.</li>
          <li><strong>Specialised</strong>: inverted (full-text), GiST/R-tree (geo), bitmap (low cardinality, analytics).</li>
        </ul> },
        { label: 'Secondary indexes when sharded', content: <ul>
          <li><strong>Local (document-partitioned)</strong>: each shard indexes its own rows. Writes are cheap; reads by the indexed field scatter-gather across all shards.</li>
          <li><strong>Global (term-partitioned)</strong>: the index is partitioned by the indexed value. Reads are targeted; writes touch another shard and are usually updated asynchronously (DynamoDB GSIs are eventually consistent).</li>
        </ul> },
      ]} />

      <H2 id="replication-scaling">Scaling reads before sharding</H2>
      <p>Most databases hit a read ceiling long before a write ceiling. These cheaper steps usually come first.</p>
      <FlowDiagram steps={[
        { label: 'Tune', sub: 'indexes, queries, pooling' },
        { label: 'Scale up', sub: 'bigger box, NVMe' },
        { label: 'Cache', sub: 'hot reads to Redis' },
        { label: 'Read replicas', sub: 'async, mind the lag' },
        { label: 'Split by domain', sub: 'separate DBs per service' },
        { label: 'Shard', sub: 'last resort, highest cost' },
      ]} caption="Sharding is a one-way door. Exhaust the cheaper steps first and say so in the interview" />

      <H2 id="sharding">Partitioning (sharding)</H2>
      <p>
        Sharding splits data across machines so writes and storage scale horizontally. The{' '}
        <Term def="The field used to decide which shard a row lives on, such as user_id.">shard key</Term>{' '}
        decides everything: whether load is even, which queries stay on one shard, and how painful growth will be.
      </p>
      <DbShardingSimulatorDemo />
      <CompareTable
        columns={['Range', 'Hash', 'Directory / lookup']}
        rows={[
          { label: 'How', cells: ['Contiguous key ranges per shard', 'hash(key) → shard (mod N or ring)', 'A mapping service says where each key lives'] },
          { label: 'Range queries', cells: ['Efficient', 'Scatter-gather', 'Depends on mapping'] },
          { label: 'Hot spots', cells: ['Monotonic keys (timestamps, auto-inc)', 'Only single hot keys', 'Can move hot tenants individually'] },
          { label: 'Rebalancing', cells: ['Split or merge ranges (HBase, Spanner)', 'Consistent hashing / fixed partition count', 'Update the mapping and move data'] },
          { label: 'Example', cells: ['Bigtable, HBase, CockroachDB', 'Cassandra, DynamoDB', 'Multi-tenant SaaS, Vitess keyspace IDs'] },
        ]}
      />
      <Callout kind="tip">
        A trick worth naming: create <strong>many more logical partitions than machines</strong> (say, 1,024) and
        assign them to nodes. Growing means moving whole partitions and never re-hashing keys. Elasticsearch,
        Kafka, Couchbase and Riak-style systems all do some version of this.
      </Callout>

      <H2 id="cross-shard">Life after sharding</H2>
      <p>Sharding solves scale but takes away features you took for granted on one machine.</p>
      <ul>
        <li><strong>Cross-shard joins</strong> disappear. Denormalise, co-locate related data on the same shard key (all of a user's rows under <code>user_id</code>), or join in the application.</li>
        <li><strong>Cross-shard transactions</strong> need <Term def="Two-phase commit: a coordinator asks every shard to prepare, then tells all of them to commit or abort.">2PC</Term> or sagas. Design the shard key so most transactions stay single-shard.</li>
        <li><strong>Global uniqueness and auto-increment</strong> break. Use distributed IDs (see the Unique IDs chapter).</li>
        <li><strong>Resharding</strong> is an online migration: dual writes or CDC backfill, verification, cutover, cleanup. Budget weeks, not hours.</li>
        <li><strong>Hot tenants</strong>: one big customer can outgrow a shard. Plan to give them a dedicated shard (directory-based placement).</li>
      </ul>
      <CodeBlock lang="ts" title="co-location keeps the hot path single-shard" code={`
// Shard key = user_id → a user's profile, posts and settings share a shard.
// "Load my home screen" = 1 shard, 1 round trip.
// "Posts liked by users in Berlin" = scatter-gather → serve from an analytics store instead.
const shard = shardFor(userId)
await shard.tx(async (tx) => {
  await tx.insert('posts', { userId, postId, body })
  await tx.update('user_stats', { userId }, { postCount: sql\`post_count + 1\` })
})`} />

      <H2 id="staff">Staff-level lens</H2>
      <p>Staff answers treat the database as a long-lived operational commitment, not just a schema.</p>
      <Callout kind="staff">
        <ul>
          <li><strong>Choose the shard key from the top 3 queries</strong> and say which query you are deliberately making expensive.</li>
          <li><strong>Separate OLTP from analytics.</strong> Stream changes by CDC into a warehouse or search index instead of running analytical queries against shards.</li>
          <li><strong>Operational reality</strong>: backups and restores per shard, schema migrations across N shards (online DDL tools such as gh-ost or pg_repack), and noisy neighbours.</li>
          <li><strong>Buy vs build</strong>: Vitess, Citus, or a distributed SQL database (Spanner, CockroachDB, Yugabyte) may beat a home-grown sharding layer. Know the latency and cost trade-offs of consensus-replicated writes.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How would you choose a shard key for a messaging app's messages table?"
        senior={<p>Shard by conversation_id so every message in a conversation is on one shard, clustered by message timestamp for efficient pagination. Avoid sharding by timestamp, which creates a hot shard.</p>}
        staff={<>
          <p>Start from the queries: (1) fetch the latest N messages in a conversation, (2) append a message, (3) list a user's conversations. <code>conversation_id</code> as the partition key with <code>(created_at, message_id)</code> clustering serves 1 and 2 on a single shard. 3 needs a separate <code>user_conversations</code> table keyed by <code>user_id</code>. That denormalisation is deliberate.</p>
          <p>Risks: a huge group chat becomes a hot or oversized partition, so bucket it (<code>conversation_id + month</code>). Global search across messages goes to a separate search index fed by CDC. I'd use many logical partitions over fewer nodes so growth only moves partitions.</p>
        </>}
        followUps={['How do you paginate efficiently?', 'What if one conversation has 100M messages?', 'How do you delete a user’s data (GDPR) across shards?']}
      />
      <InterviewQuestion
        q="Two doctors both went off call at the same time and the hospital ended up with nobody on call, even though the app checks. Why, and how do you fix it?"
        senior={<p>A race condition: both transactions read that two doctors were on call, then each updated their own row. Use SELECT … FOR UPDATE or serializable isolation.</p>}
        staff={<>
          <p>That's <strong>write skew</strong>. Both transactions read the same predicate, then wrote <em>different</em> rows, so neither row-level conflict detection nor snapshot isolation catches it. Fixes, by preference:</p>
          <ul>
            <li>Run that transaction at SERIALIZABLE (PostgreSQL SSI aborts one; add a retry).</li>
            <li>Lock the rows the invariant depends on (<code>SELECT … FOR UPDATE</code> on all on-call rows for the shift).</li>
            <li>Materialise the conflict: a <code>shift</code> row both transactions must update.</li>
          </ul>
          <p>I'd also add an invariant check or constraint where the database supports it, and an alert, because this class of bug is invisible in unit tests.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Pick storage from access patterns: queries, rates, consistency, latency.',
        'Most databases default to weaker isolation than serializable. Know the anomalies, especially lost updates and write skew.',
        'B-trees favour reads and predictable latency; LSM trees favour write throughput at the cost of compaction and read amplification.',
        'Exhaust tuning, caching, replicas and functional splits before sharding. It is a one-way door.',
        'The shard key follows the top queries. Plan for hot keys, cross-shard queries, and online resharding.',
      ]} />
    </>
  )
}
