import type { ArchEdge, ArchNode } from '../../components/ui'

// Fixed grid (x: 10/28/46/64/82, y: 12/30/50/70/88) keeps nodes apart and positions stable across stages.
const node = (id: string, label: string, kind: ArchNode['kind'], x: number, y: number, sub?: string): ArchNode =>
  ({ id, label, kind, x, y, ...(sub ? { sub } : {}) })

export const N = {
  cdn: node('cdn', 'Commercial CDN', 'cdn', 28, 12, 'popular videos'),
  ggc: node('ggc', 'Caches in ISPs', 'cdn', 28, 12, 'Google Global Cache'),
  cid: node('cid', 'Content ID', 'worker', 46, 12, 'fingerprint match'),
  live: node('live', 'Live ingest', 'worker', 64, 12, 'segment + transcode'),
  hist: node('hist', 'Watch history', 'db', 82, 30, 'signals'),
  client: node('client', 'Viewers', 'client', 10, 50, 'web + apps'),
  web: node('web', 'Web app', 'service', 28, 50, 'Python + Apache'),
  vitess: node('vitess', 'Vitess', 'service', 46, 50, 'query router'),
  rec: node('rec', 'Recommender', 'worker', 82, 50, 'candidates → rank'),
  mysql: node('mysql', 'MySQL', 'db', 46, 70, 'metadata'),
  replicas: node('replicas', 'Read replicas', 'db', 64, 70),
  thumbs: node('thumbs', 'Thumbnails', 'storage', 82, 70, 'many tiny files'),
  creators: node('creators', 'Creators', 'client', 10, 88, 'uploads'),
  video: node('video', 'Video servers', 'cdn', 28, 88, 'lighttpd'),
  encode: node('encode', 'Transcoding', 'worker', 46, 88, 'many renditions'),
  store: node('store', 'Video storage', 'storage', 64, 88, 'originals + renditions'),
} satisfies Record<string, ArchNode>

/** Same node with a stage-specific label or subtitle. */
export const as = (n: ArchNode, label: string, sub?: string): ArchNode => ({ ...n, label, sub })

export const e = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })
