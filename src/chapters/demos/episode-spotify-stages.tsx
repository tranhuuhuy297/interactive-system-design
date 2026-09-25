import type { ArchEdge, ArchNode, EpisodeStage } from '../../components/ui'

// Stage graphs are cumulative: each stage re-lists the nodes it keeps so positions stay stable.
const N = {
  client: { id: 'client', label: 'Apps', sub: 'desktop · mobile · web', kind: 'client', x: 10, y: 50 },
  mono: { id: 'api', label: 'Backend', sub: 'one service', kind: 'service', x: 30, y: 50 },
  api: { id: 'api', label: 'Access points', sub: 'gateway', kind: 'lb', x: 30, y: 50 },
  meta: { id: 'meta', label: 'Catalog metadata', sub: 'tracks · albums · rights', kind: 'db', x: 50, y: 14 },
  audio: { id: 'audio', label: 'Audio files', sub: 'multiple bitrates', kind: 'storage', x: 90, y: 84 },
  cdn: { id: 'cdn', label: 'CDN', sub: 'encrypted chunks', kind: 'cdn', x: 30, y: 84 },
  keys: { id: 'keys', label: 'Key service', sub: 'DRM · offline', kind: 'service', x: 52, y: 86 },
  playlist: { id: 'playlist', label: 'Playlist service', kind: 'service', x: 50, y: 36 },
  pldb: { id: 'pldb', label: 'Playlist store', sub: 'versioned changes', kind: 'db', x: 72, y: 30 },
  events: { id: 'events', label: 'Event delivery', sub: 'plays · skips', kind: 'queue', x: 50, y: 62 },
  lake: { id: 'lake', label: 'Data lake', sub: 'batch + streaming', kind: 'storage', x: 72, y: 62 },
  royalty: { id: 'royalty', label: 'Royalty reporting', sub: 'per-stream counts', kind: 'worker', x: 90, y: 62 },
  recs: { id: 'recs', label: 'Recommendations', sub: 'batch + real-time', kind: 'worker', x: 90, y: 30 },
  search: { id: 'search', label: 'Search', sub: 'inverted index', kind: 'search', x: 72, y: 14 },
  region: { id: 'region', label: 'Cloud regions', sub: 'managed services', kind: 'external', x: 12, y: 16 },
} satisfies Record<string, ArchNode>

const e = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })

// Edges shared by later stages.
const DELIVERY = [e('client', 'api'), e('api', 'meta'), e('api', 'keys'), e('client', 'cdn'), e('cdn', 'audio')]

