import { useEffect, useRef, useState } from 'react'
import { UserMinus, UserPlus } from 'lucide-react'
import { Button, DemoFrame, Segmented, Slider } from '../../components/ui'
import { KEYS, assign, makeState, partitionFor, type Key } from './mq-kafka-sim'
import './mq-demos.css'

const TICK = 300
const REBALANCE_MS = 1500

type Mode = 'keyed' | 'round-robin'

export function MqKafkaConsumerGroupDemo() {
  const [partitions, setPartitions] = useState(4)
  const [rate, setRate] = useState(6)
  const [speed, setSpeed] = useState(3)
  const [mode, setMode] = useState<Mode>('keyed')
  const [consumers, setConsumers] = useState<string[]>(['c1', 'c2'])
  const [, force] = useState(0)

  const st = useRef(makeState(4))
  const acc = useRef({ produce: 0, consume: {} as Record<string, number>, rr: 0, nextId: 3, rebalanceUntil: 0, violations: 0 })
  const lastSeen = useRef<Record<string, number>>({})

  const owners = assign(partitions, consumers)

  const reset = () => {
    st.current = makeState(partitions)
    acc.current = { produce: 0, consume: {}, rr: 0, nextId: 3, rebalanceUntil: 0, violations: 0 }
    lastSeen.current = {}
    setConsumers(['c1', 'c2'])
    force((x) => x + 1)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reset, [partitions, mode])

  const rebalance = (next: string[]) => { acc.current.rebalanceUntil = Date.now() + REBALANCE_MS; setConsumers(next) }

  useEffect(() => {
    const id = setInterval(() => {
      const a = acc.current
      const s = st.current
      const own = assign(partitions, consumers)
      a.produce += (rate * TICK) / 1000
      while (a.produce >= 1) {
        a.produce -= 1
        const key = KEYS[Math.floor(Math.random() * KEYS.length)] as Key
        const n = ++s.perKey[key]
        const p = mode === 'keyed' ? partitionFor(key, partitions) : a.rr++ % partitions
        s.parts[p].log.push({ key, n, offset: s.parts[p].log.length })
      }
      if (Date.now() >= a.rebalanceUntil) {
        for (const c of consumers) {
          // Each consumer runs at a slightly different pace, like real hosts do.
          a.consume[c] = (a.consume[c] ?? 0) + ((speed * TICK) / 1000) * (0.4 + Math.random() * 1.2)
          const mine = Object.keys(own).map(Number).filter((p) => own[p] === c)
          let i = 0
          while (a.consume[c] >= 1 && mine.some((p) => s.parts[p].committed < s.parts[p].log.length)) {
            const p = mine[i++ % mine.length]
            const part = s.parts[p]
            if (part.committed >= part.log.length) continue
            const m = part.log[part.committed++]
            a.consume[c] -= 1
            if ((lastSeen.current[m.key] ?? 0) > m.n) a.violations += 1
            lastSeen.current[m.key] = Math.max(lastSeen.current[m.key] ?? 0, m.n)
          }
          a.consume[c] = Math.min(a.consume[c], 2)
        }
      }
      force((x) => x + 1)
    }, TICK)
    return () => clearInterval(id)
  }, [rate, speed, mode, partitions, consumers])

  const rebalancing = Date.now() < acc.current.rebalanceUntil
  const totalLag = st.current.parts.reduce((sum, p) => sum + p.log.length - p.committed, 0)

  return (
    <DemoFrame title="Partitions, keys and a consumer group" onReset={reset}
      hint="Add or remove consumers to trigger a rebalance. Switch to round-robin partitioning and watch per-key ordering break.">
      <div className="mq__controls">
        <Slider label="Partitions" min={2} max={6} value={partitions} onChange={setPartitions} />
        <Slider label="Produce rate" min={0} max={20} value={rate} onChange={setRate} format={(v) => `${v} msg/s`} />
        <Slider label="Speed per consumer" min={1} max={10} value={speed} onChange={setSpeed} format={(v) => `${v} msg/s`} />
        <div className="mq__ctl-col">
          <span className="demo-label">Partitioner</span>
          <Segmented label="Partitioner" value={mode} onChange={setMode}
            options={[{ value: 'keyed', label: 'hash(key)' }, { value: 'round-robin', label: 'round-robin' }]} />
        </div>
      </div>

      <div className="mq__group">
        <span className="demo-label">Consumer group “billing”</span>
        {consumers.map((c) => {
          const mine = Object.keys(owners).filter((p) => owners[Number(p)] === c)
          return <span key={c} className={`mq__consumer ${mine.length ? '' : 'is-idle'}`}>{c} {mine.length ? `→ P${mine.join(', P')}` : '(idle)'}</span>
        })}
        <Button size="sm" onClick={() => rebalance([...consumers, `c${acc.current.nextId++}`])} disabled={consumers.length >= 7}><UserPlus size={14} />Add</Button>
        <Button size="sm" onClick={() => rebalance(consumers.slice(0, -1))} disabled={!consumers.length}><UserMinus size={14} />Kill last</Button>
      </div>

      {rebalancing && <div className="mq__banner" role="status">Rebalancing… all consumption paused while partitions are reassigned</div>}

      <div className="mq__parts">
        {st.current.parts.map((p, i) => {
          const tail = p.log.slice(-16)
          return (
            <div key={i} className="mq__part">
              <div className="mq__part-meta">
                <strong>P{i}</strong>
                <span>{owners[i] ?? <em>unowned</em>}</span>
                <span className={`mono ${p.log.length - p.committed > 10 ? 'is-lag' : ''}`}>lag {p.log.length - p.committed}</span>
              </div>
              <div className="mq__log">
                {tail.map((m) => (
                  <span key={m.offset} className={`mq__msg mq-k-${m.key} ${m.offset < p.committed ? 'is-done' : ''}`} title={`${m.key} #${m.n} @offset ${m.offset}`}>
                    {m.key[0].toUpperCase()}{m.n}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mq__stats">
        <span>Total lag <b className="mono">{totalLag}</b></span>
        <span className={acc.current.violations ? 'is-bad' : 'is-good'}>
          Per-key order violations <b className="mono">{acc.current.violations}</b>
        </span>
        <span className="mq__legend">{KEYS.map((k) => <i key={k} className={`mq-k-${k}`}>{k}</i>)}</span>
      </div>
    </DemoFrame>
  )
}
