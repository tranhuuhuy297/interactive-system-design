/** Prefix trie where every node caches its top-k completions, so a lookup is O(prefix length). */
export interface QueryFreq { q: string; freq: number }

export interface TrieNode {
  children: Map<string, TrieNode>
  topK: QueryFreq[]
}

const node = (): TrieNode => ({ children: new Map(), topK: [] })

export function buildTrie(entries: QueryFreq[], k: number): { root: TrieNode; nodeCount: number } {
  const root = node()
  let nodeCount = 1
  for (const e of entries) {
    let cur = root
    for (const ch of e.q) {
      let nxt = cur.children.get(ch)
      if (!nxt) { nxt = node(); cur.children.set(ch, nxt); nodeCount += 1 }
      cur = nxt
    }
  }
  // Precompute top-k at every node offline: this is what makes reads cheap.
  const sorted = [...entries].sort((a, b) => b.freq - a.freq || a.q.localeCompare(b.q))
  for (const e of sorted) {
    let cur: TrieNode | undefined = root
    for (const ch of e.q) {
      cur = cur.children.get(ch)
      if (!cur) break
      if (cur.topK.length < k) cur.topK.push(e)
    }
  }
  return { root, nodeCount }
}

/** Nodes along the prefix; stops early (returns shorter path) when the prefix leaves the trie. */
export function walk(root: TrieNode, prefix: string): TrieNode[] {
  const path: TrieNode[] = []
  let cur: TrieNode | undefined = root
  for (const ch of prefix) {
    cur = cur.children.get(ch)
    if (!cur) break
    path.push(cur)
  }
  return path
}

export const SEED: QueryFreq[] = [
  { q: 'weather', freq: 980 }, { q: 'weather tomorrow', freq: 410 }, { q: 'web design', freq: 120 },
  { q: 'wedding dresses', freq: 150 }, { q: 'whatsapp web', freq: 620 }, { q: 'wikipedia', freq: 540 },
  { q: 'world cup', freq: 700 }, { q: 'wordle', freq: 660 }, { q: 'word counter', freq: 210 },
  { q: 'twitch', freq: 380 }, { q: 'twitter', freq: 590 }, { q: 'translate', freq: 870 },
  { q: 'train times', freq: 230 }, { q: 'travel insurance', freq: 140 }, { q: 'trello', freq: 90 },
  { q: 'tesla', freq: 450 }, { q: 'tesla stock', freq: 330 }, { q: 'tax refund', freq: 260 },
  { q: 'taylor swift', freq: 520 }, { q: 'time zone converter', freq: 170 }, { q: 'timer', freq: 400 },
]
