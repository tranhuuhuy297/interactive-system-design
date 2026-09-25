import {
  References,
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeSpotifyInstantStartDemo } from './demos/episode-spotify-instant-start-demo'
import { SPOTIFY_STAGES } from './demos/episode-spotify-stages'

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

// Primary public sources behind the “In the real world” notes.
const REFS: Reference[] = [
  { title: "Spotify Removes Peer-To-Peer Technology From Its Desktop Client", source: "TechCrunch", year: 2014, url: "https://techcrunch.com/2014/04/17/spotify-removes-peer-to-peer-technology-from-its-desktop-client/", kind: "blog", note: "secondary source" },
  { title: "Spotify Announces Google Cloud Platform Partnership", source: "TechCrunch", year: 2016, url: "https://techcrunch.com/2016/02/23/spotify-announces-google-cloud-platform-partnership/", kind: "blog", note: "secondary source" },
  { title: "Spotify’s Event Delivery – The Road to the Cloud (Part I)", source: "Spotify Engineering", year: 2016, url: "https://engineering.atspotify.com/2016/02/spotifys-event-delivery-the-road-to-the-cloud-part-i", kind: "blog" },
  { title: "Spotify’s Event Delivery – The Road to the Cloud (Part II)", source: "Spotify Engineering", year: 2016, url: "https://engineering.atspotify.com/2016/03/spotifys-event-delivery-the-road-to-the-cloud-part-ii", kind: "blog", note: "Kafka → Cloud Pub/Sub" },
  { title: "Scaling Agile @ Spotify with Tribes, Squads, Chapters & Guilds", source: "H. Kniberg & A. Ivarsson", year: 2012, url: "https://blog.crisp.se/wp-content/uploads/2012/11/SpotifyScaling.pdf", kind: "paper" },
  { title: "Spotify users have spent over 2.3 billion hours streaming Discover Weekly playlists since 2015", source: "Spotify Newsroom", year: 2020, url: "https://newsroom.spotify.com/2020-07-09/spotify-users-have-spent-over-2-3-billion-hours-streaming-discover-weekly-playlists-since-2015/", kind: "blog" },
  { title: "What the Heck Is Backstage Anyway?", source: "Spotify Engineering", year: 2020, url: "https://engineering.atspotify.com/2020/03/what-the-heck-is-backstage-anyway/", kind: "blog" },
]

export default function SpotifyEpisode() {
  return (
    <>
      <p>
        Spotify’s hardest problem is not storing music. It is making <strong>play feel instant</strong> on a flaky phone
        network, then <strong>counting every play correctly</strong>, because those counts are how artists get paid.
        This episode builds the service from a catalog and some audio files to a global, cloud-hosted platform with
        recommendations that ship as ordinary playlists.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Step through the stages and, before each click, name the next bottleneck. Notice how often the answer is
        “do it on the client” or “reuse a system you already built”.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Spotify; all trademarks belong to their owners.</em></p>

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={SPOTIFY_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
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
        Two things stand out. Audio is <strong>small per stream but enormous in aggregate</strong>, which suits a
        CDN well. And the event stream is an order of magnitude bigger than the play rate, and it carries money.
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
        Time to first sound is a sum of round trips plus one small download. The winning moves remove round trips
        entirely rather than making them faster. Try it: a random jump can’t be prefetched, so warm connections and
        cached keys still matter.
      </p>
      <EpisodeSpotifyInstantStartDemo />
      <Callout kind="tip">
        A small low-bitrate first chunk trades a moment of lower quality for a faster start. Players then step up to
        the normal bitrate within seconds, and most listeners never notice.
      </Callout>

      <H2 id="counting">Deep dive: counting plays you pay money on</H2>
      <p>
        Play events arrive late (offline listening), twice (client retries), or out of order. The pipeline should
        be <strong>at-least-once delivery plus idempotent counting</strong>: dedupe on a client-generated event id,
        aggregate on event time, and only close a reporting period after a lateness window. What counts as a
        “stream” (e.g. a minimum listening duration) is a <em>business policy</em>. Encode it in one versioned
        place, not scattered across jobs.
      </p>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Audio delivery', cells: ['Encrypted chunks on a CDN + key service', 'Stream through app servers', 'Bytes are cacheable anywhere; rights enforcement lives in small, central key checks'] },
          { label: 'Playlist storage', cells: ['Versioned change log + snapshots', 'Mutable list rows', 'Offline edits and collaborators merge by replaying ops; clients sync deltas'] },
          { label: 'Play counting', cells: ['At-least-once + dedupe by event id', 'Exactly-once end to end', 'Far cheaper and simpler; dedupe gives the same numbers for payouts'] },
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
          <p>I’d first break the start latency into parts: connection setup, metadata resolve, license or key, first chunk, decode. Then I’d delete round trips. Keep a warm connection to a nearby gateway, cache metadata and keys on the device, and prefetch the first chunk of the likely next track while the current one plays.</p>
          <p>For unpredictable jumps like search results, start on a small low-bitrate chunk and step up. I’d measure p50 and p95 time to first sound per network type, and cap prefetching by battery and data-plan settings so we don’t burn users’ data on tracks they skip.</p>
        </>}
        followUps={['How much prefetching is too much?', 'How do offline downloads interact with licensing?', 'What would you alert on?']}
      />
      <InterviewQuestion
        q="Artists say their stream counts are wrong. How do you design play counting so you can defend the numbers?"
        senior={<p>Send play events through Kafka to a data warehouse and count them in daily batch jobs. Retry failures so no events are lost.</p>}
        staff={<>
          <p>Treat it like a ledger. Clients attach a unique event id and buffer offline. The pipeline is at-least-once and <strong>deduplicates on event id</strong>. Counts are keyed by event time, with a published lateness window before a period closes.</p>
          <p>The “what is a stream” rule is versioned in one place, and the raw events are retained so any report can be recomputed and audited. Anomaly detection flags bot-like listening before payouts. When numbers are disputed, we can replay the exact events and rule version behind them.</p>
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
      ]} />
    </>
  )
}
