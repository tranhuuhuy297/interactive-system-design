import {
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, MentalModel, References, SideBySide, StatRow, Term, TLDR, VisualTimeline,
} from '../components/ui'
import {
  Blocks, Cloud, Download, HardDrive, ListChecks, ListMusic, Podcast, Radio, Search, Share2, Sparkles, Unplug,
} from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeSpotifyInstantStartDemo } from './demos/episode-spotify-instant-start-demo'
import { SPOTIFY_STAGES } from './demos/episode-spotify-stages'
import { SRC } from './demos/episode-spotify-stage-nodes'

const PLAY_NODES: ArchNode[] = [
  { id: 'app', label: 'Phone app', sub: 'local cache', kind: 'client', x: 10, y: 50,
    detail: 'The client does a lot of the work: it caches metadata, audio chunks, and keys, prefetches the likely next track, and buffers events while offline.' },
  { id: 'ap', label: 'Access point', kind: 'lb', x: 30, y: 50, detail: 'A long-lived connection to a nearby gateway, so each new request skips connection setup.' },
  { id: 'meta', label: 'Metadata', sub: 'track → files', kind: 'service', x: 52, y: 20,
    detail: 'Resolves a track id to available files and bitrates for this market and this device. Very cacheable.' },
  { id: 'keys', label: 'Key service', kind: 'service', x: 52, y: 50, detail: 'Returns a decryption key bound to the user and device. Offline keys carry an expiry, so the app must check in periodically.' },
  { id: 'events', label: 'Event delivery', kind: 'queue', x: 52, y: 82, detail: 'Accepts batched play events with unique ids; downstream counting deduplicates on those ids.' },
  { id: 'cdn', label: 'CDN edge', kind: 'cdn', x: 76, y: 66, detail: 'Serves encrypted chunks. Because the bytes are useless without a key, they can be cached anywhere.' },
  { id: 'store', label: 'Audio origin', kind: 'storage', x: 88, y: 30, detail: 'Every track stored at several bitrates and codecs.' },
]
const PLAY_EDGES: ArchEdge[] = [
  { from: 'app', to: 'ap' }, { from: 'ap', to: 'meta' }, { from: 'ap', to: 'keys' }, { from: 'ap', to: 'events', async: true },
  { from: 'app', to: 'cdn' }, { from: 'cdn', to: 'store' },
]

// Primary public sources behind the episode (per-stage sources live in the Go deeper panels).
const REFS: Reference[] = [
  SRC.p2pPaper, SRC.p2pDrop, SRC.mobile, SRC.events1, SRC.events2, SRC.dw, SRC.gcpHistory, SRC.gcpDeal,
  SRC.squads, SRC.backstage, SRC.backstageCncf, SRC.audioFirst, SRC.audiobooks, SRC.nlSearch, SRC.royalties,
]

const TIMELINE = [
  ['2008', 'Desktop launch: servers + peer-to-peer delivery'],
  ['2009', 'iPhone and Android apps with offline playlists'],
  ['2014', 'Peer-to-peer delivery phased out'],
  ['2015', 'Discover Weekly ships as a personal playlist'],
  ['2016', 'Event delivery at 700K+ events/s; Google Cloud move announced'],
  ['2017–2018', 'Traffic fully on GCP; last data center closed'],
  ['2019', 'Podcast push: Gimlet and Anchor acquired'],
  ['2020', 'Backstage open-sourced, then joins the CNCF Sandbox'],
  ['2022', 'Semantic podcast search; audiobooks launch in the U.S.'],
] as const

const TIMELINE_ICONS = [Share2, Download, Unplug, Sparkles, Radio, Cloud, Podcast, Blocks, Search]

