import {
  References,
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeNetflixPerTitleDemo } from './demos/episode-netflix-per-title-demo'
import { NETFLIX_STAGES } from './demos/episode-netflix-stages'

const PLAY_NODES: ArchNode[] = [
  { id: 'tv', label: 'TV app', kind: 'client', x: 10, y: 50 },
  { id: 'gw', label: 'Edge gateway', kind: 'lb', x: 30, y: 50 },
  { id: 'play', label: 'Playback API', kind: 'service', x: 52, y: 50,
    detail: 'Checks the subscription, device capabilities, and region rights. Then it assembles a manifest: available renditions, audio and subtitle tracks, and DRM info.' },
  { id: 'drm', label: 'License / DRM', kind: 'service', x: 52, y: 16, detail: 'Issues decryption keys bound to the device. Streams are encrypted at rest on every cache.' },
  { id: 'steer', label: 'Steering', kind: 'service', x: 76, y: 32, detail: 'Ranks candidate appliances by network proximity, health, and whether they hold the requested files.' },
  { id: 'oca', label: 'ISP appliance', sub: 'Open Connect', kind: 'cdn', x: 30, y: 86, detail: 'Serves segments from inside the member’s ISP, so most bytes never cross the wider internet.' },
  { id: 'hist', label: 'Viewing history', kind: 'db', x: 76, y: 72, detail: 'Heartbeats every few seconds record position, so “continue watching” works across devices.' },
]
const PLAY_EDGES: ArchEdge[] = [
  { from: 'tv', to: 'gw' }, { from: 'gw', to: 'play' }, { from: 'play', to: 'drm' }, { from: 'play', to: 'steer' },
  { from: 'tv', to: 'oca' }, { from: 'play', to: 'hist', async: true },
]

// Primary public sources behind the “In the real world” notes.
const REFS: Reference[] = [
  { title: "Completing the Netflix Cloud Migration", source: "Netflix", year: 2016, url: "https://about.netflix.com/en/news/completing-the-netflix-cloud-migration", kind: "blog", note: "AWS move: Aug 2008 → Jan 2016" },
  { title: "Per-Title Encode Optimization", source: "Netflix Technology Blog", year: 2015, url: "https://netflixtechblog.com/per-title-encode-optimization-7e99442b62a2", kind: "blog" },
  { title: "Dynamic optimizer — a perceptual video encoding optimization framework", source: "Netflix Technology Blog", url: "https://netflixtechblog.com/dynamic-optimizer-a-perceptual-video-encoding-optimization-framework-e19f1e3a277f", kind: "blog", note: "shot-based encoding" },
  { title: "Open Connect Overview (PDF)", source: "Netflix", url: "https://openconnect.netflix.com/Open-Connect-Overview.pdf", kind: "docs", note: "initiative began in 2011" },
  { title: "Open Connect Appliances", source: "Netflix", url: "https://openconnect.netflix.com/en/appliances/", kind: "docs" },
  { title: "The Netflix Simian Army", source: "Netflix Technology Blog", year: 2011, url: "https://netflixtechblog.com/the-netflix-simian-army-16e57fbab116", kind: "blog", note: "Chaos Monkey" },
  { title: "Project Nimble: Region Evacuation Reimagined", source: "Netflix Technology Blog", year: 2018, url: "https://netflixtechblog.com/project-nimble-region-evacuation-reimagined-d0d0568254d4", kind: "blog" },
  { title: "Zuul (edge gateway)", source: "Netflix OSS on GitHub", url: "https://github.com/Netflix/zuul", kind: "docs" },
  { title: "Eureka (service discovery)", source: "Netflix OSS on GitHub", url: "https://github.com/Netflix/eureka", kind: "docs" },
  { title: "Hystrix (now in maintenance mode) and EVCache", source: "Netflix OSS on GitHub", url: "https://github.com/Netflix/Hystrix", kind: "docs" },
]

