import { useEffect, useReducer, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Button, DemoFrame, Segmented } from '../../components/ui'
import { createCluster, inFlight, tick, toggleNode } from './consensus-raft-model'
import './consensus-demos.css'

const SIZE = 5
const CX = 160
const CY = 150
const RAD = 105
const pos = (i: number) => {
  const a = (i / SIZE) * Math.PI * 2 - Math.PI / 2
  return { x: CX + RAD * Math.cos(a), y: CY + RAD * Math.sin(a) }
}
const SPEEDS = { slow: 0.15, normal: 0.35, fast: 0.8 } as const

export function ConsensusRaftElectionDemo() {
  const cluster = useRef(createCluster(SIZE))
  const [, redraw] = useReducer((x: number) => x + 1, 0)
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>('normal')

  useEffect(() => {
    if (!running) return
    let last = performance.now()
    let raf = 0
    const loop = (t: number) => {
      const dt = Math.min(50, (t - last) * SPEEDS[speed])
      last = t
      // Sub-step so message delays (12 ms) are honoured at any speed.
      for (let s = 0; s < 4; s++) tick(cluster.current, dt / 4)
      redraw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, speed])

  const c = cluster.current
  const leader = c.nodes.find((n) => n.alive && n.role === 'leader')
  const aliveCount = c.nodes.filter((n) => n.alive).length

  return (
    <DemoFrame title="Raft leader election" onReset={() => { cluster.current = createCluster(SIZE); redraw() }}
      hint="Click a node to crash or restart it. Kill the leader and watch a new election. Kill 3 nodes and no leader can ever be elected.">
      <div className="raft">
        <svg viewBox="0 0 320 300" className="raft__svg" role="img" aria-label={`Raft cluster: ${leader ? `leader N${leader.id + 1}, term ${leader.term}` : 'no leader'}`}>
          {inFlight(c).map((m, i) => {
            const a = pos(m.from); const b = pos(m.to); const p = Math.max(0, Math.min(1, m.progress))
            return <circle key={i} cx={a.x + (b.x - a.x) * p} cy={a.y + (b.y - a.y) * p} r={3.2} className={`raft__msg raft__msg--${m.kind}`} />
          })}
          {c.nodes.map((n) => {
            const p = pos(n.id)
            const frac = n.role === 'leader' || !n.alive ? 0 : Math.max(0, n.timeout / n.timeoutMax)
            const circ = 2 * Math.PI * 26
            return (
              <g key={n.id} className={`raft__node raft__node--${n.alive ? n.role : 'dead'}`} onClick={() => { toggleNode(c, n.id); redraw() }}
                role="button" tabIndex={0} aria-label={`N${n.id + 1} ${n.alive ? n.role : 'crashed'}, term ${n.term}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleNode(c, n.id); redraw() } }}>
                <circle cx={p.x} cy={p.y} r={26} className="raft__timer-bg" />
                <circle cx={p.x} cy={p.y} r={26} className="raft__timer" strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} transform={`rotate(-90 ${p.x} ${p.y})`} />
                <circle cx={p.x} cy={p.y} r={21} className="raft__body" />
                <text x={p.x} y={p.y - 2} textAnchor="middle" className="raft__name">N{n.id + 1}</text>
                <text x={p.x} y={p.y + 11} textAnchor="middle" className="raft__term">t{n.term}{n.role === 'candidate' ? ` · ${n.votes}v` : ''}</text>
              </g>
            )
          })}
        </svg>

        <div className="raft__side">
          <div className="raft__controls">
            <Button size="sm" variant="primary" onClick={() => setRunning(!running)}>{running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Run</>}</Button>
            <Segmented label="Speed" value={speed} onChange={setSpeed} options={['slow', 'normal', 'fast'] as const} />
          </div>
          <div className="raft__status">
            <div><span className="demo-label">Leader</span><strong>{leader ? `N${leader.id + 1}` : '—'}</strong></div>
            <div><span className="demo-label">Term</span><strong className="mono">{Math.max(...c.nodes.map((n) => n.term))}</strong></div>
            <div><span className="demo-label">Alive</span><strong className={aliveCount < 3 ? 'is-bad' : ''}>{aliveCount}/5</strong></div>
          </div>
          {aliveCount < 3 && <p className="raft__warn">No majority (3 of 5) is reachable. Elections keep failing, and the cluster is unavailable instead of inconsistent.</p>}
          <ul className="raft__legend">
            <li><i className="lg-follower" />follower</li><li><i className="lg-candidate" />candidate</li><li><i className="lg-leader" />leader</li>
            <li><i className="lg-msg-vote" />vote traffic</li><li><i className="lg-msg-hb" />heartbeat</li>
          </ul>
          <ol className="raft__log">{c.log.map((l, i) => <li key={i}>{l}</li>)}</ol>
        </div>
      </div>
      <p className="raft__foot">The ring around each node is its randomized election timeout (150–300 ms simulated). This is simplified Raft: election only, with no log replication or up-to-date-log vote check.</p>
    </DemoFrame>
  )
}
