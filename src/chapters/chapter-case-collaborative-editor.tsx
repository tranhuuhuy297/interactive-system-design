import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode } from '../components/ui'
import { CollabCrdtTombstoneDemo } from './demos/collab-crdt-tombstone-demo'
import { CollabOtSyncDemo } from './demos/collab-ot-sync-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Editors', sub: 'browser / app', kind: 'client', x: 8, y: 50,
    detail: 'Each client applies its own edits immediately for zero-latency typing, keeps unacknowledged ops in a pending queue, and rebases incoming ops against them.' },
  { id: 'lb', label: 'WS gateway', sub: 'route by doc id', kind: 'lb', x: 26, y: 50,
    detail: 'Terminates WebSockets and forwards every connection for document D to the one session server that currently owns D.' },
  { id: 'dir', label: 'Doc directory', sub: 'owner leases', kind: 'cache', x: 26, y: 86,
    detail: 'A strongly consistent map doc id → owning session server, with a lease (etcd/ZooKeeper, or consistent hashing plus fencing). If the owner dies, the lease expires and another server takes over.' },
  { id: 'collab', label: 'Session server', sub: 'doc authority', kind: 'service', x: 48, y: 50,
    detail: 'Holds the live document in memory, assigns each incoming op a revision number, transforms it (OT) or merges it (CRDT), persists it, then broadcasts it. One writer per document keeps ordering simple.' },
  { id: 'presence', label: 'Presence', sub: 'cursors, in memory', kind: 'cache', x: 48, y: 14,
    detail: 'Cursor positions, selections and who is viewing. Ephemeral, throttled to a few updates per second, never written to the op log.' },
  { id: 'acl', label: 'Docs & ACL DB', kind: 'db', x: 72, y: 14,
    detail: 'Document metadata and permissions. Checked on join and cached in the session, and re-checked when sharing changes are pushed.' },
  { id: 'oplog', label: 'Op log', sub: 'append-only', kind: 'db', x: 72, y: 50,
    detail: 'Durable, ordered log of every accepted op keyed by (doc_id, revision). An op is acknowledged only after it is durable here.' },
  { id: 'worker', label: 'Snapshotter', kind: 'worker', x: 72, y: 86,
    detail: 'Periodically folds the op tail into a snapshot so that loading a doc never replays millions of ops. Also produces the named versions in version history.' },
  { id: 'snap', label: 'Snapshots', sub: 'object storage', kind: 'storage', x: 92, y: 68,
    detail: 'Full document state at revision N. Load = latest snapshot + ops after N.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'lb' }, { from: 'lb', to: 'dir' }, { from: 'lb', to: 'collab' },
  { from: 'collab', to: 'presence' }, { from: 'collab', to: 'acl' }, { from: 'collab', to: 'oplog' },
  { from: 'oplog', to: 'worker', async: true }, { from: 'worker', to: 'snap' }, { from: 'collab', to: 'snap' },
]

