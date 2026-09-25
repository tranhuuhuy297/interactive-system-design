import {
  Callout, CodeBlock, CompareTable, H2, InterviewQuestion, KeyTakeaways, Requirements,
} from '../components/ui'
import { UidSnowflakeBuilderDemo } from './demos/uid-snowflake-builder-demo'
import { UidUuidLocalityDemo } from './demos/uid-uuid-locality-demo'

export default function UniqueIdGenerationChapter() {
  return (
    <>
      <p>
        On one database, <code>AUTO_INCREMENT</code> solves ID generation for free. Once you shard, or write in
        several regions, you need IDs that are unique <strong>without asking a central authority on every
        write</strong>. The right answer depends on three things the interviewer might not say out loud: must IDs
        <strong> sort by time</strong>, must they fit in <strong>64 bits</strong>, and may they be
        <strong> guessable</strong>?
      </p>

      <H2 id="requirements">Pin down the requirements</H2>
      <Requirements
        functional={['Globally unique across all nodes', 'Roughly time-ordered (newer sorts later)', 'Numeric, 64-bit (fits BIGINT columns and JS-safe as strings)']}
        nonFunctional={['10K+ IDs/s per node', 'No coordination on the hot path', 'Available even if one component is down']}
        outOfScope={['Strictly gap-free sequences (invoice numbers need a different design)']}
      />
      <Callout kind="tip">
        “Roughly ordered” and “strictly ordered” are very different. Strict global order across nodes needs
        coordination, which means a single sequencer or a consensus log. Almost every product only needs <em>k-sorted</em> IDs:
        ordered to within a few milliseconds.
      </Callout>

      <H2 id="options">The option space</H2>
      <CompareTable
        columns={['Size', 'Sortable', 'Coordination', 'Watch out for']}
        rows={[
          { label: 'Auto-increment, multi-primary (step = N)', cells: ['64-bit', 'Per-server only', 'Config only', 'Hard to add servers. IDs across servers interleave, so there is no global order'] },
          { label: 'UUIDv4', cells: ['128-bit', 'No', 'None', 'Random B-tree inserts; large keys; not human-friendly'] },
          { label: 'UUIDv7 / ULID', cells: ['128-bit', 'Yes (ms)', 'None', 'Twice the size of 64-bit; exposes creation time'] },
          { label: 'Ticket server', cells: ['64-bit', 'Yes', 'Every call (or batch)', 'A single point of failure unless you run two with odd/even IDs'] },
          { label: 'Range leasing', cells: ['64-bit', 'Roughly', 'Once per block', 'Gaps when a node dies. Order is only per block'] },
          { label: 'Snowflake', cells: ['64-bit', 'Yes (ms)', 'Assign worker IDs once', 'Clock skew and clocks going backwards; managing worker IDs'] },
        ]}
      />

      <H2 id="snowflake">Snowflake: spending 63 bits</H2>
      <p>
        Twitter's Snowflake layout packs a millisecond timestamp, a worker ID and a per-millisecond sequence into a
        signed 64-bit integer. The classic split is <strong>41 / 10 / 12</strong>: about 69 years of timestamps from a custom
        epoch, 1,024 workers (often split into 5 datacenter bits and 5 machine bits), and 4,096 IDs per
        millisecond per worker. Every allocation is a trade-off between lifetime, fleet size and burst throughput.
      </p>
      <UidSnowflakeBuilderDemo />
      <CodeBlock lang="ts" title="snowflake.ts — core loop" code={`
const EPOCH = 1577836800000n // 2020-01-01, a custom epoch buys decades
let lastTs = -1n
let seq = 0n

export function nextId(workerId: bigint): bigint {
  let ts = BigInt(Date.now()) - EPOCH
  if (ts < lastTs) throw new Error('clock moved backwards; refusing to issue')
  if (ts === lastTs) {
    seq = (seq + 1n) & 0xfffn           // 12 bits
    if (seq === 0n) ts = waitNextMs(lastTs) // sequence exhausted this ms
  } else {
    seq = 0n
  }
  lastTs = ts
  return (ts << 22n) | (workerId << 12n) | seq
}`} />

      <H2 id="clocks">Clocks: the real failure mode</H2>
      <ul>
        <li><strong>Clock moving backwards</strong> (an NTP step or a VM migration) can reissue old timestamps, which means duplicate IDs. Refuse to issue until time catches up, or, if the jump is small, keep using the last timestamp and increment the sequence.</li>
        <li><strong>Skew between nodes</strong> only affects ordering, not uniqueness, because worker IDs differ. IDs are sortable to within the skew, which is what “k-sorted” means.</li>
        <li><strong>Worker ID assignment</strong> must be unique and survive restarts. Use a ZooKeeper/etcd lease, a Kubernetes StatefulSet ordinal, or a DB row claimed at boot. Two nodes sharing a worker ID can produce duplicates silently.</li>
        <li><strong>Persist the last timestamp</strong> on shutdown, or sleep for about the maximum NTP step at boot, so a node that restarts with a slow clock doesn't reuse a range.</li>
      </ul>

      <H2 id="uuids">UUIDs and index locality</H2>
      <p>
        UUIDv4 is 122 random bits: no coordination and effectively no collisions, but <strong>terrible for
        clustered B-tree indexes</strong> such as InnoDB primary keys or Postgres btree indexes. UUIDv7 (RFC 9562, 2024) keeps the
        128-bit format but puts a 48-bit Unix-ms timestamp first, so new keys append at the right edge of the index.
      </p>
      <p>
        Within one millisecond, plain v7 is random, so two IDs from the same ms can sort either way. RFC 9562 allows
        using some of the random bits as a counter (or sub-millisecond precision) when a generator needs strict
        monotonicity. Support is increasingly native. PostgreSQL 18, for example, ships a built-in <code>uuidv7()</code>,
        so you often need no library at all.
      </p>
      <UidUuidLocalityDemo />
      <Callout kind="warn">
        Time-ordered IDs leak information: creation time, and with a counter, volume. If IDs appear in public URLs and
        that matters (competitors counting your orders), expose a separate opaque ID or encrypt the internal one.
      </Callout>

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Decide by consumer, not generator.</strong> JavaScript clients lose precision above 2⁵³, so serialize 64-bit IDs as strings in JSON APIs. That is a real bug in many Snowflake rollouts.</li>
          <li><strong>Hot partitions</strong>: time-ordered IDs used as a <em>partition key</em> send every new write to the same shard. Sort by time <em>within</em> a partition, but partition by something else, or prefix with a hash.</li>
          <li><strong>Operational ownership</strong>: Snowflake-style services need worker-ID leasing, clock monitoring and alerting on sequence exhaustion. UUIDv7 needs none of this. At many companies, 16 bytes of storage is cheaper than running another service.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Design a unique ID generator for a sharded system producing 1M IDs/s. IDs must be 64-bit and time-sortable."
        senior={<p>Use Snowflake: 41-bit timestamp, 10-bit worker ID, 12-bit sequence. Each node generates locally, so there is no coordination. 4,096 per ms per node covers 1M/s with only a handful of nodes.</p>}
        staff={<>
          <p>Snowflake, with explicit decisions on the edges:</p>
          <ul>
            <li>Worker IDs come from etcd leases with a TTL, and a node stops issuing if it loses its lease. That prevents the silent-duplicate case.</li>
            <li>For small clock regressions, wait up to about 10 ms. For larger ones, fail health checks and page someone.</li>
            <li>Run it as a library, not a network service, so there is no extra hop or availability dependency.</li>
            <li>Serialize IDs as strings over JSON.</li>
          </ul>
          <p>I'd check whether 128 bits is really ruled out. If it isn't, UUIDv7 removes all of that machinery.</p>
        </>}
        followUps={['What happens if two nodes get the same worker ID?', 'How do you migrate from auto-increment to Snowflake with live traffic?', 'How many years does your epoch last?']}
      />
      <InterviewQuestion
        q="Why is UUIDv4 a bad primary key in MySQL, and what would you use instead?"
        senior={<p>InnoDB clusters rows by primary key, so random UUIDs insert all over the B-tree. That causes page splits, fragmentation and poor cache use. Use auto-increment or a time-ordered ID.</p>}
        staff={<>
          <p>Right, and secondary indexes in InnoDB store the primary key, so a 16-byte random key also makes <em>every</em> secondary index larger. Options by constraint:</p>
          <ul>
            <li>UUIDv7 if you need global uniqueness without coordination. It is still 16 bytes, but inserts append.</li>
            <li>A 64-bit Snowflake ID if storage and index size matter.</li>
            <li>A BIGINT surrogate key plus a separate unique UUID column for external exposure, if you are stuck with v4 externally.</li>
          </ul>
        </>}
      />

      <KeyTakeaways items={[
        'Ask three questions: sortable? 64-bit? guessable? The answers pick the scheme.',
        'Snowflake = timestamp | worker | sequence. Bit allocation trades lifetime, fleet size and burst rate.',
        'Clocks and worker-ID uniqueness are the real risks. Uniqueness does not depend on synchronized clocks, but ordering does.',
        'UUIDv7/ULID give time-ordered inserts with zero coordination at 128 bits.',
        'Serialize 64-bit IDs as strings for JavaScript clients, and don’t partition on a monotonic key.',
      ]} />
    </>
  )
}
