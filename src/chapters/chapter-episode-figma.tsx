import {
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, MentalModel, References, SideBySide, StatRow, Term, TLDR, VisualTimeline,
} from '../components/ui'
import { Boxes, Cpu, Database, FileClock, Layers, PenTool, Plug, Radio, Rocket, Split, Users, Zap } from 'lucide-react'
import type { ArchEdge, ArchNode } from '../components/ui'
import { FIGMA_REFS } from './demos/episode-figma-sources'
import { EpisodeFigmaMultiplayerDemo } from './demos/episode-figma-multiplayer-demo'
import { FIGMA_STAGES } from './demos/episode-figma-stages'

const EDIT_NODES: ArchNode[] = [
  { id: 'a', label: 'Designer A', sub: 'WebAssembly editor', kind: 'client', x: 10, y: 30,
    detail: 'Applies each edit instantly on screen, then sends it. Until the server acknowledges it, incoming updates to that property are ignored.' },
  { id: 'b', label: 'Designer B', sub: 'same file', kind: 'client', x: 10, y: 78 },
  { id: 'mp', label: 'Multiplayer', sub: 'one process per file', kind: 'service', x: 38, y: 54,
    detail: 'Node.js holds the WebSockets; a Rust process per document applies changes in arrival order and broadcasts them.' },
  { id: 'journal', label: 'Journal', sub: 'DynamoDB', kind: 'db', x: 64, y: 30,
    detail: 'Each batch of changes is appended with a sequence number, so a crash loses under a second of work.' },
  { id: 's3', label: 'Checkpoints', sub: 'S3', kind: 'storage', x: 64, y: 78, detail: 'Full snapshots of the file. Recovery loads a checkpoint, then replays the journal after it.' },
  { id: 'api', label: 'API + DBProxy', sub: 'sharded Postgres', kind: 'service', x: 88, y: 54,
    detail: 'Metadata such as file names, permissions, and comments lives in sharded Postgres, not in the multiplayer process.' },
]
const EDIT_EDGES: ArchEdge[] = [
  { from: 'a', to: 'mp' }, { from: 'mp', to: 'b' }, { from: 'mp', to: 'journal' },
  { from: 'mp', to: 's3', async: true }, { from: 'a', to: 'api' },
]

const TIMELINE = [
  { when: '2015', title: 'C++ editor compiled for the browser, WebGL renderer; preview opens', icon: PenTool },
  { when: '2016', title: 'Public launch with multiplayer: one server process per file', icon: Users },
  { when: '2017', title: 'WebAssembly: load time more than 3× faster', icon: Zap },
  { when: '2018', title: 'Rust process per document inside multiplayer', icon: Cpu },
  { when: '2019', title: 'Plugins in a sandbox; multiplayer design published', icon: Plug },
  { when: '2020–22', title: 'One Postgres → replicas → vertical partitions', icon: Database },
  { when: '2021', title: 'LiveGraph real-time data; FigJam launches', icon: Radio },
  { when: '2022', title: 'Write-ahead journal: 95% of edits saved in 600 ms', icon: FileClock },
  { when: '2023–24', title: 'Horizontal sharding with DBProxy; LiveGraph 100×', icon: Split },
  { when: '2025', title: 'Company goes public', icon: Rocket },
]

