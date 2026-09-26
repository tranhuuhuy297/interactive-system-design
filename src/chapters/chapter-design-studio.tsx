import { Callout, CompareTable, DemoFrame, FlowDiagram, H2, TLDR } from '../components/ui'
import { ClipboardList, PencilRuler, Scale, Stethoscope } from 'lucide-react'
import { CATALOG, PALETTE_ORDER } from './demos/studio-catalog'
import { StudioApp } from './demos/studio-app'

const fmt = (v: number) => (Number.isFinite(v) ? v.toLocaleString('en-US') : 'managed')

export default function DesignStudioChapter() {
  return (
    <>
      <p>
        Reading about system design only gets you so far. Design Studio lets you practice the way interviews work:
        take a prompt, sketch the architecture, and defend it. An automated reviewer then traces the traffic through
        your boxes and arrows and tells you what would break.
      </p>
      <TLDR items={[
        'Pick a prompt. Its targets (reads/s, writes/s, storage, p99, availability) are shown above the canvas.',
        'Click or drag components onto the canvas, connect them with the ● handle, and size each one.',
        'Press Review design: you get a score, bottlenecks, single points of failure, and missing pieces.',
        'Compare with the reference design, then copy a Markdown summary into your interview notes.',
      ]} />
      <FlowDiagram caption="One practice loop takes 10–15 minutes. Do it out loud, as in a real interview." steps={[
        { label: 'Read the prompt', sub: 'numbers + constraints', icon: ClipboardList },
        { label: 'Sketch', sub: 'boxes, arrows, sizes', icon: PencilRuler },
        { label: 'Review', sub: 'score + findings', icon: Stethoscope },
        { label: 'Compare', sub: 'reference + trade-offs', icon: Scale },
      ]} />

      <H2 id="studio">The studio</H2>
      <p>Your work autosaves in this browser, one design per prompt. On a phone the canvas turns into a list editor.</p>
      <DemoFrame title="Design Studio" hint="Tip: start from Clients, add an entry point, then work inward toward the data.">
        <StudioApp />
      </DemoFrame>

      <H2 id="how-review-works">How the review works</H2>
      <p>
        The reviewer is a deliberately simple model. It is good at spotting structural mistakes, and it is honest
        about everything else.
      </p>
      <ul>
        <li><strong>Traffic flows along your arrows.</strong> Clients emit the prompt’s peak reads and writes. Every arrow carries its parent’s full traffic, filtered by what the child handles: queues and workers only take writes, caches only reads.</li>
        <li><strong>Caches and CDNs absorb their hit ratio.</strong> A cache placed beside a database (cache-aside) serves hits, so only misses reach the database. A CDN in front of storage passes only its misses through.</li>
        <li><strong>Utilization = load ÷ (capacity per unit × units).</strong> Above 80% is flagged as hot, above 100% as overloaded. A SQL database has one primary, so extra replicas add read capacity but never write capacity.</li>
        <li><strong>A single point of failure</strong> is any self-managed component on the request path with too few units to survive one failure. The CDN, object storage, and the queue count as managed and replicated.</li>
        <li><strong>Storage</strong> is checked for three years of growth. Replicas copy data, so they add no space; KV nodes do.</li>
        <li><strong>Latency</strong> adds each hop’s typical time, slowed as components get busy, and treats p99 as about 2× the typical path.</li>
        <li><strong>Rubric checks</strong> come from the prompt. A read-heavy system needs a cache, money needs a transactional store, real-time push needs a WebSocket gateway.</li>
      </ul>
      <Callout kind="warn" title="Toy capacities for teaching">
        The per-unit numbers below are round figures chosen to make trade-offs visible. They are not benchmarks. In an
        interview, state your own assumptions and do the arithmetic out loud.
      </Callout>
      <CompareTable
        columns={['Toy capacity per unit', 'Needs for one failure']}
        rows={PALETTE_ORDER.filter((k) => k !== 'client').map((k) => {
          const it = CATALOG[k]
          const cap = Number.isFinite(it.cap) ? `${fmt(it.cap)}/s${it.writeCap ? ` (writes: ${fmt(it.writeCap)}/s total)` : ''}` : 'managed'
          return { label: it.name, cells: [cap, it.minHA ? `${it.minHA} ${it.unitLabel.toLowerCase()}` : 'managed'] }
        })}
      />

      <H2 id="practice-tips">How to practice well</H2>
      <ul>
        <li><strong>Sketch before you peek.</strong> Turn on the review only after your first full pass. The score means more when you had to think.</li>
        <li><strong>Chase the first bottleneck.</strong> Fix the hottest component, re-run the review, and say out loud what moved.</li>
        <li><strong>Argue with the reference.</strong> It is one good answer, not the answer. Where yours differs, explain the trade-off.</li>
        <li><strong>Use the staff moves.</strong> The reviewer suggests what a staff engineer would raise next. Practice saying it in one sentence.</li>
      </ul>
      <p>
        Related reading: <a href="#/framework">the interview framework</a>, <a href="#/estimation">back-of-the-envelope estimation</a>,{' '}
        <a href="#/scaling">scale from zero to millions</a>, <a href="#/caching">caching</a>, and <a href="#/reliability">reliability</a>.
      </p>
    </>
  )
}
