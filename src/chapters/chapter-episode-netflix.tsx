import {
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, MentalModel, References, SideBySide, StatRow, Term, TLDR, VisualTimeline,
} from '../components/ui'
import { Activity, Cloud, Film, Globe, HardDrive, Play, Radio, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeNetflixPerTitleDemo } from './demos/episode-netflix-per-title-demo'
import { S } from './demos/episode-netflix-stage-library'
import { NETFLIX_STAGES } from './demos/episode-netflix-stages'

const PLAY_NODES: ArchNode[] = [
  { id: 'tv', label: 'TV app', kind: 'client', x: 10, y: 50 },
  { id: 'gw', label: 'Edge gateway', kind: 'lb', x: 28, y: 50 },
  { id: 'play', label: 'Playback API', kind: 'service', x: 50, y: 50,
    detail: 'Checks the account, the device, and licensing for the member’s country. Then it picks the files this device needs: renditions, audio, subtitles.' },
  { id: 'drm', label: 'License / DRM', kind: 'service', x: 50, y: 16, detail: 'Issues decryption keys bound to the device. The video files themselves are encrypted.' },
  { id: 'steer', label: 'Steering', kind: 'service', x: 76, y: 32, detail: 'Uses what each cache reports (health, routes, stored files) to pick the best caches, and returns URLs for them.' },
  { id: 'oca', label: 'ISP cache', sub: 'Open Connect', kind: 'cdn', x: 28, y: 86, detail: 'Serves video from inside the member’s ISP. It stores files only, never member data.' },
  { id: 'hist', label: 'Viewing history', kind: 'db', x: 76, y: 72, detail: 'Frequent heartbeats record your position, so “continue watching” works on any device.' },
]
const PLAY_EDGES: ArchEdge[] = [
  { from: 'tv', to: 'gw' }, { from: 'gw', to: 'play' }, { from: 'play', to: 'drm' }, { from: 'play', to: 'steer' },
  { from: 'tv', to: 'oca' }, { from: 'play', to: 'hist', async: true },
]

const REFS: Reference[] = [
  S.watchNow, S.migration, S.cassandra, S.ocOverview, S.simian, S.hystrix, S.apiDifferences, S.christmas,
  S.activeActive, S.chaosKong, S.kafka, S.iceberg, S.global, S.perTitle, S.dynOpt, S.av1Android, S.artwork,
  S.adsLaunch, S.adsInHouse, S.live1, S.liveOrigin, S.tyson,
]

