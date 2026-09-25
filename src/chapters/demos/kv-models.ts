/** Dynamo-style cluster model (ring, N/W/R, sloppy quorum, hinted handoff, read repair) and a Merkle tree helper. */

export interface Versioned { value: string; version: number }
export interface Hint { for: string; key: string; v: Versioned }
export interface KvNode { id: string; angle: number; up: boolean; data: Record<string, Versioned>; hints: Hint[] }
export interface InFlight { node: string; key: string; v: Versioned }
export interface Cluster { nodes: KvNode[]; inflight: InFlight[]; log: { text: string; tone: 'ok' | 'warn' | 'bad' | 'info' }[] }

export const KEYS = ['user:42', 'cart:7', 'session:9'] as const
export type Key = (typeof KEYS)[number]

export const keyAngle = (k: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h % 360
}

export function initCluster(): Cluster {
  const nodes = ['A', 'B', 'C', 'D', 'E', 'F'].map((id, i) => ({ id, angle: 20 + i * 60, up: true, data: {}, hints: [] }))
  return { nodes, inflight: [], log: [{ text: 'Cluster of 6 nodes, N = 3 replicas per key.', tone: 'info' }] }
}

/** Nodes in clockwise order starting at the key's position: the "preference list". */
export function preferenceList(c: Cluster, key: string): KvNode[] {
  const a = keyAngle(key)
  return [...c.nodes].sort((x, y) => ((x.angle - a + 360) % 360) - ((y.angle - a + 360) % 360))
}

/** Replicas a request goes to: the top-N healthy nodes (sloppy), or only the healthy nodes among the top N (strict). */
function targets(c: Cluster, key: string, n: number, sloppy: boolean) {
  const pref = preferenceList(c, key)
  const home = pref.slice(0, n)
  if (!sloppy) return { home, chosen: home.filter((x) => x.up).map((node) => ({ node, hintFor: undefined as string | undefined })) }
  const downHomes = home.filter((x) => !x.up).map((x) => x.id)
  const chosen = pref.filter((x) => x.up).slice(0, n).map((node) => ({
    node, hintFor: home.includes(node) ? undefined : downHomes.shift(),
  }))
  return { home, chosen }
}

const push = (c: Cluster, text: string, tone: Cluster['log'][number]['tone']) => { c.log = [{ text, tone }, ...c.log].slice(0, 8) }
const latestVersion = (c: Cluster, key: string) => Math.max(0, ...c.nodes.map((x) => x.data[key]?.version ?? 0), ...c.nodes.flatMap((x) => x.hints.filter((h) => h.key === key).map((h) => h.v.version)))

function deliverInflight(c: Cluster, batch: InFlight[]) {
  for (const f of batch) {
    const node = c.nodes.find((x) => x.id === f.node)!
    if (node.up && (node.data[f.key]?.version ?? 0) < f.v.version) node.data[f.key] = f.v
  }
  c.inflight = c.inflight.filter((f) => !batch.includes(f))
}

export function put(prev: Cluster, key: string, n: number, w: number, sloppy: boolean): Cluster {
  const c = structuredClone(prev)
  const pending = [...c.inflight]
  const v: Versioned = { version: latestVersion(c, key) + 1, value: `v${latestVersion(c, key) + 1}` }
  const { chosen } = targets(c, key, n, sloppy)
  // The first W replicas ack synchronously; the rest receive the write a moment later (replication lag).
  chosen.forEach(({ node, hintFor }, i) => {
    if (hintFor) node.hints.push({ for: hintFor, key, v })
    else if (i < w) node.data[key] = v
    else c.inflight.push({ node: node.id, key, v })
  })
  const acks = chosen.length
  const hinted = chosen.filter((x) => x.hintFor).map((x) => `${x.node.id} (for ${x.hintFor})`)
  if (acks >= w) push(c, `PUT ${key}=${v.value} ✓ acked by ${chosen.slice(0, w).map((x) => x.node.id).join(',')}${hinted.length ? ` · hinted: ${hinted.join(', ')}` : ''}`, hinted.length ? 'warn' : 'ok')
  else push(c, `PUT ${key}=${v.value} ✗ only ${acks} replica(s) reachable, W=${w}. Failed, yet ${acks} replica(s) still stored it`, 'bad')
  deliverInflight(c, pending)
  return c
}

