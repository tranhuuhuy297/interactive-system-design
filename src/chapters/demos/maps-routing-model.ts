/** Grid road-network model for the routing visualizer: Dijkstra vs A* on weighted cells. */

export type Cell = 'road' | 'traffic' | 'wall'
export type Algo = 'dijkstra' | 'astar'

export const COLS = 22
export const ROWS = 12
export const TRAFFIC_COST = 5

export interface SearchResult {
  /** Cell indices in the order they were settled (popped from the queue). */
  visited: number[]
  path: number[]
  cost: number
}

export const idx = (r: number, c: number) => r * COLS + c
export const rowOf = (i: number) => Math.floor(i / COLS)
export const colOf = (i: number) => i % COLS

export function emptyGrid(): Cell[] {
  return Array.from({ length: ROWS * COLS }, () => 'road' as Cell)
}

/** A preset city: a river with two bridges and a congested downtown block. */
export function presetGrid(): Cell[] {
  const g = emptyGrid()
  for (let r = 0; r < ROWS; r++) if (r !== 2 && r !== 9) g[idx(r, 11)] = 'wall'
  for (let r = 3; r <= 8; r++) for (let c = 13; c <= 17; c++) g[idx(r, c)] = 'traffic'
  return g
}

const cost = (cell: Cell) => (cell === 'traffic' ? TRAFFIC_COST : 1)

/** Binary min-heap keyed by priority; small and allocation-light. */
class MinHeap {
  private items: { key: number; p: number }[] = []
  get size() { return this.items.length }
  push(key: number, p: number) {
    const a = this.items
    a.push({ key, p })
    let i = a.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (a[parent].p <= a[i].p) break
      ;[a[parent], a[i]] = [a[i], a[parent]]
      i = parent
    }
  }
  pop() {
    const a = this.items
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l].p < a[m].p) m = l
        if (r < a.length && a[r].p < a[m].p) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
}

/** Dijkstra when algo='dijkstra'; A* with Manhattan distance (admissible since min edge cost is 1). */
export function search(grid: Cell[], start: number, goal: number, algo: Algo): SearchResult {
  const n = grid.length
  const dist = new Array<number>(n).fill(Infinity)
  const prev = new Array<number>(n).fill(-1)
  const settled = new Uint8Array(n)
  const h = (i: number) => (algo === 'astar' ? Math.abs(rowOf(i) - rowOf(goal)) + Math.abs(colOf(i) - colOf(goal)) : 0)
  const heap = new MinHeap()
  const visited: number[] = []
  dist[start] = 0
  heap.push(start, h(start))

  while (heap.size) {
    const { key: u } = heap.pop()
    if (settled[u]) continue
    settled[u] = 1
    visited.push(u)
    if (u === goal) break
    const r = rowOf(u)
    const c = colOf(u)
    const nbrs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
    for (const [nr, nc] of nbrs) {
      if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue
      const v = idx(nr, nc)
      if (grid[v] === 'wall' || settled[v]) continue
      const d = dist[u] + cost(grid[v])
      if (d < dist[v]) {
        dist[v] = d
        prev[v] = u
        heap.push(v, d + h(v))
      }
    }
  }

  if (dist[goal] === Infinity) return { visited, path: [], cost: Infinity }
  const path: number[] = []
  for (let v = goal; v !== -1; v = prev[v]) path.unshift(v)
  return { visited, path, cost: dist[goal] }
}
