/** Toy world for the nearby-friends simulation: users random-walk, publish, and friends filter by radius. */

export const WORLD_W = 100 // km
export const WORLD_H = 60

export interface User { id: number; x: number; y: number; vx: number; vy: number }
export interface World { users: User[]; friends: Set<number>[] }

export interface TickStats {
  published: number
  /** Messages the pub/sub layer delivers: every publish fans out to all subscribed friends. */
  delivered: number
  /** Deliveries within radius, pushed to the friend's phone. */
  forwarded: number
  filtered: number
}

/** Small seeded PRNG so a given slider setting always builds the same graph. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createWorld(n: number, avgFriends: number, seed = 7): World {
  const rnd = mulberry32(seed)
  // People cluster around a few "neighborhoods", which is what makes proximity interesting.
  const hubs = [[25, 20], [70, 18], [45, 42], [82, 45]]
  const users: User[] = Array.from({ length: n }, (_, id) => {
    const [hx, hy] = hubs[id % hubs.length]
    return { id, x: clamp(hx + (rnd() - 0.5) * 30, 0, WORLD_W), y: clamp(hy + (rnd() - 0.5) * 22, 0, WORLD_H), vx: 0, vy: 0 }
  })
  const friends = users.map(() => new Set<number>())
  const edges = Math.round((n * avgFriends) / 2)
  for (let e = 0; e < edges; e++) {
    const a = Math.floor(rnd() * n)
    // 60% of friendships stay within a neighborhood (same hub = same id mod hub count).
    const b = rnd() < 0.6
      ? (a % hubs.length) + hubs.length * Math.floor(rnd() * Math.ceil(n / hubs.length))
      : Math.floor(rnd() * n)
    if (b >= n) continue
    if (a !== b) { friends[a].add(b); friends[b].add(a) }
  }
  friends[0].add(1); friends[1].add(0) // "you" always have at least one friend
  return { users, friends }
}

export function step(world: World, rnd: () => number): World {
  const users = world.users.map((u) => {
    const vx = clamp(u.vx * 0.85 + (rnd() - 0.5) * 0.9, -1.6, 1.6)
    const vy = clamp(u.vy * 0.85 + (rnd() - 0.5) * 0.9, -1.6, 1.6)
    let x = u.x + vx
    let y = u.y + vy
    if (x < 0 || x > WORLD_W) x = clamp(x, 0, WORLD_W)
    if (y < 0 || y > WORLD_H) y = clamp(y, 0, WORLD_H)
    return { ...u, x, y, vx, vy }
  })
  return { ...world, users }
}

export const distKm = (a: User, b: User) => Math.hypot(a.x - b.x, a.y - b.y)

export function tickStats(world: World, radiusKm: number): TickStats {
  let delivered = 0
  let forwarded = 0
  world.users.forEach((u, i) => {
    for (const f of world.friends[i]) {
      delivered += 1
      if (distKm(u, world.users[f]) <= radiusKm) forwarded += 1
    }
  })
  return { published: world.users.length, delivered, forwarded, filtered: delivered - forwarded }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