export const SPOTIFY_STAGES: EpisodeStage[] = [
  {
    title: 'v0 · Catalog + files',
    scale: '~100K beta users',
    nodes: [N.client, N.mono, N.meta, N.audio],
    edges: [e('client', 'api'), e('api', 'meta'), e('api', 'audio')],
    flows: [{ name: 'Play', path: ['client', 'api', 'audio'], steps: ['App asks the backend for a track', 'Backend reads the file and streams it back'] }],
    problem: <p>Prove that streaming can feel as fast as playing a local MP3. Labels only license music to a product that works, and users only stay if play is instant.</p>,
    decision: <p>A small catalog database, audio files in storage, and one backend that authorizes and streams. The client is a native app, not a web page, so it can cache aggressively.</p>,
    tradeoff: <p>Every byte flows through the backend. Latency depends on how far you are from one data center.</p>,
    realWorld: <p>Spotify has written that its early desktop client combined its own servers with a <strong>peer-to-peer</strong> network between clients to cut bandwidth. In 2014 Spotify said it was phasing P2P out because its growing server fleet could now deliver music on its own. The mobile and web players never used P2P.</p>,
  },
  {
    title: 'v1 · Instant play',
    scale: '~10M users · mobile arrives',
    added: ['cdn', 'keys'],
    nodes: [N.client, N.api, N.meta, N.audio, N.cdn, N.keys],
    edges: DELIVERY,
    flows: [
      { name: 'Play', path: ['client', 'api', 'keys'], steps: ['App resolves the track and checks rights', 'Key service returns a decryption key for this device'] },
      { name: 'Stream', path: ['client', 'cdn', 'audio'], steps: ['App fetches the first encrypted chunk from the nearest edge', 'Edge miss pulls from origin storage'] },
    ],
    problem: <p>Users skip constantly. A track that takes a second to start feels broken, and mobile networks add hundreds of milliseconds per round trip.</p>,
    decision: (
      <ul>
        <li>Serve encrypted audio chunks from a <strong>CDN</strong>, so the bytes are dumb and cacheable anywhere.</li>
        <li>Keep keys in a separate service, so offline downloads just store the chunks plus a time-limited key.</li>
        <li><strong>Prefetch</strong> the start of the likely next track while the current one plays.</li>
      </ul>
    ),
    tradeoff: <p>Prefetching wastes bandwidth on tracks the user never plays. Offline mode means licensing checks run on a device you don’t control, so keys must expire.</p>,
  },
  {
    title: 'v2 · Playlists as a product',
    scale: '~50M users · billions of playlists',
    added: ['playlist', 'pldb'],
    nodes: [N.client, N.api, N.meta, N.audio, N.cdn, N.keys, N.playlist, N.pldb],
    edges: [...DELIVERY, e('api', 'playlist'), e('playlist', 'pldb')],
    flows: [{ name: 'Edit playlist', path: ['client', 'api', 'playlist', 'pldb'], steps: ['User drags a track on their phone', 'Gateway routes the change', 'Playlist service appends a change to the playlist history', 'Other devices and collaborators sync from their last known version'] }],
    problem: <p>Playlists become the main way people listen. Some have thousands of tracks, some have many collaborators, and everyone expects edits on the phone to show up on the laptop immediately, even after editing offline.</p>,
    decision: <p>Store each playlist as a <strong>log of changes</strong> (add, move, remove) with a version, not as a mutable array. Clients sync by asking “what changed since version N?” and concurrent edits are merged by replaying operations.</p>,
    tradeoff: <p>Reads have to fold the log into the current list, so you periodically snapshot. Merge rules for conflicting moves are subtle and user-visible.</p>,
  },
  {
    title: 'v3 · Every play counts',
    scale: 'Billions of events per day',
    added: ['events', 'lake', 'royalty'],
    nodes: [N.client, N.api, N.meta, N.audio, N.cdn, N.keys, N.playlist, N.pldb, N.events, N.lake, N.royalty],
    edges: [...DELIVERY, e('api', 'playlist'), e('playlist', 'pldb'), e('api', 'events', { async: true }), e('events', 'lake'), e('lake', 'royalty')],
    flows: [{ name: 'Report a play', path: ['client', 'api', 'events', 'lake', 'royalty'], steps: ['App logs play, pause, skip, and seek events, buffered while offline', 'Gateway accepts the batch', 'Event delivery persists it durably', 'Pipelines deduplicate and aggregate', 'Per-track stream counts feed rights-holder reports'] }],
    problem: <p>Money depends on these events. Royalties are paid per stream, so losing events underpays artists and double-counting overpays them. Offline listening means events arrive hours or days late.</p>,
    decision: <p>Treat events as a <strong>durable, ordered pipeline</strong>. Clients attach unique event ids and buffer locally, the pipeline deduplicates by id, and reporting runs on event time with late-arrival windows, not on arrival time.</p>,
    tradeoff: <p>Exactly-once end to end is expensive. In practice you get at-least-once delivery plus idempotent aggregation, and royalty reports close only after a lateness window.</p>,
  },
  {
    title: 'v4 · Recommendations',
    scale: 'Hundreds of millions of listeners',
    added: ['recs'],
    nodes: [N.client, N.api, N.meta, N.audio, N.cdn, N.keys, N.playlist, N.pldb, N.events, N.lake, N.royalty, N.recs],
    edges: [...DELIVERY, e('api', 'playlist'), e('playlist', 'pldb'), e('api', 'events', { async: true }), e('events', 'lake'), e('lake', 'royalty'), e('lake', 'recs'), e('recs', 'pldb', { label: 'personal playlists' })],
    flows: [{ name: 'Weekly mix', path: ['lake', 'recs', 'pldb'], steps: ['Listening history lands in the lake', 'Batch jobs compute a fresh playlist per user', 'It is written as an ordinary playlist and syncs like any other'] }],
    problem: <p>A catalog of tens of millions of tracks is useless if people only replay what they know. Discovery drives retention and helps long-tail artists get heard.</p>,
    decision: <p>Mine listening history offline (collaborative filtering, audio and text signals) and deliver results as <strong>personalized playlists</strong>, reusing the playlist sync path you already built. Add lighter real-time ranking for home and radio.</p>,
    tradeoff: <p>Batch outputs are hours old. Weekly generation for every user creates a huge scheduled compute spike, so it has to be spread out.</p>,
    realWorld: <p><strong>Discover Weekly</strong> (launched 2015) is the famous example: a per-user playlist regenerated weekly from listening data and shipped through the normal playlist system.</p>,
  },
  {
    title: 'v5 · Search',
    scale: '100M+ tracks · podcasts · audiobooks',
    added: ['search'],
    nodes: [N.client, N.api, N.meta, N.audio, N.cdn, N.keys, N.playlist, N.pldb, N.events, N.lake, N.royalty, N.recs, N.search],
    edges: [...DELIVERY, e('api', 'playlist'), e('playlist', 'pldb'), e('api', 'events', { async: true }), e('events', 'lake'), e('lake', 'royalty'), e('lake', 'recs'), e('recs', 'pldb'), e('meta', 'search', { label: 'index', async: true }), e('api', 'search')],
    flows: [{ name: 'Search', path: ['client', 'api', 'search'], steps: ['User types a few letters', 'Search ranks prefix matches by popularity and personal history'] }],
    problem: <p>Users type “tay” and expect the right artist before they finish. Queries are typo-ridden, multilingual, and span music, podcasts, and audiobooks with different rights per country.</p>,
    decision: <p>Build a dedicated search index fed asynchronously from catalog changes. Rank with popularity and personal signals, and filter by market availability at query time.</p>,
    tradeoff: <p>The index lags the catalog by seconds to minutes. Personalized ranking reduces how much you can cache.</p>,
  },
  {
    title: 'v6 · Cloud + team ownership',
    scale: 'Global · hundreds of teams',
    added: ['region'],
    nodes: [N.client, N.api, N.meta, N.audio, N.cdn, N.keys, N.playlist, N.pldb,
      { ...N.events, label: 'Managed pub/sub' }, { ...N.lake, label: 'Cloud warehouse' }, N.royalty, N.recs, N.search, N.region],
    edges: [...DELIVERY, e('api', 'playlist'), e('playlist', 'pldb'), e('api', 'events', { async: true }), e('events', 'lake'), e('lake', 'royalty'), e('lake', 'recs'), e('recs', 'pldb'), e('meta', 'search', { async: true }), e('api', 'search'), e('region', 'api', { label: 'hosts' })],
    flows: [{ name: 'Play', path: ['client', 'api', 'keys'], steps: ['Same product flow; everything behind the gateway now runs on cloud infrastructure', 'Teams deploy their own services independently'] }],
    problem: <p>Running your own data centers and data infrastructure slows everyone down. Hundreds of teams need to ship independently without coordinating every release.</p>,
    decision: <p>Move infrastructure to a public cloud and lean on managed messaging and analytics. Organize around small autonomous teams, each owning services end to end, with a shared developer portal so the service sprawl stays discoverable.</p>,
    tradeoff: <p>Vendor dependence and a big migration cost. Autonomy without guardrails produces duplicated tooling and inconsistent practices.</p>,
    realWorld: <p>Spotify announced its move to <strong>Google Cloud</strong> in 2016 and completed it over the following couple of years, including moving event delivery to Cloud Pub/Sub. Its 2012 “squads and tribes” paper became famous, though Spotify has said it evolved beyond it. It open-sourced its developer portal as <strong>Backstage</strong> in 2020.</p>,
  },
]
