import type { ArchEdge, ArchNode, Reference } from '../../components/ui'

// Fixed slots on a 5×4 grid keep every node in the same place across stages (no overlaps at 720px).
export const SN = {
  client: { id: 'client', label: 'Desktop app', sub: 'local cache', kind: 'client', x: 10, y: 50 },
  cache: { id: 'cache', label: 'Client cache', sub: 'chunks · keys', kind: 'cache', x: 10, y: 14 },
  peers: { id: 'peers', label: 'Other clients', sub: 'P2P swarm', kind: 'external', x: 10, y: 86 },
  ap: { id: 'ap', label: 'Access point', sub: 'long-lived conn', kind: 'lb', x: 30, y: 50 },
  pod: { id: 'pod', label: 'Podcast + books', sub: 'catalog · purchases', kind: 'db', x: 30, y: 14 },
  meta: { id: 'meta', label: 'Catalog metadata', sub: 'tracks · rights', kind: 'db', x: 50, y: 14 },
  playlist: { id: 'playlist', label: 'Playlist service', kind: 'service', x: 50, y: 38 },
  keys: { id: 'keys', label: 'Key service', sub: 'DRM · offline', kind: 'service', x: 50, y: 62 },
  portal: { id: 'portal', label: 'Backstage', sub: 'service catalog', kind: 'service', x: 70, y: 14 },
  search: { id: 'search', label: 'Search', sub: 'terms + vectors', kind: 'search', x: 70, y: 14 },
  pldb: { id: 'pldb', label: 'Playlist store', sub: 'change log', kind: 'db', x: 70, y: 38 },
  events: { id: 'events', label: 'Event delivery', sub: 'plays · skips', kind: 'queue', x: 70, y: 62 },
  cdn: { id: 'cdn', label: 'CDN', sub: 'encrypted chunks', kind: 'cdn', x: 70, y: 86 },
  cloud: { id: 'cloud', label: 'Google Cloud', sub: 'managed services', kind: 'external', x: 90, y: 14 },
  encoder: { id: 'encoder', label: 'Query encoder', sub: 'GPU inference', kind: 'worker', x: 90, y: 14 },
  recs: { id: 'recs', label: 'Recommendations', sub: 'batch jobs', kind: 'worker', x: 90, y: 38 },
  lake: { id: 'lake', label: 'Data platform', sub: 'batch + streaming', kind: 'storage', x: 90, y: 62 },
  audio: { id: 'audio', label: 'Audio storage', sub: 'many bitrates', kind: 'storage', x: 90, y: 86 },
} satisfies Record<string, ArchNode>

export const se = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })

// Verified sources reused by several stages.
export const SRC = {
  p2pPaper: { title: 'Spotify – Large Scale, Low Latency, P2P Music-on-Demand Streaming', source: 'G. Kreitz & F. Niemelä, IEEE P2P', year: 2010, url: 'https://kreitz.se/spotify-p2p10/', kind: 'paper' },
  p2pDrop: { title: 'Spotify Removes Peer-To-Peer Technology From Its Desktop Client', source: 'TechCrunch', year: 2014, url: 'https://techcrunch.com/2014/04/17/spotify-removes-peer-to-peer-technology-from-its-desktop-client/', kind: 'blog' },
  mobile: { title: 'Spotify App Goes Live on iPhone and Android', source: 'TechCrunch', year: 2009, url: 'https://techcrunch.com/2009/09/07/breaking-spotify-app-goes-live-on-iphone-and-android/', kind: 'blog' },
  mobileBb: { title: 'Spotify Launches For iPhone, Android', source: 'Billboard', year: 2009, url: 'https://www.billboard.com/music/music-news/spotify-launches-for-iphone-android-1265733/', kind: 'blog' },
  crdt: { title: 'Conflict-free Replicated Data Types', source: 'M. Shapiro et al.', year: 2011, url: 'https://inria.hal.science/inria-00609399', kind: 'paper', note: 'background on mergeable edits' },
  events1: { title: 'Spotify’s Event Delivery – The Road to the Cloud (Part I)', source: 'Spotify Engineering', year: 2016, url: 'https://engineering.atspotify.com/2016/02/spotifys-event-delivery-the-road-to-the-cloud-part-i', kind: 'blog' },
  events2: { title: 'Spotify’s Event Delivery – The Road to the Cloud (Part II)', source: 'Spotify Engineering', year: 2016, url: 'https://engineering.atspotify.com/2016/03/spotifys-event-delivery-the-road-to-the-cloud-part-ii', kind: 'blog' },
  royalties: { title: 'Loud & Clear', source: 'Spotify', url: 'https://loudandclear.byspotify.com/', kind: 'docs', note: 'how streams turn into payouts' },
  dw: { title: 'Spotify users have spent over 2.3 billion hours streaming Discover Weekly playlists since 2015', source: 'Spotify Newsroom', year: 2020, url: 'https://newsroom.spotify.com/2020-07-09/spotify-users-have-spent-over-2-3-billion-hours-streaming-discover-weekly-playlists-since-2015/', kind: 'blog' },
  gcpDeal: { title: 'Spotify Announces Google Cloud Platform Partnership', source: 'TechCrunch', year: 2016, url: 'https://techcrunch.com/2016/02/23/spotify-announces-google-cloud-platform-partnership/', kind: 'blog' },
  gcpHistory: { title: 'Views From The Cloud: A History of Spotify’s Journey to the Cloud, Part 1', source: 'Spotify Engineering', year: 2019, url: 'https://engineering.atspotify.com/2019/12/views-from-the-cloud-a-history-of-spotifys-journey-to-the-cloud-part-1-2', kind: 'blog' },
  squads: { title: 'Scaling Agile @ Spotify with Tribes, Squads, Chapters & Guilds', source: 'H. Kniberg & A. Ivarsson', year: 2012, url: 'https://blog.crisp.se/wp-content/uploads/2012/11/SpotifyScaling.pdf', kind: 'paper' },
  backstage: { title: 'What the Heck Is Backstage Anyway?', source: 'Spotify Engineering', year: 2020, url: 'https://engineering.atspotify.com/2020/03/what-the-heck-is-backstage-anyway/', kind: 'blog' },
  backstageCncf: { title: 'Backstage has been accepted into the CNCF Sandbox', source: 'Backstage blog', year: 2020, url: 'https://backstage.io/blog/2020/09/23/backstage-cncf-sandbox/', kind: 'blog' },
  audioFirst: { title: 'Audio-First', source: 'Spotify Newsroom (D. Ek)', year: 2019, url: 'https://newsroom.spotify.com/2019-02-06/audio-first/', kind: 'blog' },
  audiobooks: { title: 'With Audiobooks Launching in the U.S. Today, Spotify Is the Home for All the Audio You Love', source: 'Spotify Newsroom', year: 2022, url: 'https://newsroom.spotify.com/2022-09-20/with-audiobooks-launching-in-the-u-s-today-spotify-is-the-home-for-all-the-audio-you-love/', kind: 'blog' },
  nlSearch: { title: 'Introducing Natural Language Search for Podcast Episodes', source: 'Spotify Engineering', year: 2022, url: 'https://engineering.atspotify.com/2022/03/introducing-natural-language-search-for-podcast-episodes', kind: 'blog' },
} satisfies Record<string, Reference>