export function get(prev: Cluster, key: string, n: number, r: number, sloppy: boolean): Cluster {
  const c = structuredClone(prev)
  const pending = [...c.inflight]
  // Reply order: replicas at the end of the list answer first (e.g. they are less loaded).
  const responders = [...targets(c, key, n, sloppy).chosen].reverse().slice(0, r).map((x) => x.node)
  if (responders.length < r) { push(c, `GET ${key} ✗ only ${responders.length} replica(s) reachable, R=${r}`, 'bad'); deliverInflight(c, pending); return c }
  const versions = responders.map((x) => x.data[key]?.version ?? 0)
  const best = Math.max(...versions)
  const truth = latestVersion(c, key)
  const stale = responders.filter((x) => (x.data[key]?.version ?? 0) < best)
  const bestV = responders.find((x) => (x.data[key]?.version ?? 0) === best)?.data[key]
  stale.forEach((x) => { if (bestV) x.data[key] = bestV })
  const got = best ? `v${best}` : '∅ (not found)'
  const repair = stale.length && bestV ? ` · read-repaired ${stale.map((x) => x.id).join(',')}` : ''
  if (best < truth) push(c, `GET ${key} → ${got} from ${responders.map((x) => x.id).join(',')} ⚠ STALE (latest is v${truth})${repair}`, 'bad')
  else push(c, `GET ${key} → ${got} from ${responders.map((x) => x.id).join(',')}${repair}`, stale.length ? 'warn' : 'ok')
  deliverInflight(c, pending)
  return c
}

export function toggleNode(prev: Cluster, id: string): Cluster {
  const c = structuredClone(prev)
  const node = c.nodes.find((x) => x.id === id)!
  node.up = !node.up
  if (!node.up) { push(c, `Node ${id} is DOWN`, 'warn'); return c }
  push(c, `Node ${id} is back UP`, 'info')
  for (const holder of c.nodes) {
    const mine = holder.hints.filter((h) => h.for === id)
    for (const h of mine) {
      if ((node.data[h.key]?.version ?? 0) < h.v.version) node.data[h.key] = h.v
      push(c, `Hinted handoff: ${holder.id} → ${id} (${h.key}=${h.v.value})`, 'ok')
    }
    holder.hints = holder.hints.filter((h) => h.for !== id)
  }
  return c
}

// ── Merkle tree ───────────────────────────────────────────────────────────────

export const hash6 = (s: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0').slice(0, 4)
}

/** Heap-ordered Merkle tree: index 0 = root, children of i are 2i+1 and 2i+2; leaves are the last n entries. */
export function merkle(leaves: string[]): string[] {
  const n = leaves.length
  const t: string[] = Array(2 * n - 1)
  leaves.forEach((l, i) => { t[n - 1 + i] = hash6(l) })
  for (let i = n - 2; i >= 0; i--) t[i] = hash6(t[2 * i + 1] + t[2 * i + 2])
  return t
}

/** Top-down comparison: descend only into subtrees whose hashes differ. */
export function diffMerkle(a: string[], b: string[]) {
  const visited = new Set<number>()
  const diffLeaves: number[] = []
  const n = (a.length + 1) / 2
  const walk = (i: number) => {
    visited.add(i)
    if (a[i] === b[i]) return
    if (i >= n - 1) { diffLeaves.push(i - (n - 1)); return }
    walk(2 * i + 1); walk(2 * i + 2)
  }
  walk(0)
  return { visited, diffLeaves }
}
