import {
  Bot, Calendar, Car, CreditCard, Film, Globe, HardDrive, Hash, House, Layers, ListMusic, Lock, MapPin, MessageSquare,
  Music, Network, Package, Radio, Route, Search, Server, ShieldCheck, ShoppingCart, Sparkles, Timer, Users, Wallet, Webhook,
} from 'lucide-react'
import type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS_EPISODES: MentalModelData[] = [
  {
    id: 'ep-netflix',
    idea: 'The cloud decides what to play; caches inside your ISP deliver the bytes.',
    picture: [
      { icon: Server, label: 'Cloud control plane' },
      { icon: Route, label: 'Steer to a cache' },
      { icon: HardDrive, label: 'ISP cache streams' },
      { icon: Film, label: 'Bitrate adapts' },
    ],
    analogy: 'a head office that plans deliveries, and local warehouses stocked overnight.',
    hook: 'Decide in the cloud, deliver from next door.',
  },
  {
    id: 'ep-stripe',
    idea: 'Every external call can end in “unknown”, so money moves only through replayable, balanced records.',
    picture: [
      { icon: CreditCard, label: 'Charge with a key' },
      { icon: ShieldCheck, label: 'Retry is safe' },
      { icon: Wallet, label: 'Ledger balances' },
      { icon: Webhook, label: 'Webhook reports' },
    ],
    analogy: 'a bank teller who stamps each slip once and writes every move in two columns.',
    hook: 'Keys for retries, ledgers for truth, webhooks for later.',
  },
  {
    id: 'ep-uber',
    idea: 'Locations are huge but disposable; trips are tiny but must never be lost.',
    picture: [
      { icon: MapPin, label: 'Drivers stream GPS' },
      { icon: Network, label: 'Cells index them' },
      { icon: Car, label: 'Batch-match by ETA' },
      { icon: Lock, label: 'Trip state is durable' },
    ],
    analogy: 'a dispatcher’s whiteboard you can wipe, next to a logbook you never lose.',
    hook: 'Fast path for positions, safe path for trips.',
  },
  {
    id: 'ep-discord',
    idea: 'One owner per guild fans out messages, and hot reads are merged before the database.',
    picture: [
      { icon: MessageSquare, label: 'Message sent' },
      { icon: Users, label: 'Guild owner fans out' },
      { icon: Layers, label: 'Coalesce hot reads' },
      { icon: HardDrive, label: 'Store by channel' },
    ],
    analogy: 'one host per party who relays every announcement to guests in the room.',
    hook: 'Design for the giant server, not the average one.',
  },
  {
    id: 'ep-instagram',
    idea: 'Keep the database boring and sharded; push media and feeds out of the request path.',
    picture: [
      { icon: Hash, label: 'ID encodes time + shard' },
      { icon: Server, label: 'Logical shards' },
      { icon: Globe, label: 'Media on a CDN' },
      { icon: Sparkles, label: 'Precomputed feed' },
    ],
    analogy: 'numbered library shelves you can move between rooms without relabelling books.',
    hook: 'Many small shards, one smart ID, bytes on the CDN.',
  },
  {
    id: 'ep-amazon',
    idea: 'Each part of a store gets its own consistency: stale catalog, forgiving cart, strict inventory.',
    picture: [
      { icon: Search, label: 'Cached catalog' },
      { icon: ShoppingCart, label: 'Cart always writes' },
      { icon: Lock, label: 'Stock held strictly' },
      { icon: Package, label: 'Order as a saga' },
    ],
    analogy: 'a shop with a window display, a basket you never lose, and a stockroom with a lock.',
    hook: 'Relax where it’s cheap, be strict where it’s money.',
  },
  {
    id: 'ep-spotify',
    idea: 'Audio is small cached chunks; every play is an event that is counted exactly once.',
    picture: [
      { icon: Music, label: 'Tap a track' },
      { icon: HardDrive, label: 'Chunks from CDN' },
      { icon: Radio, label: 'Play event emitted' },
      { icon: ListMusic, label: 'Counts and playlists' },
    ],
    analogy: 'a jukebox that plays instantly and quietly tallies every song for the artists.',
    hook: 'Play fast from the edge, count carefully in the back.',
  },
  {
    id: 'ep-airbnb',
    idea: 'Search reads a fast copy of the calendar; booking checks the real one under a constraint.',
    picture: [
      { icon: Search, label: 'Search the index' },
      { icon: Calendar, label: 'Nights as bits' },
      { icon: House, label: 'Book with a constraint' },
      { icon: Wallet, label: 'Pay idempotently' },
    ],
    analogy: 'a hotel brochure you can skim, and a front desk that holds the real key.',
    hook: 'Browse the copy, book the original.',
  },
  {
    id: 'ep-chatgpt',
    idea: 'Stream tokens fast, budget every context window, and degrade gracefully when GPUs run out.',
    picture: [
      { icon: MessageSquare, label: 'Prompt arrives' },
      { icon: Timer, label: 'Admit by tokens' },
      { icon: Bot, label: 'Model streams tokens' },
      { icon: ShieldCheck, label: 'Safety + storage' },
    ],
    analogy: 'a restaurant that serves each dish as it’s ready and seats guests by kitchen capacity.',
    hook: 'First token fast, tokens budgeted, overload degraded.',
  },
]
