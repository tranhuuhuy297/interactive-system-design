import {
  Callout, CompareTable, H2, InterviewQuestion, KeyTakeaways, References, TLDR, Tabs, Term,
} from '../components/ui'
import type { Reference } from '../components/ui'
import { ScalingEvolutionStepper } from './demos/scaling-evolution-stepper'
import { ScalingSaturationSimulator } from './demos/scaling-saturation-simulator'

const REFS: Reference[] = [
  { title: "System Design Interview – An Insider’s Guide (Vol. 1)", source: "Alex Xu", year: 2020, kind: "book", note: "Its first chapter is the classic version of this progression; the stages, bottleneck analysis and simulations here are our own" },
  { title: "Designing Data-Intensive Applications", source: "Martin Kleppmann (O’Reilly)", year: 2017, url: "https://dataintensive.net/", kind: "book" },
  { title: "The Twelve-Factor App: Processes (stateless services)", source: "Adam Wiggins et al.", url: "https://12factor.net/processes", kind: "docs" },
  { title: "Caching challenges and strategies", source: "Amazon Builders’ Library", url: "https://aws.amazon.com/builders-library/caching-challenges-and-strategies/", kind: "blog" },
  { title: "Static stability using Availability Zones", source: "Amazon Builders’ Library", url: "https://aws.amazon.com/builders-library/static-stability-using-availability-zones/", kind: "blog" },
  { title: "RFC 9111: HTTP Caching", source: "IETF", year: 2022, url: "https://www.rfc-editor.org/rfc/rfc9111", kind: "rfc", note: "How CDNs and browsers cache" },
]

