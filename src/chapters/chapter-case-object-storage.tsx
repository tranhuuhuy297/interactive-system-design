import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements, References, TLDR, Term,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { ObjstoreErasureCodingDemo } from './demos/objstore-erasure-coding-demo'
import { ObjstoreMultipartUploadDemo } from './demos/objstore-multipart-upload-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Client', sub: 'SDK / HTTP', kind: 'client', x: 8, y: 50 },
  { id: 'api', label: 'API service', sub: 'stateless', kind: 'lb', x: 27, y: 50,
    detail: 'Terminates TLS, authenticates the signed request (SigV4-style), enforces bucket policy, then coordinates the metadata and data planes. Holds no state, so it scales horizontally.' },
  { id: 'iam', label: 'IAM', sub: 'policies', kind: 'external', x: 27, y: 14,
    detail: 'Resolves credentials and evaluates bucket/object policies. Cache decisions briefly at the API tier, because every request needs one.' },
  { id: 'placement', label: 'Placement', sub: 'cluster map', kind: 'service', x: 50, y: 84,
    detail: 'Knows every data node, disk, rack and zone plus their health (from heartbeats). Picks which nodes receive the fragments so that no two share a failure domain. Runs as a small Raft/Paxos group.' },
  { id: 'meta', label: 'Metadata svc', sub: 'bucket/key → loc', kind: 'service', x: 52, y: 22,
    detail: 'Maps (bucket, key, version) to object ID, size, checksum and fragment locations. The data plane never answers "which objects exist"; only metadata does.' },
  { id: 'mdb', label: 'Metadata DB', sub: 'sharded, linearizable', kind: 'db', x: 80, y: 18,
    detail: 'Hundreds of billions of rows. Partition by hash(bucket, key-prefix) for writes and keep keys sorted within a partition so LIST by prefix is a range scan. Needs strong consistency for read-after-write.' },
  { id: 'data', label: 'Data nodes', sub: 'disks, EC fragments', kind: 'storage', x: 80, y: 56,
    detail: 'Store immutable fragments packed into large append-only files. Each fragment carries a checksum, and a node verifies it on every read.' },
  { id: 'gc', label: 'Scrubber / GC', kind: 'worker', x: 80, y: 88,
    detail: 'Background jobs: re-read and checksum everything periodically (scrubbing), repair lost fragments, and compact files that are full of deleted objects.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'api' }, { from: 'api', to: 'iam' }, { from: 'api', to: 'meta' }, { from: 'meta', to: 'mdb' },
  { from: 'api', to: 'placement' }, { from: 'api', to: 'data' }, { from: 'data', to: 'placement', async: true, label: 'heartbeats' },
  { from: 'gc', to: 'data', async: true },
]