export default function CollaborativeEditorChapter() {
  return (
    <>
      <p>
        Real-time collaborative editing looks like a chat problem, since it is just pushing small messages over WebSockets.
        It is really a <strong>concurrency-control</strong> problem. Two people edit the same paragraph at the same moment,
        both see their own keystroke instantly, and a few hundred milliseconds later every screen must show
        <em> exactly</em> the same text. The interview is about how you get there: operational transformation or CRDTs,
        where the authority lives, and how you persist, recover and scale a document that is hot.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Multiple users edit one document concurrently', 'See others’ edits and cursors live', 'Version history & restore', 'Offline edits merge on reconnect', 'Share with view / comment / edit roles']}
        nonFunctional={['Local keystroke latency ≈ 0 (optimistic)', 'Remote edits visible in < 300 ms p95 in-region', 'All replicas converge; no lost edits', 'Durable once acknowledged']}
        outOfScope={['Rich layout engine & rendering', 'Spreadsheet formulas', 'Search across documents']}
      />
      <Callout kind="tip">
        Ask early: <strong>plain text, rich text, or structured canvas?</strong> Rich text adds formatting ranges and
        embedded objects. A canvas like Figma is a tree of objects with properties, which is much easier to merge than a
        character sequence. The answer changes which consistency technique is reasonable.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['100M daily users, 10M concurrently connected at peak', '~30% of connected users actively typing', 'Clients batch keystrokes every ~200 ms into one message', '~100 B per op on the wire and on disk (illustrative)']}
        rows={[
          { label: 'Concurrent sockets', math: '10M peak', result: '10M' },
          { label: 'Gateway nodes', math: '10M / ~100K sockets each', result: '≈ 100' },
          { label: 'Op messages / s', math: '3M typists × 5 batches/s', result: '≈ 15M/s' },
          { label: 'Fan-out per doc', math: 'most docs have 1–3 editors', result: 'small, except hot docs' },
          { label: 'Raw op log / day', math: '100M × ~5K ops × 100 B', result: '≈ 50 TB' },
        ]}
      />
      <p>
        Two numbers drive the design. The op log is huge but mostly cold, so <strong>snapshots and compaction</strong> are
        required, not optional. Fan-out is usually tiny, which is why a single in-memory authority per document is
        affordable. The exception is the hot doc: an all-hands agenda with hundreds of viewers.
      </p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'GET', path: '/v1/docs/{id}', desc: 'Load the latest snapshot plus the op tail and the current revision.', returns: '{ snapshot, rev, ops[] }' },
        { method: 'WS', path: '/v1/docs/{id}/session', desc: 'Bidirectional stream: submit ops, receive acks, remote ops, and presence.', body: '{ type: "op", baseRev, ops[] }', returns: '{ type: "ack" | "remote" | "presence", rev, ops }' },
        { method: 'GET', path: '/v1/docs/{id}/ops?from={rev}', desc: 'Catch up after a reconnect without reloading the whole document.', returns: '{ ops[], rev }' },
        { method: 'POST', path: '/v1/docs/{id}/versions', desc: 'Name the current revision in version history.', body: '{ name }', returns: '201 { rev }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Every document has exactly one live authority at a time. Presence is ephemeral and never touches the log."
        flows={[
          { name: 'Edit', path: ['client', 'lb', 'collab', 'oplog'], steps: ['Client applies the edit locally, then sends { baseRev, op }', 'Gateway forwards to the owner of this doc id', 'Owner transforms against newer ops, assigns rev N+1, appends to the log, then acks and broadcasts'] },
          { name: 'Open document', path: ['client', 'lb', 'collab', 'snap'], steps: ['Client opens a WebSocket for doc D', 'Gateway looks up the owner in the directory; if none, a server acquires the lease', 'Owner loads the latest snapshot and replays the op tail into memory'] },
          { name: 'Snapshot', path: ['oplog', 'worker', 'snap'], steps: ['New ops accumulate in the log', 'Snapshotter folds ops since the last snapshot into a new full state'] },
        ]} />

      <H2 id="authority">5 · Deep dive: one authority per document</H2>
      <p>
        The simplest correct architecture sends every edit for a document through <strong>one server</strong> that assigns
        a total order: revision 1, 2, 3 and so on. With a central sequencer, OT only needs to handle client-vs-server
        concurrency, not the much harder peer-to-peer case. This is the client–server model of the Jupiter system from
        Xerox PARC, which Google Wave and Docs built on, and of the open-source ot.js library.
      </p>
      <ul>
        <li><strong>Routing:</strong> gateways route by doc id using a directory with leases, or consistent hashing plus a fencing token, so two servers never both believe they own a doc.</li>
        <li><strong>Failover:</strong> when the owner dies, its lease expires. The new owner loads snapshot + log. Clients reconnect and resend any unacknowledged ops with their base revision, so nothing is lost.</li>
        <li><strong>Durability:</strong> ack only after the op is durable in the log. The in-memory copy is a cache.</li>
      </ul>

      <H2 id="ot">6 · Deep dive: operational transformation</H2>
      <p>
        With OT, an op generated against revision <em>r</em> is rewritten (“transformed”) so it still means the same thing
        after other ops have been applied. Try it: with <strong>naive apply</strong>, a concurrent insert and delete land at
        stale positions and the replicas diverge. With <strong>OT</strong>, the server rewrites positions and every copy
        converges.
      </p>
      <CollabOtSyncDemo />
      <CodeBlock lang="ts" title="character-wise transform (a rewritten to apply after b)" code={`
function transform(a: Op, b: Op): Op {
  if (a.type === 'ins' && b.type === 'ins') {
    const aFirst = a.pos < b.pos || (a.pos === b.pos && a.site < b.site) // deterministic tie-break
    return aFirst ? a : { ...a, pos: a.pos + 1 }
  }
  if (a.type === 'ins' && b.type === 'del') return a.pos <= b.pos ? a : { ...a, pos: a.pos - 1 }
  if (a.type === 'del' && b.type === 'ins') return a.pos < b.pos ? a : { ...a, pos: a.pos + 1 }
  if (a.pos === b.pos) return NOOP  // both deleted the same char
  return a.pos < b.pos ? a : { ...a, pos: a.pos - 1 }
}`} />
      <Callout kind="info">
        The client keeps <strong>one op in flight</strong> and buffers the rest. Every incoming remote op is transformed
        against the in-flight op and the buffer, and they are transformed against it. That is the whole client algorithm.
        The simulation above passes 500 randomized concurrent-edit runs with this model. Real editors use richer ops
        (retain/insert/delete ranges, formatting attributes), but the principle is the same.
      </Callout>

      <H2 id="crdt">7 · Deep dive: CRDTs</H2>
      <p>
        A sequence CRDT gives every character a globally unique, ordered id and remembers where it was inserted. Deletes
        become <strong>tombstones</strong>. Replicas can merge in any order, with or without a server, and still converge.
        That is why CRDT libraries (Yjs, Automerge) are popular for offline-first and peer-to-peer apps.
      </p>
      <CollabCrdtTombstoneDemo />
      <CompareTable
        columns={['OT (central server)', 'CRDT']}
        rows={[
          { label: 'Needs a server', cells: ['Yes: it defines the order', 'No: merge works peer-to-peer'] },
          { label: 'Offline edits', cells: ['Rebase a long pending queue on reconnect', 'Natural: merge on sync'] },
          { label: 'Metadata', cells: ['Small: positions only', 'Ids per element + tombstones; needs compaction'] },
          { label: 'Correctness burden', cells: ['Transform functions for every op pair', 'Merge rules proven once in the library'] },
          { label: 'Intent anomalies', cells: ['Controlled by the server', 'Interleaving quirks in some algorithms'] },
          { label: 'Seen in', cells: ['Google Docs (OT lineage)', 'Yjs, Automerge; Figma uses a server-authoritative, CRDT-inspired model'] },
        ]}
      />

      <H2 id="presence-undo-offline">8 · Presence, undo and offline</H2>
      <ul>
        <li><strong>Presence</strong> travels on the same socket but is ephemeral. Throttle it to a few updates per second, transform cursor positions through incoming ops, and drop it on disconnect.</li>
        <li><strong>Undo</strong> must be <em>local</em>: undo my last op, not the last op in the document. Implement it as the inverse op, transformed against everything applied since.</li>
        <li><strong>Offline</strong>: queue ops with their base revision, fetch <code>ops?from=rev</code> on reconnect, then rebase (OT) or merge (CRDT). Cap how long a client may stay offline before it must reload a snapshot.</li>
        <li><strong>Permissions</strong> are enforced per op on the server. Never trust a client’s role, and push revocations to open sessions.</li>
      </ul>

      <H2 id="data-model">9 · Data model</H2>
      <CodeBlock lang="ts" title="storage" code={`
// Op log: partition by doc_id, cluster by rev → sequential appends, range reads for catch-up
type OpRecord = { docId: string; rev: number; userId: string; ops: Op[]; ts: number }

// Snapshot: full state at a revision; old snapshots kept for version history
type Snapshot = { docId: string; rev: number; blobUrl: string; createdAt: number }

type DocMeta = { docId: string; ownerId: string; title: string; acl: Record<string, 'view' | 'comment' | 'edit'> }`} />

      <H2 id="staff">10 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Hot documents</strong>: split editors from viewers. Viewers subscribe to a read-only fan-out tier fed by the owner, so 5,000 viewers never load the sequencer. Products also cap concurrent editors per doc.</li>
          <li><strong>Blast radius</strong>: a bad transform bug corrupts documents silently. Keep the op log immutable, run a shadow convergence checker that replays ops against snapshots, and have a per-doc kill switch that falls back to read-only.</li>
          <li><strong>Multi-region</strong>: pin each doc’s authority to the region of its most active editors and migrate the lease when that changes. Cross-region editors pay one round trip, which is acceptable because typing stays local.</li>
          <li><strong>Storage cost</strong>: compacting old revisions into snapshots while keeping named versions turns 50 TB/day of raw ops into a manageable, tiered footprint.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="OT or CRDT for a Google Docs competitor? Defend your choice."
        senior={<p>CRDTs, because they converge without a central server and handle offline well. OT is older and harder to get right.</p>}
        staff={<>
          <p>For a server-backed product with rich text and permissions, I would start with <strong>OT behind a single authority per document</strong>. There is already a server that must authorize every op, persist it, and produce version history, so a central order costs nothing extra. Metadata stays small, and the transform matrix is manageable for a fixed op set.</p>
          <p>I would pick a CRDT (e.g. Yjs) if offline-first or peer-to-peer is a core requirement, or if the team is small and wants a battle-tested merge library instead of owning transform code. Then I would budget for tombstone compaction and document-size growth.</p>
          <p>Either way the hard parts are the same: authority and failover, durability before ack, snapshots, and hot documents.</p>
        </>}
        followUps={['How do you garbage-collect CRDT tombstones safely?', 'What happens to in-flight ops when the owner server crashes?', 'How would you implement comments anchored to text that keeps changing?']}
      />
      <InterviewQuestion
        q="A doc used for a company all-hands has 3,000 people open. What breaks?"
        senior={<p>The session server gets overloaded broadcasting every keystroke to 3,000 sockets. Scale up the server or shard the document.</p>}
        staff={<>
          <p>Writes are not the problem: only a handful of people type. <strong>Fan-out and presence</strong> are. 3,000 cursors × several updates per second is millions of presence messages, O(n²).</p>
          <ul>
            <li>Separate roles: editors talk to the authority, and viewers get a read-only stream from a fan-out tier (pub/sub or edge relays) with batched updates.</li>
            <li>Presence degrades gracefully: show avatars and counts beyond ~50 viewers, and send cursors only for editors.</li>
            <li>Admission control: cap editors and switch late joiners to view mode.</li>
          </ul>
        </>}
      />

      <KeyTakeaways items={[
        'It is a concurrency-control problem: optimistic local apply plus a convergence algorithm.',
        'One authority per document (leased, fenced) gives a total order and makes OT tractable.',
        'OT rewrites positions against concurrent ops; CRDTs give every character an id and merge in any order.',
        'Ack only after the op is durable. Snapshots plus an op tail make loads fast and history cheap.',
        'Presence is ephemeral and throttled. Hot docs need an editor/viewer split.',
      ]} />
    </>
  )
}