export default function ScaleZeroToMillionsChapter() {
  return (
    <>
      <p>
        Almost every large system started as a single server. Ambition does not turn it into a distributed system.
        A sequence of <strong>bottlenecks</strong> does, and each one forces one specific change with one specific cost.
      </p>
      <TLDR items={[
        'Scaling is a story: each stage exists because a specific bottleneck forced it.',
        'Scale up first. Scale out stateless tiers freely. Shard data last.',
        'Stateless servers make load balancing, autoscaling, and deploys easy.',
        'Latency climbs sharply as a component gets busy, so plan for about 60% utilization at peak.',
      ]} />
      <p>
        If you can tell that story fluently (which stage, which pain, which fix, what it cost), you can reason about
        almost any design prompt from first principles.
      </p>
      <p>
        This single-server-to-global progression is a classic way to teach scaling. Alex Xu’s <em>System Design
        Interview</em> opens with a well-known version of it (see References). The stages, bottleneck analysis, and
        simulations here are this handbook’s own.
      </p>

      <H2 id="evolution">The evolution, stage by stage</H2>
      <p>Step through the stages. At each one, ask yourself what will break next before you click.</p>
      <ScalingEvolutionStepper />
      <Callout kind="tip">
        In an interview, <strong>start near the stage the requirements imply</strong>, not at stage one. For 100M DAU
        you begin with a stateless tier, caching, and replication already in place, and you spend your time on what
        is unique to the problem.
      </Callout>

      <H2 id="vertical-vs-horizontal">Vertical vs horizontal scaling</H2>
      <p>There are only two ways to add capacity: a bigger machine, or more machines. Each has a different ceiling.</p>
      <CompareTable columns={['Vertical (scale up)', 'Horizontal (scale out)']} rows={[
        { label: 'How', cells: ['Bigger machine: more CPU, RAM, faster disks', 'More machines behind a load balancer'] },
        { label: 'Ceiling', cells: ['Hard limit: the biggest instance you can buy', 'Practically unbounded if the tier is stateless'] },
        { label: 'Complexity', cells: ['Near zero, since code does not change', 'Needs stateless design, discovery, coordination'] },
        { label: 'Failure', cells: ['Still a single point of failure', 'Losing one node loses 1/N of capacity'] },
        { label: 'Sweet spot', cells: ['Databases early on, and anything hard to shard', 'Web/API tiers, workers, caches'] },
      ]} />
      <p>
        Vertical scaling is underrated. One modern database server with hundreds of GB of RAM and NVMe storage
        handles far more than most startups ever need. Scale up <strong>until the next step up is too expensive
        or too risky</strong>. Meanwhile, design your keys so scaling out later is possible.
      </p>

      <H2 id="stateless">Why statelessness unlocks everything</H2>
      <p>
        A <Term def="A server that keeps no user data in its own memory between requests, so any copy of it can handle any request.">stateless</Term> server
        keeps nothing between requests that another server would need. Sessions, uploads in progress, and
        rate-limit counters live in shared stores instead.
      </p>
      <p>
        The payoff: the load balancer can route anywhere, autoscaling can add and remove instances freely, and
        deploys become <Term def="Replacing servers a few at a time, so the service stays up during a release.">rolling restarts</Term> instead of events.
      </p>
      <Callout kind="pitfall">
        Sticky sessions look like a shortcut, but they bring back state through the side door. Load becomes uneven,
        a node failure logs users out, and scale-in has to wait for sessions to drain. Use them only for genuinely
        connection-oriented workloads like WebSockets, and even then keep the state recoverable.
      </Callout>

      <H2 id="saturation">Finding the bottleneck</H2>
      <p>
        Every tier has a capacity. The whole system can only go as fast as its <strong>tightest tier, relative to
        the share of traffic it sees</strong>.
      </p>
      <p>
        Latency degrades well before that limit. <Term def="The math of waiting lines. It predicts how wait time grows as a server gets busier.">Queueing theory</Term> says
        waiting time grows roughly as 1 / (1 − utilization). A component that is 90% busy is already about 10×
        slower than when idle.
      </p>
      <ScalingSaturationSimulator />

      <H2 id="data-tier">Scaling the data tier: the real work</H2>
      <p>
        Stateless tiers are easy to copy. Data is not, which is why the data tier is where most scaling effort goes.
        The right move depends on whether reads, writes, or geography is the pressure.
      </p>
      <Tabs items={[
        { label: 'Read-heavy', content: (
          <ul>
            <li><strong>Cache</strong> hot objects (cache-aside), usually the cheapest 10× you'll ever buy.</li>
            <li><strong>Read replicas</strong> scale reads linearly. Watch replication lag and route read-your-writes to the primary.</li>
            <li><strong>Denormalized read models</strong> (materialized views, search indexes) fed by change data capture.</li>
          </ul>
        ) },
        { label: 'Write-heavy', content: (
          <ul>
            <li><strong>Batch and buffer</strong> writes through a queue to smooth spikes.</li>
            <li><strong>Log-structured stores</strong> (LSM-based: Cassandra, RocksDB) absorb high write rates.</li>
            <li><strong>Shard</strong> when one primary's write throughput or disk is exhausted. Choose the key by access pattern.</li>
          </ul>
        ) },
        { label: 'Global', content: (
          <ul>
            <li><strong>Active-passive</strong>: one region takes writes, the others serve reads and stand by. Simple, but failover is a big event.</li>
            <li><strong>Active-active</strong>: every region takes writes. Needs conflict resolution (CRDTs, last-write-wins, or per-user home regions).</li>
            <li><strong>Partition by geography</strong>: EU users live in the EU region. This also solves data residency.</li>
          </ul>
        ) },
      ]} />

      <H2 id="staff">Staff lens: scaling the organization too</H2>
      <p>Every stage costs money and on-call time, so knowing when <em>not</em> to add one is part of the skill.</p>
      <Callout kind="staff">
        <p>At staff level the question is not only “what breaks next?” but “<strong>what should we build now, and what should we deliberately defer?</strong>”</p>
        <ul>
          <li><strong>Irreversible vs reversible decisions</strong>: the shard key, ID format, and public API shape are expensive to change, so decide them early. Adding a cache or replica is cheap, so defer it until metrics say so.</li>
          <li><strong>Cost curve</strong>: each stage adds recurring spend and on-call surface. Tie each one to a metric trigger (“add replicas when primary CPU is above 60% at peak”).</li>
          <li><strong>Team topology</strong>: splitting services too early creates coordination overhead. Split along team and ownership boundaries, not boxes on a diagram.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Your single-database app is slowing down at 50K users. Walk me through what you'd do."
        senior={<p>Add caching for frequent reads, add read replicas, make the web tier stateless behind a load balancer, and eventually shard the database if writes grow.</p>}
        staff={<>
          <p>First I'd <strong>measure</strong> before adding boxes. Is it CPU, I/O, locks, or a few bad queries? At 50K users the most common culprit is missing indexes or N+1 queries. Fixing those is hours of work and often buys 10×.</p>
          <p>If load is genuinely the problem I'd take the cheapest step with the best ratio: vertical scaling of the DB, then a cache for the hottest read paths, then replicas with explicit handling for read-your-writes. Sharding is a last resort at this size because it permanently taxes every feature.</p>
        </>}
        followUps={['How would you tell a query problem from a capacity problem?', 'What would make you shard early?']}
      />
      <InterviewQuestion
        q="Why is it risky to go multi-region, and when is it worth it?"
        senior={<p>Cross-region replication adds latency and consistency problems. It's worth it for disaster recovery and lower latency for global users.</p>}
        staff={<>
          <p>The risk is concentrated in <strong>writes</strong>. Synchronous cross-region writes add 70–150 ms+ per commit, and async replication means a failover can lose recent writes (RPO &gt; 0) or produce conflicts in active-active setups. There is also operational risk: failover paths that are rarely exercised tend not to work when needed.</p>
          <p>It is worth it when an SLO or regulation demands it: a region-level RTO the business can't tolerate, data residency laws, or latency-sensitive global users. A good middle ground is multi-region reads with a single write region, with <strong>regular failover drills</strong> so the DR plan actually works.</p>
        </>}
        followUps={['What are RPO and RTO for your design?', 'How do you avoid split-brain during failover?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Every scaling step is forced by a specific bottleneck and has a specific cost. Tell it as a story.',
        'Scale up first, scale out stateless tiers freely, and shard data last.',
        'Stateless servers enable load balancing, autoscaling, and painless deploys.',
        'Latency degrades as 1/(1−utilization), so plan capacity for about 60% at peak.',
        'Staff signal: separate irreversible decisions (keys, IDs, APIs) from cheap, deferrable ones.',
      ]} />
    </>
  )
}
