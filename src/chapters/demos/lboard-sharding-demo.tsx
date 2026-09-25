import { useRef, useState } from 'react'
import { Badge, Button, DemoFrame, Segmented } from '../../components/ui'
import {
  RANGE_LABELS, SHARDS, mulberry32, seedScores, shardOf, top10Cost, zrevrange, type Scores, type ShardMode,
} from './lboard-model'
import './lboard-demos.css'

/** Compare hash vs score-range sharding: query fan-out, balance, and cross-shard moves. */
export function LboardShardingDemo() {
  const [mode, setMode] = useState<ShardMode>('hash')
  const [scores, setScores] = useState<Scores>(seedScores)
  const [moves, setMoves] = useState(0)
  const rand = useRef(mulberry32(99))

  const play = () => {
    const members = Object.keys(scores)
    let moved = 0
    const next = { ...scores }
    for (let i = 0; i < 15; i++) {
      const m = members[Math.floor(rand.current() * members.length)]
      const before = shardOf(mode, m, next[m])
      next[m] += 10 + Math.floor(rand.current() * 50)
      if (shardOf(mode, m, next[m]) !== before) moved += 1
    }
    setScores(next)
    setMoves((x) => x + moved)
  }

  const reset = () => { setScores(seedScores()); setMoves(0); rand.current = mulberry32(99) }
  const shards = Array.from({ length: SHARDS }, (_, i) =>
    zrevrange(scores, 0, Infinity).filter(([m, v]) => shardOf(mode, m, v) === i))
  const cost = top10Cost(mode, scores)
  const max = Math.max(...shards.map((s) => s.length))

  return (
    <DemoFrame title="Sharding a leaderboard: hash vs score range" onReset={reset}
      hint="Play matches and watch players cross shard boundaries under range sharding.">
      <div className="lb-sh__bar">
        <Segmented label="Sharding" value={mode} onChange={(m) => { setMode(m); setMoves(0) }}
          options={[{ value: 'hash', label: 'hash(user) % 3' }, { value: 'range', label: 'by score range' }]} />
        <Button size="sm" onClick={play}>Play 15 matches</Button>
      </div>
      <div className="lb-sh__shards">
        {shards.map((rows, i) => (
          <div key={i} className="lb-sh__shard">
            <div className="lb-sh__head">
              <strong>Shard {i}</strong>
              <small>{mode === 'range' ? RANGE_LABELS[i] : `hash ≡ ${i}`}</small>
            </div>
            <div className="lb-sh__load"><span style={{ width: `${(rows.length / max) * 100}%` }} /></div>
            <ul>
              {rows.slice(0, 6).map(([m, v]) => <li key={m}><span>{m}</span><span className="mono">{v}</span></li>)}
              {rows.length > 6 && <li className="lb-sh__more">+{rows.length - 6} more</li>}
            </ul>
          </div>
        ))}
      </div>
      <div className="lb-sh__stats">
        <div><span className="demo-label">Top-10 query</span><strong>{cost.shards} shard{cost.shards > 1 ? 's' : ''} · {cost.rows} rows</strong><small>{cost.note}</small></div>
        <div><span className="demo-label">Cross-shard moves</span><strong>{moves}</strong><small>{mode === 'range' ? 'each = ZREM on old shard + ZADD on new, not atomic' : 'never: shard depends only on user id'}</small></div>
        <div><span className="demo-label">User rank query</span><strong>{mode === 'hash' ? `${SHARDS} shards` : '1 shard + counts'}</strong><small>{mode === 'hash' ? 'must count higher scores on every shard' : 'count of higher shards + local ZREVRANK'}</small></div>
      </div>
      <div className="lb-sh__verdict">
        <Badge tone={mode === 'hash' ? 'success' : 'warning'}>{mode === 'hash' ? 'balanced writes' : 'hot top shard risk'}</Badge>
        <Badge tone={mode === 'hash' ? 'warning' : 'success'}>{mode === 'hash' ? 'fan-out reads' : 'cheap top-K & rank'}</Badge>
      </div>
    </DemoFrame>
  )
}
