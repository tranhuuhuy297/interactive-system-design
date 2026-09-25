import {
  Callout, CodeBlock, EstimationTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, LayerStack, MentalModel, References, StatRow, TLDR, Term,
} from '../components/ui'
import { CalendarDays, Gauge, Server, TrendingUp, Users } from 'lucide-react'
import type { Reference } from '../components/ui'
import { EstimationCapacityCalculator } from './demos/estimation-capacity-calculator'
import { EstimationLatencyVisualizer } from './demos/estimation-latency-visualizer'
import { EstimationNinesCalculator } from './demos/estimation-nines-calculator'

const REFS: Reference[] = [
  { title: "Teach Yourself Programming in Ten Years", source: "Peter Norvig", year: 2001, url: "https://norvig.com/21-days.html", kind: "blog", note: "Early widely shared table of approximate operation timings" },
  { title: "Numbers Everyone Should Know (conference talks)", source: "Jeff Dean, Google", year: 2009, kind: "talk", note: "Popularized the latency table" },
  { title: "Latency Numbers Every Programmer Should Know (interactive, by year)", source: "Colin Scott", url: "https://colin-scott.github.io/personal_website/research/interactive_latency.html", kind: "docs", note: "Extrapolated modern values" },
  { title: "Service Level Objectives (Site Reliability Engineering, ch. 4)", source: "Google", year: 2016, url: "https://sre.google/sre-book/service-level-objectives/", kind: "book", note: "Availability targets and nines" },
  { title: "System Design Interview – An Insider’s Guide (Vol. 1)", source: "Alex Xu", year: 2020, kind: "book", note: "Covers estimation basics; worked examples here are original" },
]