export default function SpotifyEpisode() {
  return (
    <>
      <TLDR items={[
        <>Play must feel instant. Most of the speed comes from the <strong>client</strong>: warm connections, local cache, prefetch.</>,
        <>Audio bytes are encrypted and cacheable anywhere. Rights live in a small <strong>key service</strong>.</>,
        <>Every play is an <strong>event</strong>. Counts feed charts, experiments, and payouts, so they need unique ids and dedupe.</>,
        <>New features ride old rails: recommendations ship as <strong>ordinary playlists</strong>.</>,
        <>At scale, the hard problems become organizational: cloud migration and a <strong>service catalog</strong> for hundreds of teams.</>,
      ]} />
      <MentalModel id="ep-spotify" />
      <p>
        Spotify’s hardest problem is not storing music. It is making play <strong>feel instant</strong> on a flaky
        phone network. Then it must <strong>count every play correctly</strong>, because those counts drive charts
        and payouts.
      </p>
      <p>
        This episode follows public sources from the 2008 desktop client to a cloud platform serving music,
        podcasts, and audiobooks. Each stage has a <strong>Go deeper</strong> panel with a walkthrough, numbers,
        alternatives, and sources.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Before each click, name the next bottleneck. Notice how often the answer is “do it on the client” or “reuse
        a system you already built”.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Spotify; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <VisualTimeline items={TIMELINE.map(([year, what], i) => ({ when: year, title: what, icon: TIMELINE_ICONS[i] }))} />

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={SPOTIFY_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <StatRow caption="Two estimates from the assumptions below and one published figure" stats={[{ value: '≈ 6B', label: 'plays per day', note: 'estimate' }, { value: '≈ 3.8 Tbps', label: 'peak audio egress', note: 'estimate' }, { value: '700K+ / s', label: 'client events', note: 'Spotify-reported, 2016' }]} />
      <EstimationTable
        assumptions={[
          '~600M monthly active users (publicly reported order of magnitude, 2024)',
          'Assume 40% active daily, ~25 plays per daily user',
          '160 kbps typical stream; assume 10% of daily users listening at peak',
          'Assume ~10 client events per play (start, progress, skip, seek…)',
        ]}
        rows={[
          { label: 'Plays per day', math: '600M × 40% × 25', result: '≈ 6B' },
          { label: 'Average play rate', math: '6B / 86,400 s', result: '≈ 70K/s' },
          { label: 'Peak listeners', math: '240M × 10%', result: '≈ 24M' },
          { label: 'Peak egress', math: '24M × 160 kbps', result: '≈ 3.8 Tbps' },
          { label: 'Client events', math: '6B × 10', result: '≈ 60B/day ≈ 700K/s' },
          { label: 'One track (3.5 min)', math: '160 kbps × 210 s / 8', result: '≈ 4 MB' },
        ]}
      />
      <p>
        Two things stand out. Audio is <strong>small per stream but huge in total</strong>, which suits a{' '}
        <Term def="Content delivery network: caches spread around the world that serve files from close to the user.">CDN</Term>.
        And the event stream is ten times bigger than the play rate, and it carries money. The estimate lines up
        with Spotify’s own 2016 figure of more than 700,000 events per second.
      </p>

      <H2 id="press-play">What happens when you tap a track</H2>
      <ArchitectureDiagram nodes={PLAY_NODES} edges={PLAY_EDGES} height={380}
        caption="Most of the speed comes from the client: warm connections, cached keys, prefetched chunks"
        flows={[
          { name: 'Resolve', path: ['app', 'ap', 'meta'], steps: ['App sends the track id over its open connection', 'Metadata returns file ids and bitrates for this market'] },
          { name: 'Key', path: ['app', 'ap', 'keys'], steps: ['App asks for a key (often already cached)', 'Key service checks entitlement and returns a device-bound key'] },
          { name: 'Stream', path: ['app', 'cdn', 'store'], steps: ['App fetches encrypted chunks from the nearest edge', 'Edge miss goes to origin once, then serves everyone nearby'] },
          { name: 'Report', path: ['app', 'ap', 'events'], steps: ['App batches play events with unique ids', 'Events are persisted for analytics and royalties'] },
        ]} />

      <H2 id="instant-start">Deep dive: making play feel instant</H2>
      <p>
        Time to first sound is a sum of <Term def="One message to a server and its reply. On mobile networks it often takes tens to hundreds of milliseconds.">round trips</Term> plus
        one small download. The winning moves remove round trips instead of speeding them up.
      </p>
      <p>
        Try it below. A random jump can’t be prefetched, so warm connections and cached keys still matter.
      </p>
      <EpisodeSpotifyInstantStartDemo />
      <Callout kind="tip">
        A small low-bitrate first chunk trades a moment of lower quality for a faster start. Players then step up to
        the normal bitrate within seconds, and most listeners never notice.
      </Callout>

      <H2 id="counting">Deep dive: counting plays you pay money on</H2>
      <p>
        Play events arrive late (offline listening), twice (client retries), or out of order. So the pipeline uses
        <strong> at-least-once delivery plus idempotent counting</strong>.
      </p>
      <ul>
        <li>Deduplicate on a client-generated event id.</li>
        <li>Aggregate on <Term def="The time the play happened on the device, not when the server received it.">event time</Term>, not arrival time.</li>
        <li>Close a reporting period only after a lateness window.</li>
        <li>Define what counts as a “stream” once, in one versioned place. It is a business policy, not a job detail.</li>
      </ul>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <p>The three decisions behind instant play and correct payouts:</p>
      <SideBySide panels={[
        { title: 'Encrypted chunks on a CDN + key service', icon: HardDrive, tone: 'good', points: ['+ Bytes cache anywhere', '+ Rights checks stay small and central', '- Instead of: streaming through app servers'], verdict: 'Audio delivery' },
        { title: 'At-least-once + dedupe by event id', icon: ListChecks, tone: 'good', points: ['+ Far simpler and cheaper', '+ Same numbers for payouts', '- Instead of: exactly-once end to end'], verdict: 'Play counting' },
        { title: 'Versioned change log + snapshots', icon: ListMusic, tone: 'good', points: ['+ Offline edits merge by replaying ops', '+ Clients sync deltas', '- Instead of: mutable list rows'], verdict: 'Playlist storage' },
      ]} />
      <p>Other decisions, in brief:</p>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Discovery', cells: ['Batch-generated personal playlists', 'Fully online recommendations', 'Reuses playlist sync, predictable cost; add real-time ranking only where it pays'] },
          { label: 'Infrastructure', cells: ['Public cloud + managed data services', 'Own data centers', 'Teams ship faster; data platform is someone else’s pager'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Latency budgets are sums of round trips.</strong> Win by deleting round trips (warm connections, cached keys, prefetch), not by tuning servers.</li>
          <li><strong>Money-bearing events deserve the rigor of payments.</strong> Unique ids, event-time windows, audited reprocessing, and one versioned definition of “a stream”.</li>
          <li><strong>Reuse delivery paths.</strong> Shipping recommendations as playlists avoids a whole new sync, cache, and offline stack.</li>
          <li><strong>Organization is architecture.</strong> Team autonomy needs a service catalog and paved roads, or it turns into sprawl.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="How do you make a track start playing within a couple hundred milliseconds on mobile?"
        senior={<p>Use a CDN close to users, cache audio on the device, and choose a lower bitrate on slow networks.</p>}
        staff={<>
          <p>First, break start latency into parts: connection setup, metadata lookup, key, first chunk, decode.</p>
          <p>Then delete round trips. Keep a warm connection to a nearby gateway. Cache metadata and keys on the device. Prefetch the first chunk of the likely next track.</p>
          <p>For random jumps like search results, start with a small low-bitrate chunk and step up. Measure p50 and p95 time to first sound per network type. Cap prefetching by battery and data-plan settings.</p>
        </>}
        followUps={['How much prefetching is too much?', 'How do offline downloads interact with licensing?', 'What would you alert on?']}
      />
      <InterviewQuestion
        q="Artists say their stream counts are wrong. How do you design play counting so you can defend the numbers?"
        senior={<p>Send play events through Kafka to a data warehouse and count them in daily batch jobs. Retry failures so no events are lost.</p>}
        staff={<>
          <p>Treat it like a ledger. Clients attach a unique event id and buffer offline. The pipeline is at-least-once and <strong>deduplicates on event id</strong>.</p>
          <p>Counts are keyed by event time, with a published lateness window before a period closes. The “what is a stream” rule is versioned in one place.</p>
          <p>Keep raw events so any report can be recomputed and audited. Flag bot-like listening before payouts. When numbers are disputed, replay the exact events and rule version.</p>
        </>}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Instant play comes from removing round trips on the client: warm connections, cached keys, prefetch.',
        'Encrypted chunks on a CDN separate cheap byte delivery from central rights enforcement.',
        'Playlists as versioned change logs make offline edits and collaboration mergeable.',
        'Play events carry money: at-least-once plus dedupe, event-time windows, auditable recomputation.',
        'Ship new features (like recommendations) through delivery paths you already trust.',
        'At hundreds of teams, the bottleneck is organizational: migrate deliberately and keep a service catalog.',
      ]} />
    </>
  )
}