export default function NetflixEpisode() {
  return (
    <>
      <p>
        Netflix is two companies in one. A <strong>control plane</strong> decides what you can watch and what to show
        you: thousands of microservices on a public cloud. A <strong>data plane</strong> moves the actual video bytes,
        and it runs mostly on Netflix’s own hardware sitting inside internet providers. This episode builds that system
        from a single server, one bottleneck at a time.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Step through the stages below. At each stage, predict what breaks next <em>before</em> clicking. That habit
        is exactly what a system design interviewer is testing.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Netflix; all trademarks belong to their owners.</em></p>

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={NETFLIX_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <EstimationTable
        assumptions={['~250M+ member accounts (order of magnitude)', 'Evening peak ≈ 10% of members streaming', 'Average stream ≈ 5 Mbps (mix of SD/HD/4K)']}
        rows={[
          { label: 'Peak concurrent streams', math: '250M × 10%', result: '≈ 25M' },
          { label: 'Peak egress', math: '25M × 5 Mbps', result: '≈ 125 Tbps' },
          { label: 'Control-plane QPS', math: 'browse + heartbeats + events', result: 'millions/s' },
          { label: 'Bytes vs API ratio', math: 'segments ≫ JSON', result: '≫ 1000:1' },
        ]}
      />
      <p>
        That last row is the whole story. When bytes outweigh API traffic by orders of magnitude, they need a different
        architecture, a different cost model, and eventually a different company-sized investment (a private CDN).
      </p>

      <H2 id="press-play">What happens when you press Play</H2>
      <ArchitectureDiagram nodes={PLAY_NODES} edges={PLAY_EDGES} height={380}
        caption="Control plane (cloud) hands off to data plane (ISP appliances) within a second or two"
        flows={[
          { name: 'Start playback', path: ['tv', 'gw', 'play', 'steer'], steps: ['TV requests a playback session', 'Gateway authenticates and routes', 'Playback API builds the manifest and asks steering for the best appliances'] },
          { name: 'License', path: ['tv', 'gw', 'play', 'drm'], steps: ['Player needs keys', 'Routed to playback', 'DRM service issues a device-bound license'] },
          { name: 'Stream', path: ['tv', 'oca'], steps: ['Player fetches segments from the in-ISP appliance, adapting bitrate as bandwidth changes'] },
        ]} />

      <H2 id="per-title">Deep dive: per-title encoding</H2>
      <p>
        A fixed bitrate ladder wastes bits on simple content and starves complex content. Encoding each title (and
        later each <em>shot</em>) at the bitrates it actually needs means the same quality at fewer bits. Every bit
        saved is multiplied across every stream on every night.
      </p>
      <EpisodeNetflixPerTitleDemo />

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Video delivery', cells: ['Own CDN inside ISPs', 'Commercial CDN', 'Catalog is known ahead of time, so off-peak pre-fill works and cost at scale drops'] },
          { label: 'Control plane', cells: ['Microservices on public cloud', 'Own data centers', 'Elasticity for spiky launches; the heavy bytes are elsewhere anyway'] },
          { label: 'Viewing data', cells: ['Wide-column (Cassandra)', 'Sharded SQL', 'Write-heavy, time-ordered per member, multi-region replication'] },
          { label: 'Resilience', cells: ['Chaos engineering + regional evacuation', 'Only redundancy on paper', 'Failure paths get exercised, not assumed'] },
          { label: 'Home page', cells: ['Precomputed + online re-rank', 'Fully online ranking', 'Bounded latency on TVs; freshness from light re-ranking'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Separate planes, separate economics.</strong> Scale and cost-model bytes and API calls independently. Mixing them is the root mistake of v0.</li>
          <li><strong>Build vs buy at a threshold.</strong> A private CDN is wrong at 1M members and right at 100M+. Say where the crossover is and what you would measure (egress cost/GB, rebuffer rate, ISP congestion).</li>
          <li><strong>Degrade gracefully.</strong> If personalization is down, show a popular-titles fallback. Never block <em>playback</em> on non-critical services.</li>
          <li><strong>Test failure continuously.</strong> Regional evacuation that is never practiced does not exist.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="Why would a streaming company build its own CDN instead of paying Akamai or CloudFront?"
        senior={<p>Cost at scale and more control over performance. Placing servers closer to users reduces latency and bandwidth costs.</p>}
        staff={<>
          <p>Because streaming breaks the assumptions a generic CDN is priced for. The catalog is finite and demand is predictable, so you can <strong>pre-position</strong> content off-peak rather than cache on demand. Placing appliances <em>inside</em> ISPs also helps the ISP, since traffic stays off their transit links. That makes partnerships possible.</p>
          <p>I would only recommend it past a clear threshold: when egress spend dwarfs the capex plus ops of a hardware fleet, and when quality metrics (rebuffering, startup time) are limited by the middle mile. Below that, a multi-CDN strategy with steering is the pragmatic answer.</p>
        </>}
        followUps={['How do you decide what to pre-fill on each appliance?', 'What happens when an appliance is missing a file?', 'How do you steer clients when an ISP link is congested?']}
      />
      <InterviewQuestion
        q="The recommendations service is down. What should the Netflix home page do?"
        senior={<p>Use a cached version of the page or show an error with retry. Add a circuit breaker so it doesn’t cascade.</p>}
        staff={<>
          <p>Serve a <strong>degraded but useful</strong> experience. Show the last precomputed page from cache if it’s recent. Otherwise show region-level popular rows, which are cheap and global. Circuit-break the dependency with a tight timeout so home-page latency stays flat.</p>
          <p>Crucially, playback, search, and “continue watching” must not depend on it at all. I’d audit the dependency graph so every non-critical call has a fallback, and verify it with fault injection rather than trusting the design doc.</p>
        </>}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Split the control plane (small, smart, cloud) from the data plane (huge, dumb, close to users).',
        'Encode once, deliver billions of times: per-title and per-shot encoding pay off enormously at scale.',
        'A private CDN inside ISPs makes sense only because the catalog is known and the scale is extreme.',
        'Precompute personalization for predictable latency; degrade to popular rows when it fails.',
        'Resilience is a practice: active-active regions, evacuation drills, chaos engineering.',
      ]} />
    </>
  )
}
