import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, FlowDiagram, H2,
  InterviewQuestion, KeyTakeaways, LayerStack, MentalModel, References, Requirements, StatRow, Term, TLDR,
} from '../components/ui'
import { BookOpen, Boxes, File, FolderTree, GitCompare, History, PenLine, RefreshCw, ScrollText } from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { FilesyncChunkingDemo } from './demos/filesync-chunking-demo'
import { FilesyncConflictDemo } from './demos/filesync-conflict-demo'

const REFS: Reference[] = [
  { title: 'A Low-bandwidth Network File System', source: 'A. Muthitacharoen, B. Chen, D. Mazières (SOSP)', year: 2001, url: 'https://pdos.csail.mit.edu/papers/lbfs:sosp01/lbfs.pdf', kind: 'paper', note: 'content-defined chunking with Rabin fingerprints' },
  { title: 'FastCDC: a Fast and Efficient Content-Defined Chunking Approach for Data Deduplication', source: 'W. Xia et al. (USENIX ATC)', year: 2016, url: 'https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia', kind: 'paper' },
  { title: 'The rsync algorithm (technical report)', source: 'A. Tridgell & P. Mackerras', year: 1996, url: 'https://rsync.samba.org/tech_report/', kind: 'paper', note: 'rolling-checksum delta transfer' },
  { title: 'Streaming File Synchronization', source: 'Nipunn Koorapati, Dropbox Tech', year: 2014, url: 'https://dropbox.tech/infrastructure/streaming-file-synchronization', kind: 'blog', note: 'files split into 4 MB blocks' },
  { title: 'Rewriting the heart of our sync engine', source: 'Dropbox Tech', year: 2020, url: 'https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine', kind: 'blog', note: 'client correctness and testing' },
  { title: 'Inside the Magic Pocket', source: 'Dropbox Tech', year: 2016, url: 'https://dropbox.tech/infrastructure/inside-the-magic-pocket', kind: 'blog', note: 'block storage at exabyte scale with erasure coding' },
  { title: 'Side Channels in Cloud Services: Deduplication in Cloud Storage', source: 'D. Harnik, B. Pinkas, A. Shulman-Peleg (IEEE Security & Privacy)', year: 2010, url: 'https://doi.org/10.1109/MSP.2010.187', kind: 'paper', note: 'cross-user dedup leaks information' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 1 (ch. “Design Google Drive”)', source: 'Alex Xu', year: 2020, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'a', label: 'Device A', sub: 'sync client', kind: 'client', x: 10, y: 30,
    detail: 'Watches the file system, chunks changed files, hashes chunks, and keeps a local DB of what it believes the server has (the sync cursor).' },
  { id: 'b', label: 'Device B', sub: 'sync client', kind: 'client', x: 10, y: 78 },
  { id: 'lb', label: 'API gateway', kind: 'lb', x: 28, y: 50 },
  { id: 'block', label: 'Block service', sub: 'upload / download', kind: 'service', x: 48, y: 22,
    detail: 'Accepts chunks addressed by content hash. If the hash already exists, nothing is stored: that is dedup across versions, files, and even users.' },
  { id: 'meta', label: 'Metadata service', sub: 'commit + journal', kind: 'service', x: 48, y: 62,
    detail: 'Commits a new file version as an ordered list of chunk hashes, using compare-and-set on the parent version. Every commit is appended to a per-namespace journal that clients read from.' },
  { id: 'notify', label: 'Notification', sub: 'long-poll / WS', kind: 'service', x: 28, y: 88,
    detail: 'Tells idle clients “your namespace changed, read the journal from cursor X”. It carries no file data, so it stays cheap even with millions of open connections.' },
  { id: 'blobs', label: 'Block storage', sub: 'object store', kind: 'storage', x: 74, y: 22,
    detail: 'Immutable, content-addressed chunks. Unreferenced chunks are garbage-collected with a reference count or mark-and-sweep, after a safety delay.' },
  { id: 'db', label: 'Metadata DB', sub: 'strongly consistent', kind: 'db', x: 74, y: 62,
    detail: 'Namespaces, files, versions, and the journal. It needs transactions and a per-namespace total order, so a sharded relational DB (sharded by namespace) is a natural fit.' },
  { id: 'cold', label: 'Cold tier', sub: 'old versions', kind: 'storage', x: 90, y: 42 },
]

const EDGES: ArchEdge[] = [
  { from: 'a', to: 'lb' }, { from: 'b', to: 'lb' }, { from: 'lb', to: 'block' }, { from: 'lb', to: 'meta' },
  { from: 'block', to: 'blobs' }, { from: 'meta', to: 'db' }, { from: 'meta', to: 'notify', async: true },
  { from: 'notify', to: 'b' }, { from: 'blobs', to: 'cold', async: true },
]

