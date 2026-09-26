import { CHECK, edges, node } from './studio-prompt-helpers'
import type { StudioPrompt } from './studio-types'

// Numbers are illustrative interview-scale targets, sized so the toy capacities make trade-offs visible.
export const PROMPTS_A: StudioPrompt[] = [
  {
    id: 'url-shortener', title: 'URL shortener',
    brief: 'Shorten long URLs and redirect fast. Reads dwarf writes, and every click is logged for analytics.',
    req: { readQps: 30_000, writeQps: 1_200, storageTbPerYear: 18, p99Ms: 100, availability: '99.99%', flags: { readHeavy: true, needsAsync: true } },
    checks: [CHECK.lb, CHECK.cache, CHECK.kv, CHECK.async],
    staffMoves: ['Abuse: scan new links for phishing and rate-limit link creation per account.', 'Multi-region: redirects are read-only, so serve them from every region and give each region its own ID range.'],
    reference: {
      nodes: [node('c', 'client', 0, 2, 1), node('cdn', 'cdn', 1, 0, 1, { hitRatio: 0.3 }), node('lb', 'lb', 1, 2, 2), node('svc', 'service', 2, 2, 16, { label: 'Redirect + shorten' }), node('cache', 'cache', 3, 1, 2, { hitRatio: 0.9 }), node('kv', 'kv', 4, 2, 15, { label: 'URL store' }), node('q', 'queue', 3, 3, 3, { label: 'Click stream' }), node('w', 'worker', 4, 4, 2, { label: 'Analytics' })],
      edges: edges('c>cdn', 'c>lb', 'lb>svc', 'svc>cache', 'svc>kv', 'svc>q', 'q>w', 'w>kv'),
    },
    chapters: [{ id: 'url-shortener', label: 'URL shortener case study' }, { id: 'caching', label: 'Caching' }],
  },
  {
    id: 'news-feed', title: 'News feed',
    brief: 'Users post text and photos; followers load a ranked feed. Posting fans out to many feeds in the background.',
    req: { readQps: 40_000, writeQps: 2_000, storageTbPerYear: 20, blobTbPerYear: 200, p99Ms: 300, availability: '99.95%', flags: { readHeavy: true, needsAsync: true, largeBlobs: true } },
    checks: [CHECK.cache, CHECK.async, CHECK.blob, CHECK.kv],
    staffMoves: ['Celebrities: switch to fan-out on read above a follower threshold so one post does not trigger millions of writes.', 'Ranking: separate candidate generation from ranking so the model can change without touching storage.'],
    reference: {
      nodes: [node('c', 'client', 0, 2, 1), node('cdn', 'cdn', 1, 0, 1, { hitRatio: 0.5, label: 'Media CDN' }), node('blob', 'blob', 3, 0, 1, { label: 'Photos' }), node('lb', 'lb', 1, 2, 2), node('svc', 'service', 2, 2, 30, { label: 'Feed API' }), node('cache', 'cache', 3, 1, 2, { hitRatio: 0.9, label: 'Feed cache' }), node('kv', 'kv', 4, 2, 15, { label: 'Posts + feeds' }), node('q', 'queue', 3, 3, 3, { label: 'Fan-out' }), node('w', 'worker', 4, 4, 3, { label: 'Fan-out workers' })],
      edges: edges('c>cdn', 'cdn>blob', 'c>lb', 'lb>svc', 'svc>cache', 'svc>kv', 'svc>blob', 'svc>q', 'q>w', 'w>kv'),
    },
    chapters: [{ id: 'news-feed', label: 'News feed case study' }, { id: 'messaging', label: 'Queues & streams' }],
  },
  {
    id: 'chat', title: 'Chat app',
    brief: '1:1 and group chat with instant delivery, message history, and push notifications for offline users.',
    req: { readQps: 10_000, writeQps: 10_000, storageTbPerYear: 12, p99Ms: 200, availability: '99.99%', flags: { realtime: true, needsAsync: true } },
    checks: [CHECK.ws, CHECK.kv, CHECK.async],
    staffMoves: ['Ordering: assign per-conversation sequence numbers so every device sees the same order.', 'Reconnect storms: after a gateway restart, jitter reconnects and resume from each device’s last sequence number.'],
    reference: {
      nodes: [node('c', 'client', 0, 2, 1), node('ws', 'ws', 1, 2, 3), node('svc', 'service', 2, 2, 14, { label: 'Chat service' }), node('cache', 'cache', 3, 1, 2, { hitRatio: 0.6, label: 'Recent messages' }), node('kv', 'kv', 4, 2, 9, { label: 'Message store' }), node('q', 'queue', 3, 3, 2, { label: 'Offline events' }), node('w', 'worker', 4, 4, 14, { label: 'Push senders' })],
      edges: edges('c>ws', 'ws>svc', 'svc>cache', 'svc>kv', 'svc>q', 'q>w'),
    },
    chapters: [{ id: 'chat', label: 'Chat system case study' }, { id: 'ep-discord', label: 'How Discord was built' }],
  },
  {
    id: 'api-platform', title: 'Rate-limited public API',
    brief: 'A public REST API used by thousands of third-party apps. Protect it from noisy tenants and keep reads fast.',
    req: { readQps: 30_000, writeQps: 3_000, storageTbPerYear: 1.5, p99Ms: 150, availability: '99.9%', flags: { rateLimited: true, readHeavy: true } },
    checks: [CHECK.lb, CHECK.limiter, CHECK.cache],
    staffMoves: ['Decide fail-open vs fail-closed when the limiter’s counter store is down, per endpoint.', 'Return RateLimit headers and 429 with Retry-After so well-behaved clients back off on their own.'],
    reference: {
      nodes: [node('c', 'client', 0, 2, 1), node('lb', 'lb', 1, 2, 2, { label: 'API gateway' }), node('rl', 'ratelimit', 2, 2, 2), node('svc', 'service', 3, 2, 24, { label: 'API service' }), node('cache', 'cache', 4, 1, 2, { hitRatio: 0.85 }), node('sql', 'sql', 4, 3, 3)],
      edges: edges('c>lb', 'lb>rl', 'rl>svc', 'svc>cache', 'svc>sql'),
    },
    chapters: [{ id: 'rate-limiting', label: 'Rate limiting' }, { id: 'ai-case-gateway', label: 'LLM gateway case study' }],
  },
  {
    id: 'video', title: 'Video platform',
    brief: 'Creators upload videos; viewers worldwide stream them. Uploads are transcoded into many renditions.',
    req: { readQps: 20_000, writeQps: 200, storageTbPerYear: 1, blobTbPerYear: 500, p99Ms: 400, availability: '99.95%', flags: { global: true, largeBlobs: true, needsAsync: true, readHeavy: true } },
    checks: [CHECK.cdn, CHECK.blob, CHECK.async, CHECK.cache],
    staffMoves: ['Egress dominates cost: tune per-title encoding and CDN hit ratio before optimizing compute.', 'Make uploads resumable (chunked) so a flaky connection does not restart a 4 GB upload.'],
    reference: {
      nodes: [node('c', 'client', 0, 2, 1), node('cdn', 'cdn', 1, 0, 1, { hitRatio: 0.95, label: 'Video CDN' }), node('blob', 'blob', 3, 0, 1, { label: 'Renditions' }), node('lb', 'lb', 1, 2, 2), node('svc', 'service', 2, 2, 14, { label: 'Video API' }), node('cache', 'cache', 3, 1, 2, { hitRatio: 0.9, label: 'Metadata cache' }), node('sql', 'sql', 4, 2, 3, { label: 'Metadata' }), node('q', 'queue', 3, 3, 2, { label: 'Transcode jobs' }), node('w', 'worker', 4, 4, 2, { label: 'Transcoders' })],
      edges: edges('c>cdn', 'cdn>blob', 'c>lb', 'lb>svc', 'svc>cache', 'svc>sql', 'svc>blob', 'svc>q', 'q>w', 'w>blob', 'w>sql'),
    },
    chapters: [{ id: 'video-streaming', label: 'Video platform case study' }, { id: 'ep-netflix', label: 'How Netflix was built' }],
  },
]
