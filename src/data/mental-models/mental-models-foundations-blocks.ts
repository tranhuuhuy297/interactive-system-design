import {
  ArrowUpRight, Atom, Ban, CheckCircle2, Clock, Crown, Database, Eye, Fingerprint, Flag, Gauge, Globe,
  HardDrive, Inbox, Layers, ListOrdered, Lock, PenLine, Rocket, Scale, Server, Shield, Split, Target, TimerReset, Users,
  Vote, Zap, ZoomIn,
} from 'lucide-react'
import type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS_FOUNDATIONS_BLOCKS: MentalModelData[] = [
  {
    id: 'framework',
    idea: 'Lead a 45-minute design review: scope it, sketch it, go deep, land it.',
    picture: [
      { icon: Target, label: 'Frame the problem' },
      { icon: PenLine, label: 'Sketch the path' },
      { icon: ZoomIn, label: 'Deep dive with numbers' },
      { icon: Flag, label: 'Wrap up at 10×' },
    ],
    analogy: 'a pilot’s checklist: the order keeps you calm when the pressure is on.',
    hook: 'Frame, sketch, dive, land, and say the numbers out loud.',
  },
  {
    id: 'estimation',
    idea: 'Turn users into requests, bytes, and machines with rounded, spoken arithmetic.',
    picture: [
      { icon: Users, label: 'Daily users' },
      { icon: Gauge, label: 'QPS (÷ 10⁵)' },
      { icon: HardDrive, label: 'Storage & bandwidth' },
      { icon: Server, label: 'Machines needed' },
    ],
    analogy: 'packing for a trip: you count days and outfits, not individual socks.',
    hook: 'A day is 10⁵ seconds. Round hard, decide fast.',
  },
  {
    id: 'scaling',
    idea: 'Grow one bottleneck at a time: split, copy, cache, then shard.',
    picture: [
      { icon: Server, label: 'One box' },
      { icon: Split, label: 'Stateless tier behind LB' },
      { icon: Zap, label: 'Cache + replicas' },
      { icon: Layers, label: 'Shard + queues' },
    ],
    analogy: 'a restaurant: add waiters first, then a prep kitchen, then more kitchens.',
    hook: 'Fix the tightest bottleneck, then look again.',
  },
  {
    id: 'networking',
    idea: 'Every request pays for DNS, handshakes, and hops before any work happens.',
    picture: [
      { icon: Globe, label: 'DNS lookup' },
      { icon: Lock, label: 'TCP + TLS handshake' },
      { icon: ArrowUpRight, label: 'Request over HTTP' },
      { icon: Server, label: 'Gateway → service' },
    ],
    analogy: 'a phone call: find the number, wait for them to pick up, then talk.',
    hook: 'Round trips cost more than bytes. Reuse connections.',
  },
  {
    id: 'load-balancing',
    idea: 'Spread requests over healthy servers; hash keys so few move when servers change.',
    picture: [
      { icon: Users, label: 'Incoming traffic' },
      { icon: Split, label: 'Balancer picks' },
      { icon: CheckCircle2, label: 'Only healthy backends' },
      { icon: Scale, label: 'Hash ring: 1/N moves' },
    ],
    analogy: 'a host seating diners: skip closed tables, keep regulars at their usual one.',
    hook: 'Balance requests, not connections. Rings move one-Nth.',
  },
  {
    id: 'caching',
    idea: 'Keep a small, fast copy of hot data in front of the slow source of truth.',
    picture: [
      { icon: Zap, label: 'Check the cache' },
      { icon: Database, label: 'Miss? Read the DB' },
      { icon: HardDrive, label: 'Store with a TTL' },
      { icon: TimerReset, label: 'Delete on write' },
    ],
    analogy: 'a sticky note on your monitor: fast to read, but you must throw it away when the real answer changes.',
    hook: 'Cache the hot few, delete on write, and never cache without a TTL.',
  },
  {
    id: 'databases',
    idea: 'Pick the store by access pattern; shard only when one primary is exhausted.',
    picture: [
      { icon: Eye, label: 'Name the access pattern' },
      { icon: Database, label: 'Pick the family' },
      { icon: Layers, label: 'Index for the query' },
      { icon: Split, label: 'Shard by the hot key' },
    ],
    analogy: 'a library: the catalogue (index) matters more than the size of the building.',
    hook: 'Start relational. Shard on the key you query by.',
  },
  {
    id: 'consistency',
    idea: 'Copies disagree; choose who may write and how many must agree.',
    picture: [
      { icon: Crown, label: 'Who takes writes?' },
      { icon: Clock, label: 'Replicas lag' },
      { icon: Vote, label: 'Quorum: R + W > N' },
      { icon: Scale, label: 'Partition: C or A' },
    ],
    analogy: 'a group chat without signal: you either wait for everyone, or answer with what you last heard.',
    hook: 'R plus W greater than N, and a majority elects the leader.',
  },
  {
    id: 'messaging',
    idea: 'Decouple producers from consumers with a durable buffer, and make consumers idempotent.',
    picture: [
      { icon: PenLine, label: 'Producer writes' },
      { icon: ListOrdered, label: 'Queue or log' },
      { icon: Inbox, label: 'Consumers pull' },
      { icon: Fingerprint, label: 'Dedupe by ID' },
    ],
    analogy: 'a mailroom: senders drop letters off; staff sort them later, and each letter is handled once.',
    hook: 'At-least-once delivery plus idempotent consumers equals exactly-once effect.',
  },
  {
    id: 'rate-limiting',
    idea: 'Count requests per key atomically, and reject politely once the budget is spent.',
    picture: [
      { icon: Fingerprint, label: 'Identify the key' },
      { icon: Atom, label: 'Atomic count' },
      { icon: Gauge, label: 'Within budget?' },
      { icon: Ban, label: 'Else 429 + Retry-After' },
    ],
    analogy: 'a turnstile with a ticket counter: it refills at a steady rate.',
    hook: 'One atomic check per request. Decide fail-open or fail-closed early.',
  },
  {
    id: 'unique-ids',
    idea: 'Pack time, machine, and a counter into 64 bits: unique without coordination.',
    picture: [
      { icon: Clock, label: 'Timestamp (ms)' },
      { icon: Server, label: 'Worker ID' },
      { icon: ListOrdered, label: 'Sequence' },
      { icon: Fingerprint, label: 'Sortable 64-bit ID' },
    ],
    analogy: 'a ticket stamped with the date, the booth number, and a counter.',
    hook: 'Time, then worker, then sequence. Guard against clocks going backwards.',
  },
  {
    id: 'reliability',
    idea: 'Set a measurable target, spend the error budget, and contain every failure.',
    picture: [
      { icon: Target, label: 'SLO target' },
      { icon: Gauge, label: 'Error budget' },
      { icon: Shield, label: 'Timeouts, breakers, bulkheads' },
      { icon: Rocket, label: 'Safe rollouts' },
    ],
    analogy: 'a household budget for failures: spend it on shipping, stop when it runs out.',
    hook: 'Retries need backoff, jitter, and a budget.',
  },
]