export default function FigmaEpisode() {
  return (
    <>
      <TLDR items={[
        'Figma is a desktop-class editor in the browser: C++ compiled to WebAssembly, drawn with WebGL.',
        'Every open file has one server process that orders all edits.',
        'Conflicts resolve per property: the last value the server receives wins.',
        'A journal plus snapshots means a crash loses under a second of work.',
        'Postgres scaled in steps: bigger box, replicas, vertical partitions, then sharding behind a proxy.',
      ]} />
      <MentalModel id="ep-figma" />
      <p>
        Figma bet that a professional design tool could live in a browser tab and that many people could edit one file
        at once. Both bets required unusual engineering: a rendering engine written from scratch, and a sync system far
        simpler than the ones used by text editors.
      </p>
      <p>
        This episode follows the path from that first editor to{' '}
        <Term def="A server-authoritative sync model where concurrent edits to the same property resolve to the last value the server receives.">last-writer-wins multiplayer</Term>,
        a <Term def="An append-only log of changes written before they are folded into a snapshot, used to recover after a crash.">write-ahead journal</Term>,
        and <Term def="Splitting one table’s rows across many databases by a shard key, such as a user or file ID.">horizontal sharding</Term> of Postgres.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Keep two planes apart: the <em>canvas</em> (live, in memory, per file) and the <em>metadata</em> (files, teams,
        comments in Postgres). Most stages scale one of them. Open “Go deeper” for flows, numbers, and sources.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Figma; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <VisualTimeline items={TIMELINE} />

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={FIGMA_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <p>Figma’s posts give the growth pressure directly. The estimates below turn them into a sense of scale.</p>
      <StatRow caption="Reported by Figma engineering" stats={[
        { value: '2.2B+', label: 'multiplayer changes a day', note: '2022' },
        { value: '95% < 600 ms', label: 'edits durably saved', note: '2022' },
        { value: '≈ 100×', label: 'database growth since 2020', note: '2024' },
      ]} />
      <EstimationTable
        assumptions={['2.2B changes/day spread evenly (real traffic is peaky)', 'Clients send updates at up to 30 per second while dragging', 'Database traffic grows ≈ 3× a year']}
        rows={[
          { label: 'Average change rate', math: '2.2B / 86,400 s', result: '≈ 25K /s' },
          { label: 'One user dragging', math: '30 updates × 60 s', result: '1,800 / min' },
          { label: 'DB load in 3 years', math: '3 × 3 × 3', result: '≈ 27×' },
          { label: 'Checkpoint-only loss window', math: 'every 30–60 s', result: '≤ 60 s of work' },
        ]}
      />
      <p>
        The last two rows are the story of this episode: steady 3× yearly growth forces a new database plan every year
        or two, and periodic checkpoints alone leave too much work at risk.
      </p>

      <H2 id="an-edit">What happens when you move a shape</H2>
      <p>A drag is a stream of tiny property changes. Here is where each one goes.</p>
      <ArchitectureDiagram nodes={EDIT_NODES} edges={EDIT_EDGES} height={380}
        caption="The canvas lives in a per-file process; metadata lives in Postgres"
        flows={[
          { name: 'Move', path: ['a', 'mp', 'b'], steps: ['A applies the move locally and sends it', 'The file’s process orders it and broadcasts to everyone in the file'] },
          { name: 'Persist', path: ['a', 'mp', 'journal'], steps: ['The change reaches the file’s process', 'A batch is appended to the journal with a sequence number'] },
          { name: 'Snapshot', path: ['mp', 's3'], steps: ['Periodically, the whole file is checkpointed to S3'] },
        ]} />

      <H2 id="multiplayer">Deep dive: why per-property last-writer-wins works</H2>
      <p>
        Most edits in a design file touch <em>different</em> properties. Resolving conflicts per property means those
        never collide. The client-side guard, which ignores echoes over unacknowledged local edits, stops values from
        flickering backwards.
      </p>
      <EpisodeFigmaMultiplayerDemo />
      <Callout kind="pitfall">
        Picking a heavyweight algorithm (OT or a full CRDT library) by reflex is a common interview slip. Start from the
        data model: if edits are property sets on objects and there is a central server, last-writer-wins per property
        is often enough, and far easier to reason about.
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <p>The three decisions that define the system:</p>
      <SideBySide panels={[
        { title: 'Own rendering engine', icon: PenTool, tone: 'good', points: ['+ Desktop-class speed in a tab', '- Rebuild text layout and more yourself', '- Instead of: DOM, SVG, or Canvas 2D'], verdict: 'Editor' },
        { title: 'Server-ordered LWW per property', icon: Layers, tone: 'good', points: ['+ Simple, fast, predictable', '- Same-text-box edits can overwrite', '- Instead of: OT or a full CRDT'], verdict: 'Multiplayer' },
        { title: 'Shard behind a proxy', icon: Boxes, tone: 'good', points: ['+ App code barely changes', '- Cross-shard queries scatter-gather', '- Instead of: switching databases'], verdict: 'Metadata' },
      ]} />
      <p>Other decisions, in brief:</p>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Hot path language', cells: ['Rust process per document', 'Keep TypeScript', 'No GC pauses; one slow file no longer blocks others'] },
          { label: 'Durability', cells: ['Journal + S3 checkpoints', 'Checkpoints only', 'Loss window drops from a minute to under a second'] },
          { label: 'Live non-canvas data', cells: ['LiveGraph tailing the WAL', 'Client polling', 'Every committed write is seen once, in order'] },
          { label: 'Plugins', cells: ['Realm sandbox + iframe UI', 'iframe only', 'Synchronous document access without copying the file'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Match the algorithm to the data.</strong> A design file is a tree of property maps, not a text string. Simpler sync was a feature, not a shortcut.</li>
          <li><strong>Separate the canvas plane from the metadata plane.</strong> They have different write rates, durability needs, and scaling paths.</li>
          <li><strong>Scale databases in cheap-first steps.</strong> Bigger box, replicas, pooling, vertical partitions, then sharding, each buying time for the next.</li>
          <li><strong>Own the risky boundary.</strong> A custom proxy and a tiny plugin security layer are big commitments; keep them small and auditable.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="Design real-time collaboration for a vector design tool."
        senior={<p>Use WebSockets to a collaboration server that broadcasts changes. Resolve conflicts with a CRDT or operational transformation so everyone converges.</p>}
        staff={<>
          <p>I’d start from the data model: a tree of objects with properties. With a server per document as the ordering authority, <strong>last-writer-wins per property</strong> converges without OT’s complexity. Clients apply edits optimistically and ignore echoes over their own unacknowledged changes to avoid flicker.</p>
          <p>Then durability and scale: journal each batch with a sequence number, snapshot periodically, and recover by replay. Route every client of a file to that file’s process with a directory service, and plan for hot files and process failover. Text inside a shape is the one place I’d consider a sequence CRDT.</p>
        </>}
        followUps={['How do you handle reparenting that would create a cycle?', 'How do new objects get IDs without a server round-trip?', 'What happens when the file’s process crashes mid-drag?']}
      />
      <InterviewQuestion
        q="Your single Postgres is at 65% CPU at peak and traffic triples yearly. What’s your plan?"
        senior={<p>Add read replicas and caching, then shard the biggest tables by user or tenant ID.</p>}
        staff={<>
          <p>Stage it by payback. This quarter: bigger instance, replicas for safe-to-be-stale reads, connection pooling, and new features on new databases. Next: <strong>vertical partitioning</strong> of table groups with logical replication and short cutovers.</p>
          <p>For tables that will outgrow one machine: horizontal sharding behind a <strong>proxy</strong> that understands shard keys, with logical and physical shards separated so I can rebalance without touching app code. I’d define colos so joins and transactions stay within one shard, and budget for scatter-gather on the rest.</p>
        </>}
        followUps={['How do you pick the shard key?', 'How do you migrate a live table with no downtime?', 'What changes for real-time subscriptions after sharding?']}
      />

      <H2 id="references">Sources</H2>
      <References items={FIGMA_REFS} />

      <KeyTakeaways items={[
        'Bypass the platform only where it blocks the core requirement: here, 60 fps vector rendering.',
        'One process per document gives each file a single ordering point.',
        'Per-property last-writer-wins plus an unacknowledged-edit guard gives simple, flicker-free convergence.',
        'Snapshot plus journal shrinks crash loss from a minute to under a second.',
        'Scale Postgres in steps; shard behind a proxy so application code barely changes.',
        'Keep live metadata separate from the canvas, and push it from the database log.',
      ]} />
    </>
  )
}
