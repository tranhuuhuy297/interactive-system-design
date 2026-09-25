/** Pure model of a two-stage URL frontier: priority front queues → per-host politeness back queues. */

export type Priority = 1 | 2 | 3

export interface FrontierUrl { url: string; host: string; priority: Priority }

export interface FetchEvent { tick: number; url: string; host: string; discovered: number; dupes: number }

export interface FrontierState {
  tick: number
  seed: number
  front: Record<Priority, FrontierUrl[]>
  back: Record<string, FrontierUrl[]>
  nextAllowed: Record<string, number>
  seen: string[]
  dupes: number
  fetched: number
  log: FetchEvent[]
}

export const HOSTS = ['news.example', 'wiki.example', 'shop.example', 'blog.example'] as const
const PATHS = ['/', '/a', '/b', '/c', '/d', '/about', '/tag/x', '/p/1', '/p/2', '/p/3', '/cat/7', '/faq']

const priorityOf = (host: string): Priority => (host.startsWith('news') ? 1 : host.startsWith('wiki') ? 2 : 3)

// Deterministic LCG so the sim is reproducible across resets.
const rand = (s: number) => {
  const next = (s * 1664525 + 1013904223) >>> 0
  return [next / 2 ** 32, next] as const
}

const mk = (host: string, path: string): FrontierUrl => ({ url: `${host}${path}`, host, priority: priorityOf(host) })

export function initFrontier(): FrontierState {
  const seeds = HOSTS.map((h) => mk(h, '/'))
  return {
    tick: 0, seed: 42,
    front: { 1: seeds.filter((s) => s.priority === 1), 2: seeds.filter((s) => s.priority === 2), 3: seeds.filter((s) => s.priority === 3) },
    back: Object.fromEntries(HOSTS.map((h) => [h, []])),
    nextAllowed: Object.fromEntries(HOSTS.map((h) => [h, 0])),
    seen: seeds.map((s) => s.url), dupes: 0, fetched: 0, log: [],
  }
}

/** One tick: the router moves 2 URLs to host queues, then `workers` fetchers take from hosts that are allowed to be fetched. */
export function stepFrontier(prev: FrontierState, crawlDelay: number, workers: number): FrontierState {
  const s: FrontierState = structuredClone(prev)
  s.tick += 1

  // Front router: weighted pick biases toward high priority without starving the rest.
  for (let i = 0; i < 2; i++) {
    let r: number
    ;[r, s.seed] = rand(s.seed)
    const order: Priority[] = r < 0.6 ? [1, 2, 3] : r < 0.9 ? [2, 1, 3] : [3, 2, 1]
    const p = order.find((q) => s.front[q].length > 0)
    if (!p) break
    const u = s.front[p].shift()!
    s.back[u.host].push(u)
  }

  // Back selector: only hosts whose politeness timer has expired, earliest-ready first.
  const ready = HOSTS.filter((h) => s.back[h].length > 0 && s.nextAllowed[h] <= s.tick)
    .sort((a, b) => s.nextAllowed[a] - s.nextAllowed[b])
    .slice(0, workers)

  for (const host of ready) {
    const u = s.back[host].shift()!
    s.nextAllowed[host] = s.tick + crawlDelay
    s.fetched += 1
    let discovered = 0
    let dupes = 0
    for (let k = 0; k < 3; k++) {
      let r1: number, r2: number
      ;[r1, s.seed] = rand(s.seed)
      ;[r2, s.seed] = rand(s.seed)
      const link = mk(HOSTS[Math.floor(r1 * HOSTS.length)], PATHS[Math.floor(r2 * PATHS.length)])
      if (s.seen.includes(link.url)) { dupes += 1; s.dupes += 1; continue }
      s.seen.push(link.url)
      s.front[link.priority].push(link)
      discovered += 1
    }
    s.log = [{ tick: s.tick, url: u.url, host, discovered, dupes }, ...s.log].slice(0, 7)
  }
  return s
}
