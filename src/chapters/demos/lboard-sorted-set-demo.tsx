import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Button, DemoFrame } from '../../components/ui'
import { mulberry32, seedScores, zincrby, zrevrange, zrevrank, type Scores } from './lboard-model'
import './lboard-demos.css'

const KEY = 'lb:2026-09'

/** Live Redis sorted-set leaderboard: ZINCRBY writes, ZREVRANGE top-10, ZREVRANK + "around me". */
export function LboardSortedSetDemo() {
  const [scores, setScores] = useState<Scores>(seedScores)
  const [log, setLog] = useState<string[]>([])
  const rand = useRef(mulberry32(7))

  const apply = (updates: [string, number][]) => {
    setScores((s) => updates.reduce((acc, [m, by]) => zincrby(acc, m, by), s))
    setLog((l) => [...updates.map(([m, by]) => `ZINCRBY ${KEY} ${by} ${m}`), ...l].slice(0, 7))
  }

  const simulate = () => {
    const members = Object.keys(scores).filter((m) => m !== 'you')
    const ups: [string, number][] = Array.from({ length: 10 }, () => [
      members[Math.floor(rand.current() * members.length)], 5 + Math.floor(rand.current() * 36),
    ])
    apply(ups)
  }

  const top = zrevrange(scores, 0, 9)
  const myRank = zrevrank(scores, 'you')
  const around = zrevrange(scores, Math.max(0, myRank - 2), myRank + 2)
  const reset = () => { setScores(seedScores()); setLog([]); rand.current = mulberry32(7) }

  return (
    <DemoFrame title="Sorted-set leaderboard" onReset={reset}
      hint="Win matches as “you” and watch your rank climb. Every operation is O(log N).">
      <div className="lb-ss__actions">
        <Button size="sm" variant="primary" onClick={() => apply([['you', 25]])}>You win a match (+25)</Button>
        <Button size="sm" onClick={() => apply([['you', 60]])}>Tournament win (+60)</Button>
        <Button size="sm" onClick={simulate}>Simulate 10 other matches</Button>
      </div>
      <div className="lb-ss__grid">
        <div>
          <div className="demo-label">ZREVRANGE {KEY} 0 9 WITHSCORES</div>
          <ol className="lb-ss__list">
            {top.map(([m, v], i) => (
              <motion.li key={m} layout transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                className={`lb-ss__row ${m === 'you' ? 'is-you' : ''}`}>
                <span className="lb-ss__rank">{i + 1}</span><span>{m}</span><span className="mono">{v}</span>
              </motion.li>
            ))}
          </ol>
        </div>
        <div className="lb-ss__side">
          <div className="lb-ss__me">
            <div className="demo-label">ZREVRANK {KEY} you</div>
            <div className="lb-ss__bigrank">#{myRank + 1}<small> of {Object.keys(scores).length}</small></div>
          </div>
          <div>
            <div className="demo-label">Around me: ZREVRANGE {Math.max(0, myRank - 2)} {myRank + 2}</div>
            <ul className="lb-ss__around">
              {around.map(([m, v]) => (
                <li key={m} className={m === 'you' ? 'is-you' : ''}>
                  <span>#{zrevrank(scores, m) + 1}</span><span>{m}</span><span className="mono">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="demo-label">Command log</div>
            <ul className="lb-ss__log mono">
              {log.length === 0 && <li>—</li>}
              {log.map((l, i) => <li key={`${l}-${i}`}>{l}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
