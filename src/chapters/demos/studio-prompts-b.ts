import { CHECK, edges, node } from './studio-prompt-helpers'
import type { StudioPrompt } from './studio-types'

export const PROMPTS_B: StudioPrompt[] = [
  {
    id: 'payments', title: 'Payment system',
    brief: 'Merchants charge cards through your API. Never double-charge, never lose a payment, and notify merchants by webhook.',
    req: { readQps: 3_000, writeQps: 1_000, storageTbPerYear: 1.5, p99Ms: 500, availability: '99.99%', flags: { money: true, needsAsync: true } },
    checks: [CHECK.lb, CHECK.sql, CHECK.async],
    staffMoves: ['Idempotency keys on every mutating call, stored with the result, so client retries never double-charge.', 'Reconcile the ledger daily against the processor’s settlement file; alert on any mismatch.'],
    reference: {
      nodes: [node('c', 'client', 0, 2, 1), node('lb', 'lb', 1, 2, 2), node('svc', 'service', 2, 2, 3, { label: 'Payments API' }), node('sql', 'sql', 4, 2, 3, { label: 'Payments + ledger' }), node('q', 'queue', 3, 3, 2, { label: 'Outbox events' }), node('w', 'worker', 4, 4, 2, { label: 'Webhooks' })],
      edges: edges('c>lb', 'lb>svc', 'svc>sql', 'svc>q', 'q>w', 'w>sql'),
    },
    chapters: [{ id: 'payments', label: 'Payment system case study' }, { id: 'ep-stripe', label: 'How Stripe was built' }],
  },
  {
    id: 'ride-hailing', title: 'Ride hailing',
    brief: 'Drivers stream their location every few seconds; riders request a trip and get matched to a nearby driver.',
    req: { readQps: 10_000, writeQps: 20_000, storageTbPerYear: 10, p99Ms: 300, availability: '99.99%', flags: { realtime: true, needsAsync: true } },
    checks: [CHECK.ws, CHECK.cache, CHECK.async],
    staffMoves: ['Index supply and demand in hexagonal cells so matching and surge pricing read one small area.', 'Make trip state transitions idempotent: a trip must never be lost or double-assigned during failover.'],
    reference: {
      nodes: [node('c', 'client', 0, 2, 1), node('ws', 'ws', 1, 2, 4, { label: 'Driver/rider gateway' }), node('svc', 'service', 2, 2, 20, { label: 'Location + trips' }), node('cache', 'cache', 3, 1, 2, { hitRatio: 0.9, label: 'Geo index' }), node('kv', 'kv', 4, 2, 8, { label: 'Trips + history' }), node('q', 'queue', 3, 3, 3, { label: 'Location events' }), node('w', 'worker', 4, 4, 28, { label: 'Dispatch' })],
      edges: edges('c>ws', 'ws>svc', 'svc>cache', 'svc>kv', 'svc>q', 'q>w'),
    },
    chapters: [{ id: 'ep-uber', label: 'How Uber was built' }, { id: 'proximity', label: 'Proximity service' }],
  },
  {
    id: 'autocomplete', title: 'Search autocomplete',
    brief: 'Suggest completions on every keystroke within ~100 ms. Suggestions come from aggregated query logs.',
    req: { readQps: 40_000, writeQps: 200, storageTbPerYear: 1, p99Ms: 100, availability: '99.99%', flags: { readHeavy: true, search: true, needsAsync: true } },
    checks: [CHECK.cache, CHECK.search, CHECK.async],
    staffMoves: ['Precompute top-k suggestions per prefix offline; serving is then a single lookup.', 'Shard by prefix and replicate hot prefixes (the single letter “a” gets far more traffic than “zq”).'],
    reference: {
      nodes: [node('c', 'client', 0, 2, 1), node('cdn', 'cdn', 1, 0, 1, { hitRatio: 0.3 }), node('lb', 'lb', 1, 2, 2), node('svc', 'service', 2, 2, 20, { label: 'Suggest API' }), node('cache', 'cache', 3, 1, 2, { hitRatio: 0.95, label: 'Top-k cache' }), node('search', 'search', 4, 2, 2, { label: 'Prefix index' }), node('q', 'queue', 3, 3, 2, { label: 'Query log' }), node('w', 'worker', 4, 4, 2, { label: 'Aggregators' }), node('kv', 'kv', 5, 3, 3, { label: 'Query counts' })],
      edges: edges('c>cdn', 'c>lb', 'lb>svc', 'svc>cache', 'svc>search', 'svc>q', 'q>w', 'w>search', 'w>kv'),
    },
    chapters: [{ id: 'autocomplete', label: 'Autocomplete case study' }, { id: 'caching', label: 'Caching' }],
  },
  {
    id: 'notifications', title: 'Notification system',
    brief: 'Internal services send push, SMS, and email notifications. Respect user preferences and never send twice.',
    req: { readQps: 1_000, writeQps: 10_000, storageTbPerYear: 5, p99Ms: 1_000, availability: '99.9%', flags: { needsAsync: true } },
    checks: [CHECK.lb, CHECK.async, CHECK.kv],
    staffMoves: ['Dedupe with an idempotency key per notification so retries and replays never send twice.', 'Separate queues by priority so a marketing blast never delays one-time passcodes.'],
    reference: {
      nodes: [node('c', 'client', 0, 2, 1, { label: 'Producer services' }), node('lb', 'lb', 1, 2, 2), node('svc', 'service', 2, 2, 8, { label: 'Notification API' }), node('cache', 'cache', 3, 1, 2, { hitRatio: 0.95, label: 'Preferences' }), node('kv', 'kv', 4, 2, 5, { label: 'Notification log' }), node('q', 'queue', 3, 3, 2, { label: 'Channel queues' }), node('w', 'worker', 4, 4, 14, { label: 'Channel senders' })],
      edges: edges('c>lb', 'lb>svc', 'svc>cache', 'svc>kv', 'svc>q', 'q>w', 'w>kv'),
    },
    chapters: [{ id: 'notifications', label: 'Notification system case study' }, { id: 'messaging', label: 'Queues & streams' }],
  },
  {
    id: 'llm-chat', title: 'LLM chat app',
    brief: 'A ChatGPT-style app: users send prompts, answers come from a GPU inference pool, and history is saved.',
    req: { readQps: 3_000, writeQps: 600, storageTbPerYear: 5, p99Ms: 3_000, availability: '99.9%', flags: { needsAsync: true, rateLimited: true } },
    checks: [CHECK.limiter, CHECK.async, CHECK.cache],
    staffMoves: ['Limit by tokens, not requests, with priority tiers so paying users keep service during a capacity crunch.', 'Degrade gracefully: fall back to a smaller model and shorter context before rejecting requests.'],
    reference: {
      nodes: [node('c', 'client', 0, 2, 1), node('lb', 'lb', 1, 2, 2), node('rl', 'ratelimit', 2, 2, 2, { label: 'Token limiter' }), node('svc', 'service', 3, 2, 3, { label: 'Chat API' }), node('cache', 'cache', 4, 1, 2, { hitRatio: 0.7, label: 'Conversation cache' }), node('kv', 'kv', 5, 2, 4, { label: 'History' }), node('q', 'queue', 3, 4, 2, { label: 'Inference jobs' }), node('w', 'worker', 5, 4, 2, { label: 'GPU pool' })],
      edges: edges('c>lb', 'lb>rl', 'rl>svc', 'svc>cache', 'svc>kv', 'svc>q', 'q>w', 'w>kv'),
    },
    chapters: [{ id: 'ep-chatgpt', label: 'How ChatGPT was built' }, { id: 'llm-serving', label: 'LLM inference platform' }],
  },
]