export default function NetflixEpisode() {
  return (
    <>
      <TLDR items={[
        'Netflix is two systems: a cloud “control plane” that decides what you see, and a “data plane” that moves video bytes.',
        'A 2008 database failure pushed Netflix onto AWS, rebuilt as many small services that assume failure.',
        'Video comes from Netflix’s own caches inside internet providers, filled overnight because the catalog is known.',
        'Encoding is tuned per title and per shot, so every stream uses fewer bits.',
        'Recent chapters: global launch, personalization, an ads plan, and live events at tens of millions of streams.',
      ]} />
      <MentalModel id="ep-netflix" />

      <p>
        Netflix splits its work in two. The <strong>control plane</strong> runs on AWS. It handles sign-in, browsing,
        recommendations, and the decision of where to stream from. The <strong>data plane</strong> is the video itself. It
        mostly comes from Netflix’s own servers placed inside internet providers.
      </p>
      <p>
        This episode follows that system from a single web app in 2007 to live events in 2025. Each stage starts with a
        real problem and ends with the decision it forced.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Step through the stages below. Before clicking Next, guess what breaks. Open <strong>Go deeper</strong> for the
        request walk-through, numbers, alternatives, and sources.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Netflix; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <VisualTimeline items={[
        { when: '2007', title: 'Streaming launches beside DVDs', note: 'Test demand with minimal new systems', icon: Play },
        { when: '2008', title: 'Database corruption stops shipping for 3 days', note: 'Triggers the move to the cloud', icon: ShieldAlert },
        { when: '2009–2011', title: 'Rebuilt as services on AWS, Cassandra', note: 'Scale out, no single database', icon: Cloud },
        { when: '2011–2012', title: 'Open Connect caches inside ISPs', note: 'Video is most of the bytes', icon: HardDrive },
        { when: '2011–2013', title: 'Hystrix, Chaos Monkey, per-device APIs, multi-region', note: 'Everything fails; devices differ', icon: ShieldCheck },
        { when: '2015–2018', title: 'Chaos Kong drills, Keystone data pipeline, Iceberg', note: 'Prove failover; data for every team', icon: Activity },
        { when: '2016', title: '130+ countries in one day', note: 'Cloud capacity made it possible', icon: Globe },
        { when: '2015–2021', title: 'Per-title and per-shot encoding, AV1', note: 'Fewer bits at equal quality', icon: Film },
        { when: '2022–2025', title: 'Ads plan, live events', note: 'New business models, new traffic shapes', icon: Radio },
      ]} />

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={NETFLIX_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <StatRow caption="Rough estimates from the assumptions below, not Netflix figures" stats={[{ value: '≈ 30M', label: 'peak concurrent streams', note: 'estimate' }, { value: '≈ 150 Tbps', label: 'peak video egress', note: 'estimate' }, { value: '≫ 1000 : 1', label: 'video bytes vs API bytes', note: 'estimate' }]} />
      <EstimationTable
        assumptions={['~300M member accounts (order of magnitude, estimate)', 'Evening peak ≈ 10% of members streaming (estimate)', 'Average stream ≈ 5 Mbps across SD/HD/4K (estimate)']}
        rows={[
          { label: 'Peak concurrent streams', math: '300M × 10%', result: '≈ 30M' },
          { label: 'Peak video egress', math: '30M × 5 Mbps', result: '≈ 150 Tbps' },
          { label: 'Control-plane traffic', math: 'browse + heartbeats + events', result: 'millions of req/s' },
          { label: 'Bytes: video vs API', math: 'segments ≫ JSON', result: '≫ 1000 : 1' },
        ]}
      />
      <p>
        The last row explains most of the design. Video bytes outweigh API calls by orders of magnitude, so they get their
        own network, cost model, and team. These are rough estimates, not Netflix figures.
      </p>

      <H2 id="press-play">What happens when you press Play</H2>
      <ArchitectureDiagram nodes={PLAY_NODES} edges={PLAY_EDGES} height={380}
        caption="The cloud decides; the ISP cache delivers"
        flows={[
          { name: 'Start playback', path: ['tv', 'gw', 'play', 'steer'], steps: ['The TV asks to play a title', 'The edge authenticates and routes', 'Playback picks files; steering picks caches and returns URLs'] },
          { name: 'License', path: ['tv', 'gw', 'play', 'drm'], steps: ['The player needs keys', 'The request is routed to playback', 'DRM issues a license bound to this device'] },
          { name: 'Stream', path: ['tv', 'oca'], steps: ['The player streams from the ISP cache and adapts quality to bandwidth'] },
        ]} />
      <p>
        Playback uses <Term def="Adaptive bitrate streaming: the player switches between quality levels every few seconds based on measured bandwidth.">adaptive bitrate</Term>.
        The video is split into short segments at several qualities, and the player picks one segment at a time.
      </p>

      <H2 id="per-title">Deep dive: per-title encoding</H2>
      <p>
        A <Term def="The list of (resolution, bitrate) pairs a title is encoded at. The player picks among them.">bitrate ladder</Term> used
        to be the same for every title. Simple animation got too many bits and busy action scenes got too few.
      </p>
      <p>
        Tuning the ladder per title, and later per shot, keeps quality the same with fewer bits. Each saved bit is multiplied
        across every stream, every night.
      </p>
      <EpisodeNetflixPerTitleDemo />

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <p>The three decisions that shaped Netflix most:</p>
      <SideBySide panels={[
        { title: 'Own caches inside ISPs', icon: HardDrive, tone: 'good', points: ['+ Known catalog allows off-peak fill', '+ Cheaper at huge scale', '- Instead of: a commercial CDN'], verdict: 'Video delivery' },
        { title: 'Services on AWS', icon: Cloud, tone: 'good', points: ['+ Elastic capacity', '+ The heavy bytes live elsewhere', '- Instead of: own data centers'], verdict: 'Control plane' },
        { title: 'Chaos drills + active-active', icon: ShieldCheck, tone: 'good', points: ['+ Failure paths get exercised, not assumed', '- Instead of: redundancy on paper'], verdict: 'Resilience' },
      ]} />
      <p>Other decisions, in brief:</p>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Member data', cells: ['Cassandra', 'Sharded SQL', 'Write-heavy, per member, replicated across regions'] },
          { label: 'Device APIs', cells: ['Per-device adapters', 'One generic REST API', 'Fewer round trips on slow devices'] },
          { label: 'Home screen', cells: ['Precomputed + cached', 'Fully online ranking', 'Predictable latency on TVs'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Separate planes, separate economics.</strong> Scale bytes and API calls independently. Mixing them was the v0 mistake.</li>
          <li><strong>Build vs buy has a threshold.</strong> A private CDN is wrong at 1M members and right at 100M+. Say what you would measure: egress cost, rebuffering, ISP congestion.</li>
          <li><strong>Degrade, don’t fail.</strong> If personalization is down, show popular rows. Never block playback on non-critical services.</li>
          <li><strong>Practice failure.</strong> A failover that is never exercised does not exist.</li>
          <li><strong>Live changes the rules.</strong> No pre-fill and a synchronized crowd: design for redundancy, not cache hit rate.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="Why would a streaming company build its own CDN instead of paying a commercial one?"
        senior={<p>Cost at scale and more control. Servers closer to users reduce latency and bandwidth costs.</p>}
        staff={<>
          <p>Because on-demand streaming breaks generic CDN assumptions. The catalog is finite and demand is predictable, so you can <strong>push</strong> content off-peak instead of caching on demand. Caches inside ISPs also keep traffic off their transit links, which makes partnerships attractive.</p>
          <p>I would recommend it only past a threshold: when egress spend dwarfs the cost of running a hardware fleet, and quality is limited by the middle mile. Below that, use several CDNs with steering.</p>
        </>}
        followUps={['How do you decide what to pre-fill on each cache?', 'What if a cache is missing a file?', 'How does this change for live events?']}
      />
      <InterviewQuestion
        q="The recommendations service is down. What should the Netflix home page do?"
        senior={<p>Serve a cached page or show an error with retry. Add a circuit breaker so it doesn’t cascade.</p>}
        staff={<>
          <p>Serve a <strong>degraded but useful</strong> page. Use the last cached page if it is recent, otherwise popular rows by region. Keep a tight timeout so the home page stays fast.</p>
          <p>Playback, search, and “continue watching” must not depend on it at all. I would audit dependencies for fallbacks and verify them with fault injection.</p>
        </>}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Split the control plane (cloud services) from the data plane (video caches near users).',
        'Remove single points of failure, then practice losing instances, dependencies, and whole regions.',
        'A private CDN inside ISPs works because the catalog is known and the scale is extreme.',
        'Encode once, deliver millions of times: per-title and per-shot encoding pay off.',
        'Live events need redundancy and fast failover, because nothing can be pre-filled.',
      ]} />
    </>
  )
}
