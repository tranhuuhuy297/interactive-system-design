import {
  Bot, Calculator, CalendarCheck, Cpu, CreditCard, Database, FileClock, Filter, Gamepad2, Gauge, GitMerge,
  Hash, HardDrive, History, Hourglass, KeyRound, Layers, ListOrdered, Lock, Map, MapPin, MemoryStick, Package,
  Radio, Route, ScrollText, Send, ShieldCheck, Split, Timer, Trophy, Users, Waves, Zap,
} from 'lucide-react'
import type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS_CASES_B: MentalModelData[] = [
  {
    id: 'leaderboard',
    idea: 'One sorted set answers top-K, my rank and around-me in log time.',
    picture: [
      { icon: Gamepad2, label: 'Match result' },
      { icon: ListOrdered, label: 'ZINCRBY the score' },
      { icon: Hash, label: 'ZREVRANK = my rank' },
      { icon: Trophy, label: 'Top-K in O(log N)' },
    ],
    analogy: 'a race board where every runner’s position updates the moment they cross a checkpoint.',
    hook: 'Rank in Redis, truth in history, percentiles beyond the top.',
  },
  {
    id: 'ad-click',
    idea: 'Count clicks by when they happened, fast for dashboards, exact for invoices.',
    picture: [
      { icon: Zap, label: 'Click with an id' },
      { icon: Waves, label: 'Log in Kafka' },
      { icon: Timer, label: 'Event-time window' },
      { icon: ScrollText, label: 'Batch recount bills' },
    ],
    analogy: 'a shop’s live till count versus the accountant’s end-of-day books.',
    hook: 'Stream for speed, batch for money, dedupe on click_id.',
  },
  {
    id: 'reservations',
    idea: 'Never sell one room twice: an atomic conditional update, then a hold that expires.',
    picture: [
      { icon: CalendarCheck, label: 'Check availability' },
      { icon: Lock, label: 'Atomic decrement' },
      { icon: Hourglass, label: 'Hold with expiry' },
      { icon: CreditCard, label: 'Pay, then confirm' },
    ],
    analogy: 'putting an item on hold at a shop counter: it’s yours for ten minutes, then back on the shelf.',
    hook: 'Decrement atomically, hold briefly, pay outside the transaction.',
  },
  {
    id: 'metrics-monitoring',
    idea: 'Store compressed samples, downsample the past, and page on symptoms, not causes.',
    picture: [
      { icon: Radio, label: 'Scrape or push' },
      { icon: Database, label: 'Compressed TSDB' },
      { icon: Layers, label: 'Downsample cold data' },
      { icon: Gauge, label: 'Alert on burn rate' },
    ],
    analogy: 'a car dashboard: gauges now, a trip log for later, and a warning light only when it matters.',
    hook: 'Watch cardinality, keep min/max, page on SLO burn.',
  },
  {
    id: 'google-maps',
    idea: 'Three planes: tiles from a CDN, routing on a graph, live traffic from phones.',
    picture: [
      { icon: Map, label: 'Tiles from CDN' },
      { icon: Route, label: 'Route on the graph' },
      { icon: MapPin, label: 'Phones send fixes' },
      { icon: Gauge, label: 'Live speeds re-weight' },
    ],
    analogy: 'a printed atlas, a navigator with shortcuts memorised, and radio traffic reports.',
    hook: 'Preprocess the graph once, re-weight it every minute.',
  },
  {
    id: 'nearby-friends',
    idea: 'Each user publishes to their own channel; friends’ servers drop far updates.',
    picture: [
      { icon: MapPin, label: 'Publish my location' },
      { icon: Radio, label: 'My pub/sub channel' },
      { icon: Filter, label: 'Distance filter' },
      { icon: Users, label: 'Push to near friends' },
    ],
    analogy: 'a group chat where your phone silently ignores messages from friends in other cities.',
    hook: 'Fan out by friendship, filter by distance, forget in minutes.',
  },
  {
    id: 'object-storage',
    idea: 'Write immutable fragments first, then commit metadata; the metadata write is the commit.',
    picture: [
      { icon: Package, label: 'Split into k+m' },
      { icon: HardDrive, label: 'Spread across domains' },
      { icon: KeyRound, label: 'Commit metadata row' },
      { icon: ShieldCheck, label: 'Scrub and repair' },
    ],
    analogy: 'tearing a letter into numbered pieces and mailing them to different friends: any k pieces rebuild it.',
    hook: 'Bytes first, pointer last, any k of k+m.',
  },
  {
    id: 'stock-exchange',
    idea: 'Sequence every order once, then match it single-threaded in memory, deterministically.',
    picture: [
      { icon: Send, label: 'Order arrives' },
      { icon: ListOrdered, label: 'Sequencer numbers it' },
      { icon: FileClock, label: 'Journal it' },
      { icon: Cpu, label: 'Match in memory' },
    ],
    analogy: 'a deli ticket machine: whoever holds the lower number is served first, every time.',
    hook: 'One order, one number, one thread, replay forever.',
  },
  {
    id: 'collab-editor',
    idea: 'One owner per document orders everyone’s edits; clients apply their own instantly.',
    picture: [
      { icon: Zap, label: 'Apply locally' },
      { icon: KeyRound, label: 'Owner orders edits' },
      { icon: GitMerge, label: 'Transform or merge' },
      { icon: History, label: 'Log, then snapshot' },
    ],
    analogy: 'a meeting scribe who writes every suggestion in order, fixing line numbers as the text shifts.',
    hook: 'Type locally, order centrally, converge everywhere.',
  },
  {
    id: 'llm-serving',
    idea: 'GPU memory, not compute, sets how many requests run; batch continuously to fill it.',
    picture: [
      { icon: Calculator, label: 'Reserve token budget' },
      { icon: Split, label: 'Schedule to a replica' },
      { icon: MemoryStick, label: 'Prefill fills KV cache' },
      { icon: Bot, label: 'Decode streams tokens' },
    ],
    analogy: 'a restaurant where table space, not the chef, limits how many diners you can seat.',
    hook: 'KV cache is capacity; cost per million tokens is the score.',
  },
]
