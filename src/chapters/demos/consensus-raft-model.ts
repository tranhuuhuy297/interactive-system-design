/**
 * Simplified Raft leader election (no log replication): terms, randomized timeouts,
 * RequestVote / heartbeats with network delay, one vote per term, majority wins.
 */
export type Role = 'follower' | 'candidate' | 'leader'

export interface RaftNode {
  id: number
  role: Role
  term: number
  votedFor: number | null
  votes: number
  alive: boolean
  timeout: number   // ms until election timeout fires
  timeoutMax: number
}

type Msg =
  | { kind: 'vote-req'; from: number; to: number; term: number; at: number }
  | { kind: 'vote-resp'; from: number; to: number; term: number; granted: boolean; at: number }
  | { kind: 'heartbeat'; from: number; to: number; term: number; at: number }
  | { kind: 'hb-reject'; from: number; to: number; term: number; at: number }

export interface Cluster { nodes: RaftNode[]; msgs: Msg[]; now: number; log: string[]; sinceHeartbeat: number }

const HEARTBEAT = 50
const NET_DELAY = 12
const randTimeout = () => 150 + Math.random() * 150

export function createCluster(size = 5): Cluster {
  return {
    now: 0, msgs: [], sinceHeartbeat: 0, log: ['Cluster started: all followers in term 0.'],
    nodes: Array.from({ length: size }, (_, id) => {
      const t = randTimeout()
      return { id, role: 'follower', term: 0, votedFor: null, votes: 0, alive: true, timeout: t, timeoutMax: t }
    }),
  }
}

const majority = (c: Cluster) => Math.floor(c.nodes.length / 2) + 1
const say = (c: Cluster, s: string) => { c.log = [`${(c.now / 1000).toFixed(2)}s  ${s}`, ...c.log].slice(0, 9) }
const resetTimer = (n: RaftNode) => { n.timeoutMax = randTimeout(); n.timeout = n.timeoutMax }

function stepDown(n: RaftNode, term: number) {
  n.term = term; n.role = 'follower'; n.votedFor = null; n.votes = 0
}

/** Advance the simulation by `dt` ms. Mutates and returns the cluster. */
export function tick(c: Cluster, dt: number): Cluster {
  c.now += dt

  // Deliver due messages (dropped if either side is dead).
  const due = c.msgs.filter((m) => m.at <= c.now)
  c.msgs = c.msgs.filter((m) => m.at > c.now)
  for (const m of due) {
    const to = c.nodes[m.to]
    if (!to.alive || !c.nodes[m.from].alive) continue
    if (m.term > to.term) {
      if (to.role === 'leader') say(c, `N${to.id + 1} sees term ${m.term} > ${to.term} → steps down`)
      stepDown(to, m.term)
    }
    if (m.kind === 'heartbeat') {
      if (m.term >= to.term) { to.role = 'follower'; resetTimer(to) }
      // A stale leader learns the newer term from the rejection and steps down.
      else c.msgs.push({ kind: 'hb-reject', from: to.id, to: m.from, term: to.term, at: c.now + NET_DELAY })
    } else if (m.kind === 'vote-req') {
      const grant = m.term === to.term && (to.votedFor === null || to.votedFor === m.from)
      if (grant) { to.votedFor = m.from; resetTimer(to) }
      c.msgs.push({ kind: 'vote-resp', from: to.id, to: m.from, term: to.term, granted: grant, at: c.now + NET_DELAY })
    } else if (m.kind === 'vote-resp') {
      if (to.role === 'candidate' && m.term === to.term && m.granted) {
        to.votes++
        if (to.votes >= majority(c)) {
          to.role = 'leader'
          say(c, `N${to.id + 1} wins term ${to.term} with ${to.votes}/${c.nodes.length} votes → LEADER`)
          c.sinceHeartbeat = HEARTBEAT // send heartbeats immediately
        }
      }
    }
  }

  // Leader heartbeats.
  c.sinceHeartbeat += dt
  const leaders = c.nodes.filter((n) => n.alive && n.role === 'leader')
  if (c.sinceHeartbeat >= HEARTBEAT) {
    c.sinceHeartbeat = 0
    for (const l of leaders) for (const n of c.nodes) if (n.id !== l.id) c.msgs.push({ kind: 'heartbeat', from: l.id, to: n.id, term: l.term, at: c.now + NET_DELAY })
  }

  // Election timeouts.
  for (const n of c.nodes) {
    if (!n.alive || n.role === 'leader') continue
    n.timeout -= dt
    if (n.timeout <= 0) {
      n.role = 'candidate'; n.term++; n.votedFor = n.id; n.votes = 1; resetTimer(n)
      say(c, `N${n.id + 1} timed out → candidate for term ${n.term}`)
      for (const o of c.nodes) if (o.id !== n.id) c.msgs.push({ kind: 'vote-req', from: n.id, to: o.id, term: n.term, at: c.now + NET_DELAY })
    }
  }
  return c
}

export function toggleNode(c: Cluster, id: number): Cluster {
  const n = c.nodes[id]
  n.alive = !n.alive
  if (n.alive) { n.role = 'follower'; n.votes = 0; resetTimer(n); say(c, `N${id + 1} restarted (still thinks term ${n.term})`) }
  else say(c, `N${id + 1} crashed${n.role === 'leader' ? ' (was leader)' : ''}`)
  return c
}

export const inFlight = (c: Cluster) => c.msgs.map((m) => ({ ...m, progress: 1 - (m.at - c.now) / NET_DELAY }))
