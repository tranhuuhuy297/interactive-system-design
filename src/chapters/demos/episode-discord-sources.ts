import type { Reference } from '../../components/ui'

// Primary public sources for the Discord episode; shared by stage deep dives and the chapter's Sources list.
export const DISCORD_SRC = {
  launch: { title: 'Discord (software)', source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Discord', kind: 'docs', note: 'public launch in May 2015' },
  billions: { title: 'How Discord Stores Billions of Messages', source: 'Discord Engineering', year: 2017, url: 'https://discord.com/blog/how-discord-stores-billions-of-messages', kind: 'blog', note: 'MongoDB → Cassandra, (channel, bucket) keys' },
  elixir: { title: 'How Discord Scaled Elixir to 5,000,000 Concurrent Users', source: 'Discord Engineering', year: 2017, url: 'https://discord.com/blog/how-discord-scaled-elixir-to-5-000-000-concurrent-users', kind: 'blog', note: 'session/guild processes, Manifold, FastGlobal, Semaphore' },
  search: { title: 'How Discord Indexes Billions of Messages', source: 'Discord Engineering', year: 2017, url: 'https://discord.com/blog/how-discord-indexes-billions-of-messages', kind: 'blog', note: 'app-level sharding over small Elasticsearch clusters' },
  voice: { title: 'How Discord Handles Two and Half Million Concurrent Voice Users using WebRTC', source: 'Discord Engineering', year: 2018, url: 'https://discord.com/blog/how-discord-handles-two-and-half-million-concurrent-voice-users-using-webrtc', kind: 'blog' },
  memberList: { title: 'Using Rust to Scale Elixir for 11 Million Concurrent Users', source: 'Discord Engineering', year: 2019, url: 'https://discord.com/blog/using-rust-to-scale-elixir-for-11-million-concurrent-users', kind: 'blog', note: 'member lists via a Rust NIF sorted set' },
  readStates: { title: 'Why Discord is switching from Go to Rust', source: 'Discord Engineering', year: 2020, url: 'https://discord.com/blog/why-discord-is-switching-from-go-to-rust', kind: 'blog', note: 'Read States service' },
  trillions: { title: 'How Discord Stores Trillions of Messages', source: 'Discord Engineering', year: 2023, url: 'https://discord.com/blog/how-discord-stores-trillions-of-messages', kind: 'blog', note: '177 Cassandra → 72 ScyllaDB nodes; Rust data services' },
  superDisk: { title: 'How Discord Supercharges Network Disks for Extreme Low Latency', source: 'Discord Engineering', year: 2022, url: 'https://discord.com/blog/how-discord-supercharges-network-disks-for-extreme-low-latency', kind: 'blog' },
  maxjourney: { title: 'Maxjourney: Pushing Discord’s Limits with a Million+ Online Users in a Single Server', source: 'Discord Engineering', year: 2023, url: 'https://discord.com/blog/maxjourney-pushing-discords-limits-with-a-million-plus-online-users-in-a-single-server', kind: 'blog', note: 'passive sessions, relays' },
  gatewayDocs: { title: 'Gateway', source: 'Discord Developer Docs', url: 'https://discord.com/developers/docs/events/gateway', kind: 'docs' },
} satisfies Record<string, Reference>

export const DISCORD_REFS: Reference[] = Object.values(DISCORD_SRC)