export default function FileSyncChapter() {
  return (
    <>
      <TLDR items={[
        'Sync files across a user’s devices without ever losing data.',
        'Split files into chunks addressed by their hash, so only changed chunks are uploaded and duplicates are stored once.',
        'Keep bytes and metadata on separate paths; metadata must be strictly consistent.',
        'Each namespace has an ordered change journal; devices sync by replaying it from their cursor.',
        'When two offline edits collide on a binary file, keep both copies rather than silently losing one.',
      ]} />
      <MentalModel id="file-sync" />

      <p>“Design Google Drive / Dropbox” is really three separate problems:</p>
      <ul>
        <li><strong>Moving bytes efficiently</strong>: chunking, deduplication and delta sync.</li>
        <li><strong>Keeping metadata strictly consistent</strong>: versions, ordering and conflicts.</li>
        <li><strong>Telling millions of idle devices that something changed.</strong></li>
      </ul>
      <p>Keep bytes and metadata on separate paths, and each problem becomes simpler.</p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>Settle the features, then state the top priority: never lose user data.</p>
      <Requirements
        functional={['Upload / download files', 'Sync changes across a user’s devices', 'Revision history (restore old versions)', 'Share files with others', 'Work offline, sync on reconnect']}
        nonFunctional={['Never lose data (durability ≫ availability)', 'Efficient: minimize bandwidth on small edits', 'Sync latency: seconds', 'Files up to tens of GB', 'Scale: 50M users, 10M DAU (illustrative)']}
        outOfScope={['Real-time collaborative editing (Docs-style)', 'Full-text search of file contents']}
      />
      <Callout kind="tip">
        State the priority out loud: <strong>correctness of user data beats latency</strong>. That justifies strongly
        consistent metadata and conservative conflict handling later on.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>Estimate storage, bandwidth and metadata load to see which one dominates.</p>
      <EstimationTable
        assumptions={['50M users, avg 10 GB stored', '10M DAU, ~2 file edits synced per user per day', 'Average edited file 1 MB; delta sync uploads ~10%', 'Illustrative numbers']}
        rows={[
          { label: 'Logical storage', math: '50M × 10 GB', result: '≈ 500 PB' },
          { label: 'After dedup (varies)', math: 'often 20–50% saving', result: '≈ 250–400 PB' },
          { label: 'Edits / sec', math: '10M × 2 ÷ 86,400', result: '≈ 230/s (peak ~700)' },
          { label: 'Upload bandwidth', math: '700 × 1 MB × 10%', result: '≈ 70 MB/s' },
          { label: 'Metadata reads', math: 'journal polls, list calls', result: '≫ writes (read-heavy)' },
        ]}
      />
      <StatRow caption="Illustrative numbers" stats={[
        { value: '500 PB', label: 'logical storage', note: '≈ 250–400 PB after dedup' },
        { value: '230/s', label: 'edits synced', note: '≈ 700/s at peak' },
        { value: '70 MB/s', label: 'upload bandwidth with delta sync' },
      ]} />
      <p>
        Storage cost dominates. Bandwidth stays modest <em>only if</em>{' '}
        <Term def="Uploading only the parts of a file that changed, instead of the whole file.">delta sync</Term>{' '}
        works. Metadata QPS is small, but it must be exactly right.
      </p>

      <H2 id="api">3 · API</H2>
      <p>Clients upload missing chunks, then commit a new file version that lists its chunks. A separate call waits for changes.</p>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/blocks/check', desc: 'Which of these chunk hashes does the server lack?', body: '{ hashes: string[] }', returns: '{ missing: string[] }' },
        { method: 'PUT', path: '/blocks/{sha256}', desc: 'Upload one missing chunk. Idempotent: same hash, same bytes.', body: 'binary', returns: '201 | 200 (already present)' },
        { method: 'POST', path: '/files/commit', desc: 'Commit a new version as a list of chunk hashes. Fails if the parent version is not the latest.', body: '{ path, parentRev, blocks: string[], size }', returns: '200 { rev } | 409 conflict' },
        { method: 'GET', path: '/journal?cursor=…', desc: 'Changes in this namespace since the cursor. The client applies them in order.', returns: '{ entries[], cursor, hasMore }' },
        { method: 'GET', path: '/notify/longpoll?cursor=…', desc: 'Held open until something changes or it times out.', returns: '{ changed: boolean }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>
        Chunks flow through a block service into object storage. File versions and the change journal live in a
        consistent metadata database. A notification service wakes up devices when something changes.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={400}
        caption="Bytes (block path) and truth (metadata path) are separated"
        flows={[
          { name: 'Upload edit', path: ['a', 'lb', 'block', 'blobs'], steps: ['Client chunks the changed file and asks which hashes are missing', 'Gateway routes to the block service', 'Only missing chunks are stored'] },
          { name: 'Commit', path: ['a', 'lb', 'meta', 'db'], steps: ['Client commits a version: path + parentRev + chunk list', 'Gateway → metadata service', 'Compare-and-set on parentRev, then append to the namespace journal'] },
          { name: 'Sync other device', path: ['meta', 'notify', 'b', 'lb', 'meta'], steps: ['Commit triggers a notification', 'Long-poll returns “changed” to device B', 'B asks for journal entries after its cursor', 'B downloads any chunks it lacks and rebuilds the file'] },
        ]} />

      <H2 id="chunking">5 · Deep dive: chunking, dedup & delta sync</H2>
      <p>
        First, make uploads cheap. Split files into chunks and <strong>address each chunk by its hash</strong>{' '}
        (<Term def="Storing data under the hash of its content, so identical content always gets the same address.">content addressing</Term>).
        A file version is then just an ordered list of hashes.
      </p>
      <p>
        Unchanged chunks are never re-sent. Identical files across users are stored once. Restoring an old version is
        a metadata operation. Edit the text in the demo to see which chunks change.
      </p>
      <FilesyncChunkingDemo />
      <p>How you cut the chunks matters: fixed-size cuts shift after an insert, while content-defined cuts do not.</p>
      <CompareTable
        columns={['Fixed-size chunks', 'Content-defined chunks (CDC)']}
        rows={[
          { label: 'Boundaries', cells: ['Every N bytes', 'Where a rolling hash matches a pattern'] },
          { label: 'Insert 1 byte at start', cells: ['Every chunk shifts, so everything re-uploads', 'Only the first chunk changes'] },
          { label: 'CPU cost', cells: ['Trivial', 'Rolling hash per byte (fast with Gear/FastCDC)'] },
          { label: 'Used by', cells: ['Simple systems, block devices', 'Backup and dedup tools (restic, borg), many sync engines'] },
        ]}
      />
      <Callout kind="warn">
        Cross-user dedup can leak information: if uploading a file is instant, an attacker learns that someone
        already stored it. Mitigations are per-user dedup scopes for sensitive tiers, always paying the upload cost,
        or convergent encryption. Name this trade-off. It is a staff-level catch.
      </Callout>

      <H2 id="consistency">6 · Deep dive: metadata consistency & the journal</H2>
      <p>
        Next, make metadata changes safe under concurrent edits. Each namespace keeps an ordered journal, and commits
        use{' '}
        <Term def="Proceed without locking, then check at commit time that nobody else changed the data; retry or report a conflict if they did.">optimistic concurrency</Term>.
      </p>
      <FlowDiagram caption="Sync is replaying a log; conflicts surface at commit, never mid-upload" steps={[
        { label: 'Edit', sub: 'based on parentRev', icon: PenLine },
        { label: 'Compare-and-set', sub: 'rev ≠ parentRev → 409', icon: GitCompare },
        { label: 'Append journal', sub: 'per-namespace seq', icon: BookOpen },
        { label: 'Replay', sub: 'other devices, from their cursor', icon: RefreshCw },
      ]} />
      <ul>
        <li>Each namespace (a user's root or a shared folder) has a <strong>totally ordered journal</strong> of changes. Clients hold a cursor, meaning “I've applied everything up to entry 18,442”.</li>
        <li>Commits use <strong>optimistic concurrency</strong>: <code>parentRev</code> must equal the current revision, otherwise the server returns <code>409</code>. No locks are held across a slow upload.</li>
        <li>Sync becomes <em>replaying a log</em>, which is simple to reason about, easy to resume after a crash, and idempotent.</li>
        <li>Shard the metadata DB <strong>by namespace</strong>. Shared folders make this harder, so model them as their own namespace mounted into several users' trees.</li>
      </ul>
      <CodeBlock lang="ts" title="commit with compare-and-set (SQL-ish)" code={`
BEGIN;
  SELECT rev FROM files WHERE ns_id = $ns AND path = $path FOR UPDATE;
  -- if rev <> $parentRev → ROLLBACK, return 409 (conflict)
  INSERT INTO file_versions (ns_id, path, rev, blocks, size, device_id)
       VALUES ($ns, $path, $parentRev + 1, $blocks, $size, $device);
  UPDATE files SET rev = $parentRev + 1 WHERE ns_id = $ns AND path = $path;
  INSERT INTO journal (ns_id, seq, path, rev)            -- seq: per-namespace counter
       VALUES ($ns, nextval_ns($ns), $path, $parentRev + 1);
COMMIT;`} />

      <H2 id="conflicts">7 · Deep dive: conflicts & offline edits</H2>
      <p>Two devices can edit the same file while offline. Step through the demo to see what happens when both come back.</p>
      <FilesyncConflictDemo />
      <p>
        For opaque binary files the server can't merge, <strong>keep both</strong>. The first commit wins the path,
        and the loser becomes “filename (conflicted copy)”. Silent last-writer-wins is data loss.
      </p>
      <p>
        Real-time co-editing (Google Docs) solves this differently, with{' '}
        <Term def="Operational transformation and conflict-free replicated data types: two techniques for merging concurrent edits automatically.">OT or CRDTs</Term>{' '}
        at the <em>application</em> layer, not in the file-sync layer.
      </p>

      <H2 id="data-model">8 · Data model</H2>
      <p>Five small tables carry the whole design: namespaces, files, versions, the journal and the blocks.</p>
      <LayerStack legend="Top to bottom: each row points to the one below it"
        caption="The journal sits beside the stack and records every revision change per namespace"
        layers={[
          { label: 'Namespace', sub: 'a user root or a shared folder', icon: FolderTree, size: 0.5, value: 'nsId' },
          { label: 'File entry', sub: 'path → current rev', icon: File, size: 0.65, value: 'nsId + path' },
          { label: 'File version', sub: 'rev → ordered block list', icon: History, size: 0.8, value: 'per rev' },
          { label: 'Block', sub: 'content-addressed, ref-counted, hot or cold tier', icon: Boxes, size: 1, value: 'sha256', highlight: true },
          { label: 'Journal', sub: 'ordered change log per namespace', icon: ScrollText, size: 0.6, value: 'nsId + seq' },
        ]} />
      <CodeBlock lang="ts" title="core tables" code={`
type Namespace   = { nsId: string; ownerId: string; kind: 'user' | 'shared' }
type FileEntry   = { nsId: string; path: string; rev: number; deleted: boolean }
type FileVersion = { nsId: string; path: string; rev: number; blocks: string[]; size: number; deviceId: string; ts: number }
type JournalRow  = { nsId: string; seq: number; path: string; rev: number }        // ordered per namespace
type Block       = { sha256: string; size: number; refCount: number; tier: 'hot' | 'cold' }`} />

      <H2 id="staff">9 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Durability math</strong>: erasure coding (e.g. 10+4) instead of 3× replication cuts storage overhead from 200% to about 40% at similar durability. At hundreds of petabytes that is the whole business case.</li>
          <li><strong>Tiering</strong>: most bytes are rarely read after 30 days. Move old versions and cold files to cheaper storage, and keep metadata hot.</li>
          <li><strong>Client correctness is half the system</strong>: file-watcher edge cases (renames, case-insensitive file systems, partial writes), crash-safe local DBs, and staged rollouts of client versions.</li>
          <li><strong>Security</strong>: encryption at rest per chunk, key management per tenant, and the dedup-privacy trade-off above.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="A user edits 1 byte in a 2 GB video file. What gets uploaded?"
        senior={<p>With 4 MB fixed-size blocks, only the block containing that byte changes, so we upload about 4 MB instead of 2 GB and commit a new block list.</p>}
        staff={<>
          <p>If it is an in-place byte change, one chunk: about 4 MB. If it is an <em>insertion</em>, fixed-size chunking shifts every later boundary and re-uploads nearly everything. That is why content-defined chunking matters, since boundaries follow content and only chunks near the edit change.</p>
          <p>Two more points: the client must hash 2 GB to find the change, so cache per-chunk hashes keyed by mtime and size to avoid re-reading. And for media, a byte-level edit is rare. Re-exports change everything, so dedup gains come mostly from copies, not edits.</p>
        </>}
        followUps={['How do you pick the average chunk size?', 'How does the client resume a 2 GB upload after a crash?']}
      />
      <InterviewQuestion
        q="How does device B learn about changes quickly without hammering the servers?"
        senior={<p>Use long polling or WebSockets to a notification service. When a file changes, notify B, and B fetches the new metadata.</p>}
        staff={<>
          <p>Separate the <strong>signal</strong> from the <strong>data</strong>. The notification channel only carries “namespace X changed”. B then reads the journal from its cursor, so a missed or duplicated notification is harmless: the journal is the source of truth and the cursor makes replay idempotent.</p>
          <p>Long-poll servers hold millions of mostly idle connections, so they need to be memory-lean and horizontally partitioned by namespace. On reconnect, clients jitter their retries to avoid a thundering herd after a deploy.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Separate the byte path (block service, object storage) from the truth path (metadata DB, journal).',
        'Content-addressed chunks give delta sync, dedup, and cheap version history.',
        'Content-defined chunking survives insertions; fixed-size chunking does not.',
        'Commits use compare-and-set on the parent revision. Conflicts produce copies, never silent overwrites.',
        'Staff depth: erasure coding, tiering, client correctness, and the privacy cost of cross-user dedup.',
      ]} />
    </>
  )
}