const REFS: Reference[] = [
  { title: 'Polynomial Codes Over Certain Finite Fields', source: 'I. S. Reed & G. Solomon, J. SIAM', year: 1960, url: 'https://doi.org/10.1137/0108018', kind: 'paper', note: 'Reed–Solomon codes' },
  { title: 'Erasure Coding in Windows Azure Storage', source: 'C. Huang et al., USENIX ATC', year: 2012, url: 'https://www.usenix.org/conference/atc12/technical-sessions/presentation/huang', kind: 'paper', note: 'locally repairable codes' },
  { title: 'Finding a Needle in Haystack: Facebook’s Photo Storage', source: 'D. Beaver et al., OSDI', year: 2010, url: 'https://www.usenix.org/conference/osdi10/finding-needle-haystack-facebooks-photo-storage', kind: 'paper', note: 'packing small objects into large files' },
  { title: 'Amazon S3 update: strong read-after-write consistency', source: 'AWS News Blog', year: 2020, url: 'https://aws.amazon.com/blogs/aws/amazon-s3-update-strong-read-after-write-consistency/', kind: 'blog' },
  { title: 'Uploading and copying objects using multipart upload', source: 'Amazon S3 User Guide', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html', kind: 'docs' },
  { title: 'Data protection in Amazon S3 (durability)', source: 'Amazon S3 User Guide', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/DataDurability.html', kind: 'docs', note: '11 nines design target' },
  { title: 'Cloud storage durability', source: 'Backblaze blog', url: 'https://www.backblaze.com/blog/cloud-storage-durability/', kind: 'blog', note: 'how durability nines are modelled' },
  { title: 'System Design Interview – An Insider’s Guide, Volume 2', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'S3-like object storage prompt' },
]

export default function ObjectStorageChapter() {
  return (
    <>
      <TLDR items={[
        'Core problem: keep exabytes of blobs durable on disks that fail every day, cheaply.',
        'Key decision: split a metadata plane (what exists, where) from a data plane (the bytes).',
        'The hard part: durability at low cost. Erasure coding halves storage versus 3× replication but makes repair heavy.',
        'Staff insight: the metadata write is the commit point, which gives read-after-write consistency without distributed transactions.',
      ]} />
      <p>
        Object storage looks like a giant key-value store for blobs. At the API level it is:{' '}
        <code>PUT bucket/key</code>, <code>GET bucket/key</code>. The interesting engineering is underneath.
      </p>
      <p>
        You have to keep exabytes <strong>durable</strong> on hardware that fails every day. The cost per byte makes
        replication look expensive. And you still have to answer "list everything under this prefix" over billions
        of keys.
      </p>
      <p>
        The design splits cleanly into a <strong>metadata plane</strong> and a <strong>data plane</strong>. Most
        strong answers are organised around that split.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>First, pin down durability, consistency and object sizes. Each one rules out designs.</p>
      <Requirements
        functional={['Create buckets; PUT / GET / DELETE objects', 'Objects from bytes to terabytes (multipart for large)', 'LIST by prefix with pagination', 'Optional versioning and lifecycle rules']}
        nonFunctional={['Durability ≥ 11 nines for stored objects', 'Availability ~99.99% for reads', 'Strong read-after-write consistency, including overwrites and LIST', 'Low cost per GB; throughput over latency']}
        outOfScope={['POSIX semantics (rename, append, locking)', 'Query engines over objects', 'Cross-region replication (discussed at the end)']}
      />
      <Callout kind="tip">
        Ask early whether objects are <strong>immutable</strong>. They almost always are: overwrite means "new version,
        new fragments, flip a pointer". Immutability is what makes caching, erasure coding and consistency tractable.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>Next, size both planes: object count drives metadata, and bytes drive disks.</p>
      <EstimationTable
        assumptions={['100 PB logical data, 1 MB average object (heavily skewed: many tiny, a few huge)', '~1 KB metadata per object', '20 TB disks', 'Illustrative numbers for sizing only']}
        rows={[
          { label: 'Objects', math: '100 PB / 1 MB', result: '≈ 100B' },
          { label: 'Metadata', math: '100B × 1 KB', result: '≈ 100 TB' },
          { label: 'Raw, 3× replication', math: '100 PB × 3', result: '300 PB' },
          { label: 'Raw, EC 8+4', math: '100 PB × 12/8', result: '150 PB' },
          { label: 'Disks saved by EC', math: '(300 − 150) PB / 20 TB', result: '≈ 7,500 disks' },
          { label: 'Daily disk failures', math: '7,500 disks × 2% AFR / 365', result: '≈ 0.4/day' },
        ]}
      />
      <p>Two conclusions follow from the table.</p>
      <p>
        First, metadata is a <strong>100 TB sharded database</strong> problem in its own right, not a side table.
      </p>
      <p>
        Second, the data plane's biggest lever is the storage scheme.{' '}
        <Term def="Split data into k pieces and add m parity pieces; any k of the k+m pieces can rebuild the original.">Erasure coding</Term>{' '}
        halves raw capacity compared with triple replication. And disks fail continuously (see{' '}
        <Term def="Annualized failure rate: the share of disks expected to fail in a year.">AFR</Term>), so repair
        is a permanent background workload.
      </p>

      <H2 id="api">3 · API</H2>
      <p>The API is small and S3-shaped: put, get, delete, list, plus multipart for large files.</p>
      <ApiSpec endpoints={[
        { method: 'PUT', path: '/{bucket}/{key}', desc: 'Upload an object in one request (practical up to a few GB).', body: 'bytes + Content-MD5 / checksum header', returns: '200 { ETag, versionId? }' },
        { method: 'GET', path: '/{bucket}/{key}', desc: 'Read an object; supports Range for partial reads.', returns: '200 bytes · 206 partial · 404' },
        { method: 'DELETE', path: '/{bucket}/{key}', desc: 'Delete; with versioning this writes a delete marker instead.', returns: '204' },
        { method: 'GET', path: '/{bucket}?prefix=&continuation-token=', desc: 'List keys under a prefix in lexicographic order, paginated.', returns: '{ keys[], nextToken }' },
        { method: 'POST', path: '/{bucket}/{key}?uploads', desc: 'Start a multipart upload; then PUT parts, then complete.', returns: '{ uploadId }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>Now connect the pieces. Trace a PUT, a GET and a repair through both planes.</p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Metadata plane (top) and data plane (bottom) scale and fail independently"
        flows={[
          { name: 'PUT object', path: ['client', 'api', 'placement', 'api', 'data', 'api', 'meta', 'mdb'],
            steps: ['Signed PUT arrives', 'Ask placement for k+m nodes in distinct failure domains', 'Placement returns the node set', 'Stream bytes; encode into fragments and write them in parallel', 'Enough fragments acknowledged durably', 'Commit metadata: key → object ID, fragment locations, checksum', 'Commit point: after this row is written, readers see the new version'] },
          { name: 'GET object', path: ['client', 'api', 'meta', 'mdb', 'meta', 'api', 'data'],
            steps: ['GET arrives', 'Resolve bucket/key to the latest version', 'Read metadata row (strongly consistent)', 'Return fragment locations', 'Back to API', 'Fetch any k fragments (or a range), verify checksums, decode'] },
          { name: 'Repair', path: ['gc', 'data', 'placement'],
            steps: ['Scrubber finds a missing or corrupt fragment', 'Report the failure and ask placement for a new home, then rebuild from k survivors'] },
        ]} />
      <Callout kind="info">
        The <strong>commit point is the metadata write</strong>. Data is written first under a fresh object ID that
        nobody references yet. If the PUT dies halfway, the result is orphaned fragments that GC removes later, never a
        half-visible object. This is also how you get read-after-write consistency without distributed transactions.
      </Callout>

      <H2 id="durability">5 · Deep dive: replication vs erasure coding</H2>
      <p>
        Here we decide how bytes survive disk failures. With <strong>Reed–Solomon (k, m)</strong>, an object is split
        into k data fragments, and m parity fragments are computed. <em>Any</em> k of the k+m fragments can rebuild it.
      </p>
      <p>
        RS(8,4) stores 1.5× the data and survives any 4 failures. Triple replication stores 3× and survives only 2.
        Fail some nodes in the demo.
      </p>
      <ObjstoreErasureCodingDemo />
      <CompareTable
        columns={['3× replication', 'Erasure coding (8+4)']}
        rows={[
          { label: 'Storage overhead', cells: ['3.0×', '1.5×'] },
          { label: 'Failures tolerated', cells: ['2', '4'] },
          { label: 'Read path', cells: ['Read 1 copy, cheap', 'Read k fragments and decode (a range read may touch fewer)'] },
          { label: 'Repair cost', cells: ['Copy 1 object', 'Read k fragments to rebuild 1: heavy network use'] },
          { label: 'Small objects', cells: ['Fine', 'Wasteful: pack them into large files first'] },
          { label: 'Typical use', cells: ['Hot data, metadata, tiny objects', 'Bulk warm/cold data'] },
        ]}
      />
      <Callout kind="warn">
        Durability numbers such as "11 nines" come from models like the one above. They are only as good as the
        <strong> independence assumption</strong>. Correlated failures (a rack losing power, a bad firmware batch, a
        buggy deploy that deletes data) dominate in practice. That is why fragment placement across failure domains,
        staged deploys and delete protection matter as much as the coding scheme.
      </Callout>

      <H2 id="data-layout">6 · Deep dive: on-disk layout, integrity and GC</H2>
      <p>
        Next, how fragments sit on disk. Storing each object as its own file does not scale to billions of small
        objects: file-system bookkeeping and disk seeks dominate.
      </p>
      <p>
        Data nodes instead <strong>append</strong> fragments into large (for example 1–10 GB) files and record{' '}
        <code>(file, offset, length)</code>. Deletes only drop the metadata reference.
      </p>
      <p>
        A{' '}
        <Term def="A background job that rewrites mostly-dead files into new ones and frees the space.">compactor</Term>{' '}
        later rewrites files whose live ratio has fallen below a threshold.
      </p>
      <CodeBlock lang="ts" title="fragment record in an append-only data file" code={`
type FragmentHeader = {
  objectId: string      // immutable ID, never the user-visible key
  fragmentIndex: number // 0..k+m-1
  length: number
  crc32c: number        // verified on every read and by the scrubber
}
// data file: [header][bytes][header][bytes]...  sealed when it reaches ~4 GB
// index:     objectId#fragmentIndex -> { fileId, offset }`} />
      <ul>
        <li><strong>Checksums end to end</strong>: client-supplied hash → verified at the API → stored per fragment → re-verified on read. Silent bit rot is detected and repaired rather than served.</li>
        <li><strong><Term def="Periodically reading all stored data and verifying checksums, to find silent corruption early.">Scrubbing</Term></strong> re-reads cold data on a schedule, because a latent sector error is only found when someone reads the sector.</li>
        <li><strong><Term def="Garbage collection: deleting fragments that no metadata row points to any more.">GC</Term> is dangerous</strong>: only delete fragments that no metadata version references, after a grace period. A bug here is a data-loss incident.</li>
      </ul>

      <H2 id="multipart">7 · Deep dive: multipart upload</H2>
      <p>
        Now, how a 50 GB file gets in reliably. Large objects are uploaded as independent parts (for example 8–100 MB
        each). Parts can be sent in parallel and retried individually.
      </p>
      <ObjstoreMultipartUploadDemo />
      <p>
        <code>CompleteMultipartUpload</code> atomically records the ordered part list as one object. Parts that are
        never completed still use disk, so lifecycle rules should abort stale uploads.
      </p>

      <H2 id="listing">8 · Deep dive: metadata, listing and consistency</H2>
      <p>Last, how to partition metadata so both GET and LIST stay fast and consistent. Here is the row we store per object version:</p>
      <CodeBlock lang="ts" title="metadata row (sharded store, sorted by key within shard)" code={`
type ObjectVersion = {
  bucket: string
  key: string          // sorted → LIST prefix = range scan
  versionId: string    // time-ordered, newest first
  objectId: string     // points at fragments
  size: number
  etag: string
  isDeleteMarker: boolean
  placement: { scheme: 'rs-8-4' | 'rep-3'; nodes: string[] }
}`} />
      <p>
        Hash-partitioning by full key spreads load but breaks prefix LIST, which must then{' '}
        <Term def="Send the query to every shard, then merge the partial results.">scatter-gather</Term>.
      </p>
      <p>
        Range partitioning by <code>(bucket, key)</code> keeps LIST cheap. But it creates hot shards for sequential
        key names (timestamps, auto-increment IDs).
      </p>
      <p>
        Common answers are range partitioning with <strong>automatic splitting</strong> of hot ranges, plus guidance
        or hashing of key prefixes for write-heavy buckets.
      </p>
      <p>
        Strong read-after-write comes from making the metadata store{' '}
        <Term def="Every read sees the latest completed write, as if there were a single copy.">linearizable</Term>{' '}
        per key (for example Paxos/Raft per shard). Then a successful PUT is immediately visible to GET and LIST.
      </p>

      <H2 id="staff">9 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Tiering</strong>: hot objects in replicated flash, warm in EC on HDD, cold in denser EC or archival media. A lifecycle engine moves them, and moving means re-encoding, a large background I/O cost.</li>
          <li><strong>Repair bandwidth budget</strong>: after losing a 20 TB disk under EC, you must read about k× that from survivors. Throttle repair so it doesn't hurt foreground traffic, but not so much that the vulnerability window grows. Locally repairable codes (LRC) cut repair reads.</li>
          <li><strong>Blast radius</strong>: cell-based architecture, where each cell is a full independent stack serving a subset of buckets, bounds the damage of a bad deploy or metadata corruption.</li>
          <li><strong>Cross-region replication</strong> is asynchronous by object version. Surface replication lag as a metric and be explicit that RPO &gt; 0.</li>
          <li><strong>Cost model</strong>: charge for requests as well as bytes, because tiny-object workloads are request-bound, not capacity-bound.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How do you guarantee a GET right after a successful PUT returns the new data, even for overwrites?"
        senior={<p>Write to a strongly consistent metadata store and only return 200 after the metadata is committed. Reads always go through metadata to find the latest version.</p>}
        staff={<>
          <p>Treat each PUT as <strong>write data under a new immutable object ID, then atomically swap the key's pointer</strong> in a linearizable metadata shard. The pointer swap is the single commit point, so readers see either the old version or the new one, never a mix.</p>
          <p>The details that matter: metadata caches at the API tier must be invalidated or versioned (or you break the guarantee).</p>
          <p>LIST must read from the same linearizable index, not a lagging secondary. The replaced version's fragments go to GC only after a grace period, so in-flight readers of the old version still succeed.</p>
        </>}
        followUps={['What happens to a reader mid-download when the object is overwritten?', 'How does versioning change deletes?', 'How do you keep LIST consistent under concurrent writes?']}
      />
      <InterviewQuestion
        q="Why not just use 3× replication everywhere? It's simpler."
        senior={<p>Erasure coding uses half the storage for better fault tolerance. At petabyte scale that's a big cost saving.</p>}
        staff={<>
          <p>At 100 PB, the difference between 3× and 1.5× is about 150 PB of disks, plus power and racks. It is often the single largest cost line. But EC isn't free:</p>
          <ul>
            <li>Degraded reads and repair need k fragments, which multiplies network traffic.</li>
            <li>Small objects are inefficient unless packed.</li>
            <li>Encoding costs CPU on the write path.</li>
          </ul>
          <p>So I'd use a <strong>hybrid</strong>: replicate new and small objects for fast writes, then asynchronously re-encode them into EC once they're cold or batched into large files.</p>
          <p>I'd choose k and m from the failure-domain count: 12 fragments need at least 12 independent domains, or you're overstating durability.</p>
        </>}
        followUps={['How would you size repair bandwidth?', 'What are locally repairable codes and when do they help?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Split the system into a metadata plane (what exists, where) and a data plane (bytes on disks); they scale and fail independently.',
        'Objects are immutable: write fragments first, commit by atomically updating metadata. That gives read-after-write consistency.',
        'Erasure coding (k+m) cuts raw storage roughly in half compared with 3× replication, at the cost of repair traffic and small-object overhead.',
        'Durability math assumes independent failures, so spread fragments across failure domains and treat correlated failures as the real risk.',
        'Pack small objects into large append-only files; checksum everything; scrub, repair and GC continuously but carefully.',
      ]} />
    </>
  )
}