export default function EstimationChapter() {
  return (
    <>
      <p>
        Estimation is not about the exact number. It is about getting the <strong>order of magnitude</strong> (the
        right power of ten) fast enough to make decisions. Does this fit on one machine? In memory? Does it need
        sharding? Is bandwidth or storage the real cost?
      </p>
      <TLDR items={[
        'Round hard: a day is about 10⁵ seconds, so 1M requests/day is about 12 per second.',
        'Memorize a few latency ratios. They explain why we cache, batch, and avoid cross-region calls.',
        'Availability multiplies along a request path, so many dependencies drag it down fast.',
        'Show your arithmetic out loud, and use the result to rule options in or out.',
      ]} />
      <MentalModel id="estimation" />
      <p>A few rounded numbers said out loud do more for your credibility than any diagram.</p>

      <H2 id="powers-of-two">Powers of two and the units that matter</H2>
      <p>Storage and memory sizes come in powers of two. For estimation, treat each step of 2¹⁰ as “×1,000”.</p>
      <LayerStack legend="Each step up is ×1,024 — call it ×1,000"
        caption="In interviews, round 2¹⁰ to 1,000. The 2–13% error never changes a design decision."
        layers={[
          { label: 'KB', sub: '2¹⁰ = 1,024 bytes', size: 0.2, value: '≈ 1 thousand' },
          { label: 'MB', sub: '2²⁰ = 1,048,576 bytes', size: 0.4, value: '≈ 1 million' },
          { label: 'GB', sub: '2³⁰ ≈ 1.07 billion bytes', size: 0.6, value: '≈ 1 billion', highlight: true },
          { label: 'TB', sub: '2⁴⁰ ≈ 1.1 trillion bytes', size: 0.8, value: '≈ 1 trillion' },
          { label: 'PB', sub: '2⁵⁰ ≈ 1.13 quadrillion bytes', size: 1, value: '≈ 1 quadrillion' },
        ]} />
      <p>Handy constants to memorize:</p>
      <ul>
        <li><strong>Seconds per day ≈ 86,400 ≈ 10⁵.</strong> So 1M requests/day ≈ 12 <Term def="Queries (requests) per second: the standard unit of load on a service.">QPS</Term>, and 1B/day ≈ 12K QPS.</li>
        <li><strong>A char is 1 byte</strong> (ASCII), a UUID 16 bytes binary (36 as text), a timestamp 8 bytes, a typical row with metadata a few hundred bytes.</li>
        <li><strong>A modern server</strong> has tens to hundreds of GB of RAM, around 10–25 Gbps networking, and <Term def="Fast solid-state drives attached over PCIe. They read and write gigabytes per second.">NVMe</Term> drives with GB/s throughput.</li>
      </ul>

      <H2 id="latency">Latency numbers every engineer should know</H2>
      <p>
        These numbers explain most design choices: why we cache, why we batch, and why we avoid cross-region round
        trips on the <Term def="The code path that runs on every user request, where every millisecond counts.">hot path</Term>.
      </p>
      <p>
        Peter Norvig first circulated them, Jeff Dean’s talks popularized them, and many people have updated them
        since (see References).
      </p>
      <EstimationLatencyVisualizer />
      <Callout kind="tip">
        Three ratios cover most interview reasoning: <strong>memory is about 1,000× faster than an SSD random read</strong>,
        an <strong>in-datacenter round trip costs roughly as much as a few SSD reads</strong>, and a <strong>cross-continent
        round trip is about 100–300× an in-DC one</strong>. That last ratio is why multi-region writes are expensive.
      </Callout>

      <H2 id="availability">Availability and the nines</H2>
      <p>
        Availability targets (“the nines”: 99.9%, 99.99%…) translate directly into allowed downtime. A request path
        with many dependencies is only as available as the <em>product</em> of its parts:
      </p>
      <EstimationNinesCalculator />
      <Callout kind="pitfall">
        Promising 99.99% on a service with eight 99.9% dependencies in series is mathematically impossible
        (0.999⁸ ≈ 99.2%). Either add redundancy, make dependencies optional with graceful degradation, or lower the
        target.
      </Callout>

      <H2 id="formulas">The core formulas</H2>
      <p>Six formulas cover almost every estimate you will be asked for. Each one is simple multiplication. The load chain is the one you will use most:</p>
      <FlowDiagram caption="From users to machines: every load estimate walks this chain" steps={[
        { label: 'DAU', sub: '× actions per user', icon: Users },
        { label: 'Requests / day', sub: '÷ 86,400 (≈ 10⁵)', icon: CalendarDays },
        { label: 'Avg QPS', sub: '× peak factor 2–5×', icon: Gauge },
        { label: 'Peak QPS', sub: '÷ QPS per server', icon: TrendingUp },
        { label: 'Servers', sub: '+ headroom for N+1', icon: Server },
      ]} />
      <CodeBlock lang="text" title="estimation cheat sheet" code={`
QPS (avg)      = daily requests / 86,400
Peak QPS       = avg QPS × peak factor (often 2–5×)
Storage / yr   = writes per day × 365 × bytes per record × replication factor
Bandwidth      = QPS × payload size          (compute ingress and egress separately)
Cache size     = hot fraction (e.g. 20%) × daily reads × payload
Servers        = peak QPS / sustainable QPS per server (+ headroom for N+1 / AZ loss)`} />

      <H2 id="calculator">Try it: the capacity calculator</H2>
      <p>Move the sliders and watch how each assumption flows through to servers, storage, and bandwidth.</p>
      <EstimationCapacityCalculator />

      <H2 id="worked-example">Worked example: a photo-sharing app</H2>
      <p>
        Here is the full method on one prompt. <Term def="Daily active users: distinct people who use the product on a given day.">DAU</Term> is
        the starting point for almost every estimate.
      </p>
      <EstimationTable
        assumptions={['500M DAU, 10% upload one photo per day', 'Average photo after compression: 2 MB, plus ~3 thumbnails ≈ 0.5 MB total', 'Each user views ~50 photos per day', 'Keep everything for 10 years, 3 replicas (or erasure coding at ~1.5×)']}
        rows={[
          { label: 'Uploads / day', math: '500M × 10%', result: '50M' },
          { label: 'Upload QPS', math: '50M / 86,400', result: '≈ 580/s' },
          { label: 'View QPS', math: '500M × 50 / 86,400', result: '≈ 290K/s' },
          { label: 'New storage / day', math: '50M × 2.5 MB', result: '125 TB' },
          { label: 'Storage / yr (3×)', math: '125 TB × 365 × 3', result: '≈ 137 PB' },
          { label: 'Egress (avg)', math: '290K/s × ~200 KB (feed-sized image)', result: '≈ 58 GB/s' },
        ]}
      />
      <StatRow caption="The four numbers that decide this design" stats={[
        { value: '≈ 580/s', label: 'upload QPS' },
        { value: '≈ 290K/s', label: 'view QPS', note: '500× the uploads' },
        { value: '≈ 137 PB', label: 'storage per year', note: 'with 3 replicas' },
        { value: '≈ 58 GB/s', label: 'average egress' },
      ]} />
      <p>
        Two conclusions fall out immediately. First, views dwarf uploads, so this is a <strong>CDN problem</strong>.
        The ~58 GB/s of <Term def="Data leaving your servers toward users. Cloud providers charge for it, so it is often the biggest bill.">egress</Term> must
        come from the edge. Second, keeping 137 PB in three copies is painful, so raise{' '}
        <strong><Term def="Storing data as fragments plus parity pieces, so it survives failures with about 1.5× overhead instead of 3×.">erasure coding</Term> and cold tiers</strong> for old photos.
      </p>

      <H2 id="staff">Estimation at staff level</H2>
      <p>The arithmetic is the same at every level. What changes is what you do with the result.</p>
      <Callout kind="staff">
        <p>Senior candidates compute numbers. Staff candidates <strong>use</strong> numbers to kill options and to talk about money:</p>
        <ul>
          <li>“12K writes/s fits comfortably on one well-tuned Postgres primary, so I won't shard on day one. I'd plan the partition key now so resharding later is mechanical.”</li>
          <li>“The working set is about 300 GB, which fits in a Redis cluster of a few nodes. Caching is cheap here, so I'd lean on it.”</li>
          <li>“At 58 GB/s of egress, the CDN bill dominates compute by an order of magnitude. Image format (AVIF/WebP) and resizing matter more than the service language.”</li>
        </ul>
        <p>They also sanity-check with a second method, top-down from DAU and bottom-up from per-server capacity, and call out which assumption, if wrong, changes the design.</p>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Estimate the storage needed for a Twitter-like service's tweets over 5 years."
        senior={<p>Say 300M DAU with 2 tweets a day, about 600M tweets/day. At roughly 300 bytes each that is 180 GB/day, about 66 TB/year, about 330 TB over 5 years. With 3× replication, about 1 PB.</p>}
        staff={<>
          <p>Same arithmetic, but I'd separate the <strong>text</strong> (~1 PB replicated, small enough for a sharded store) from <strong>media</strong>. If 10% of tweets carry a 1 MB image, that is 60 TB/day, over 300× the text. So media storage and CDN egress are the real cost drivers, not the tweet table.</p>
          <p>That split changes the design. Tweets go in a partitioned KV or relational store, media goes in object storage with lifecycle tiering, and the question “do we need to shard tweets?” becomes a capacity plan rather than a day-one requirement.</p>
        </>}
        followUps={['How does your estimate change if we keep edit history?', 'Which assumption is the most uncertain, and how would you validate it?']}
      />
      <InterviewQuestion
        q="How many servers do we need to serve 1M requests per second?"
        senior={<p>If each server handles around 10K QPS, we need 100 servers, plus some headroom, say 150.</p>}
        staff={<>
          <p>“Per-server QPS” hides the real question: <strong>what does a request cost?</strong> A cached read might be 50K QPS per core-heavy node, while a request fanning out to 5 services might be 500. I'd estimate from the dominant resource (CPU per request, memory for connections, or network bandwidth) and plan for peak, not average.</p>
          <p>Then I'd add headroom for losing an availability zone: with 3 AZs, each must absorb 50% more load, so provision about 1.5× peak, and keep utilization around 50–60% so latency doesn't spike as queues form near saturation.</p>
        </>}
        followUps={['Why does latency degrade sharply near 100% utilization?', 'How would autoscaling change this plan?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        '86,400 s/day ≈ 10⁵: 1M/day ≈ 12 QPS, 1B/day ≈ 12K QPS.',
        'Memorize latency ratios. RAM ≪ SSD ≪ in-DC RTT ≪ cross-region RTT, each step about 10–1000×.',
        'Availability multiplies along serial paths. Redundancy and graceful degradation are how you buy nines back.',
        'Always show the arithmetic, and separate ingress from egress and metadata from media.',
        'Staff signal: use the numbers to rule options out and to talk about cost.',
      ]} />
    </>
  )
}
