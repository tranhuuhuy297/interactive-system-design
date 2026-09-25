import {
  Bell, Binary, Boxes, CheckCheck, Copy, Database, Filter, FolderSync, Globe, Grid3x3, Hash,
  KeyRound, Link2, ListOrdered, MapPin, MessageSquare, Newspaper, PlayCircle, Radio, Ruler, ScrollText, Search,
  Send, Server, ShieldCheck, Split, UploadCloud, Users, Zap,
} from 'lucide-react'
import type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS_CASES_A: MentalModelData[] = [
  {
    id: 'url-shortener',
    idea: 'Turn a counter into a short code, then serve redirects from cache.',
    picture: [
      { icon: Link2, label: 'Long URL in' },
      { icon: Binary, label: 'Counter → base62' },
      { icon: Database, label: 'Store code → URL' },
      { icon: Zap, label: 'Redirect from cache' },
    ],
    analogy: 'a coat-check ticket: a tiny token that maps back to the real thing.',
    hook: 'Counter in, base62 out, cache the redirect, log clicks async.',
  },
  {
    id: 'news-feed',
    idea: 'Precompute each user’s feed on write, except for celebrities, who are pulled on read.',
    picture: [
      { icon: Send, label: 'Post published' },
      { icon: Users, label: 'Fan out to followers' },
      { icon: Newspaper, label: 'Feed = list of IDs' },
      { icon: Zap, label: 'Hydrate on read' },
    ],
    analogy: 'a newspaper delivered to every doorstep, except the celebrity column, which you fetch yourself.',
    hook: 'Push for most, pull for celebrities, store IDs not posts.',
  },
  {
    id: 'chat',
    idea: 'Long-lived sockets on gateways; every message gets a per-conversation sequence number.',
    picture: [
      { icon: Radio, label: 'Socket to a gateway' },
      { icon: MessageSquare, label: 'Send with clientMsgId' },
      { icon: ListOrdered, label: 'Server assigns seq' },
      { icon: CheckCheck, label: 'Deliver, then ack' },
    ],
    analogy: 'numbered tickets at a deli counter: order is decided at the counter, not by who shouts first.',
    hook: 'Sockets for delivery, sequence numbers for order, cursors for catch-up.',
  },
  {
    id: 'notifications',
    idea: 'Dedupe, check preferences, then route through isolated per-channel priority queues.',
    picture: [
      { icon: KeyRound, label: 'Idempotency key' },
      { icon: Filter, label: 'Preferences + limits' },
      { icon: Split, label: 'Queue per channel × priority' },
      { icon: Bell, label: 'Provider delivers' },
    ],
    analogy: 'a mailroom with a separate express lane, so urgent letters never wait behind flyers.',
    hook: 'Dedupe first, respect the user, never let campaigns block OTPs.',
  },
  {
    id: 'autocomplete',
    idea: 'Precompute the top suggestions for every prefix offline, then serve them from memory.',
    picture: [
      { icon: ScrollText, label: 'Query logs' },
      { icon: Boxes, label: 'Offline aggregate' },
      { icon: Search, label: 'Prefix → top-k' },
      { icon: Zap, label: 'Serve from cache' },
    ],
    analogy: 'a phone’s speed-dial: the answers are chosen ahead of time, so lookup is instant.',
    hook: 'Build offline, swap versions, serve prefixes from memory.',
  },
  {
    id: 'web-crawler',
    idea: 'A prioritized, polite URL frontier feeds fetchers; dedupe before anything is fetched twice.',
    picture: [
      { icon: ListOrdered, label: 'Prioritized frontier' },
      { icon: ShieldCheck, label: 'Polite per host' },
      { icon: Globe, label: 'Fetch + parse' },
      { icon: Filter, label: 'Dedupe new URLs' },
    ],
    analogy: 'a librarian visiting every library, never twice in one hour, skipping books already catalogued.',
    hook: 'Prioritize, be polite, dedupe, and recrawl by change rate.',
  },
  {
    id: 'video-streaming',
    idea: 'Upload once, transcode into a bitrate ladder, and let the CDN serve adaptive segments.',
    picture: [
      { icon: UploadCloud, label: 'Resumable upload' },
      { icon: Boxes, label: 'Transcode ladder' },
      { icon: Globe, label: 'CDN segments' },
      { icon: PlayCircle, label: 'Adaptive playback' },
    ],
    analogy: 'printing a book in several sizes once, then letting each reader grab the size that fits.',
    hook: 'Encode once, deliver billions of times; egress is the bill.',
  },
  {
    id: 'file-sync',
    idea: 'Split files into content-addressed blocks; sync by replaying an ordered metadata journal.',
    picture: [
      { icon: Hash, label: 'Chunk + hash blocks' },
      { icon: UploadCloud, label: 'Upload only new blocks' },
      { icon: ScrollText, label: 'Commit to journal' },
      { icon: FolderSync, label: 'Devices replay' },
    ],
    analogy: 'LEGO instructions: send the missing bricks and the build steps, not the whole model.',
    hook: 'Blocks by hash, metadata by journal, conflicts at commit.',
  },
  {
    id: 'proximity',
    idea: 'Bucket places into geohash cells, search the nearby cells, then filter by exact distance.',
    picture: [
      { icon: MapPin, label: 'User location' },
      { icon: Grid3x3, label: 'Cell + 8 neighbors' },
      { icon: Search, label: 'Scan cell prefixes' },
      { icon: Ruler, label: 'Exact distance filter' },
    ],
    analogy: 'checking your own neighborhood and the ones next to it before measuring exact walking distance.',
    hook: 'Coarse cells first, exact distance last, replicate not shard.',
  },
  {
    id: 'kv-store',
    idea: 'Hash keys onto a ring, replicate to N nodes, and tune consistency with quorums.',
    picture: [
      { icon: Hash, label: 'Hash key on ring' },
      { icon: Copy, label: 'N replicas' },
      { icon: Server, label: 'W and R quorums' },
      { icon: ShieldCheck, label: 'Repair in background' },
    ],
    analogy: 'three friends each keep a copy of the group’s notes; ask any two to be sure.',
    hook: 'Ring for placement, N copies, R + W > N for fresh reads.',
  },
  {
    id: 'payments',
    idea: 'Every money movement is idempotent, state-machine guarded, and recorded in a double-entry ledger.',
    picture: [
      { icon: KeyRound, label: 'Idempotency key' },
      { icon: ListOrdered, label: 'Guarded state machine' },
      { icon: ScrollText, label: 'Double-entry ledger' },
      { icon: CheckCheck, label: 'Reconcile daily' },
    ],
    analogy: 'a bank teller who stamps every slip, so the same slip can never be cashed twice.',
    hook: 'Retry-safe calls, legal transitions only, and books that always balance.',
  },
]
