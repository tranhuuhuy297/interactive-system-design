import { useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { DEMAND, STOCK, initialInv, oversold, stepInv, type Strategy } from './episode-amazon-inventory-model'
import './episode-amazon-demos.css'

const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: 'naive', label: 'Read, then write' },
  { value: 'atomic', label: 'Atomic decrement' },
  { value: 'reserve', label: 'Reservation + TTL' },
]

type Cell = 'paid' | 'held' | 'lost' | 'free'

export function EpisodeAmazonInventoryDemo() {
  const [strategy, setStrategy] = useState<Strategy>('naive')
  const [concurrency, setConcurrency] = useState(10)
  const [abandonRate, setAbandonRate] = useState(0.3)
  const [ttl, setTtl] = useState(6)
  const [running, setRunning] = useState(false)
  const [sim, setSim] = useState(initialInv)
  const active = running && !sim.done

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setSim((s) => stepInv(s, { strategy, concurrency, abandonRate, ttl })), 220)
    return () => clearInterval(t)
  }, [active, strategy, concurrency, abandonRate, ttl])

  const restart = () => { setSim(initialInv()); setRunning(false) }
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); restart() }

  // Grid view of the 60 real units; the naive counter can disagree with reality, which is the point.
  const paidShown = Math.min(sim.paid, STOCK)
  const heldShown = Math.min(sim.claims.length, STOCK - paidShown)
  const lostShown = Math.min(sim.lost, STOCK - paidShown - heldShown)
  const cells: Cell[] = Array.from({ length: STOCK }, (_, i) =>
    i < paidShown ? 'paid' : i < paidShown + heldShown ? 'held' : i < paidShown + heldShown + lostShown ? 'lost' : 'free')
  const over = oversold(sim)

  return (
    <DemoFrame title="Flash sale: 60 units, 300 buyers" onReset={() => { restart(); setStrategy('naive'); setConcurrency(10); setAbandonRate(0.3); setTtl(6) }}
      hint="Buyers who reach checkout at the same moment race for the last units; some abandon payment. Toy model.">
      <div className="amz-inv">
        <div className="demo-controls">
          <Segmented label="Inventory strategy" options={STRATEGIES} value={strategy} onChange={change(setStrategy)} />
          <Slider label="Simultaneous buyers per tick" min={1} max={20} value={concurrency} onChange={change(setConcurrency)} />
          <Slider label="Abandon payment" min={0} max={0.6} step={0.05} value={abandonRate} onChange={change(setAbandonRate)}
            format={(v) => `${Math.round(v * 100)}%`} />
          {strategy === 'reserve' && (
            <Slider label="Hold TTL (ticks; payment takes 1–4)" min={2} max={10} value={ttl} onChange={change(setTtl)} />
          )}
          <button className="btn btn--primary btn--sm" onClick={() => { if (sim.done) { setSim(initialInv()); setRunning(true) } else setRunning((r) => !r) }}
            aria-pressed={active}>
            {active ? <><Pause size={14} /> Pause</> : <><Play size={14} /> {sim.done ? 'Run again' : sim.tick ? 'Resume' : 'Start the sale'}</>}
          </button>
        </div>

        <div className="amz-inv__stage">
          <div className="amz-inv__progress" aria-label={`${sim.arrived} of ${DEMAND} buyers arrived`}>
            <span style={{ width: `${(sim.arrived / DEMAND) * 100}%` }} />
          </div>
          <div className="amz-inv__grid" role="img" aria-label={`${paidShown} paid, ${heldShown} in checkout, ${lostShown} stuck, ${STOCK - paidShown - heldShown - lostShown} free`}>
            {cells.map((c, i) => <i key={i} className={`amz-inv__cell amz-inv__cell--${c}`} />)}
          </div>
          {over > 0 && <p className="amz-inv__over">+{over} orders paid for units that don’t exist</p>}
          <dl className="amz-inv__stats">
            <div><dt>Paid orders</dt><dd>{sim.paid}</dd></div>
            <div><dt>Oversold</dt><dd className={over ? 'amz-inv__bad' : ''}>{over}</dd></div>
            <div><dt>Stuck (never paid, never released)</dt><dd className={sim.lost ? 'amz-inv__warn' : ''}>{sim.lost}</dd></div>
            <div><dt>Paying buyers rejected (hold expired)</dt><dd className={sim.lateRejected ? 'amz-inv__warn' : ''}>{sim.lateRejected}</dd></div>
            <div><dt>Stock counter says</dt><dd>{sim.stock}</dd></div>
            <div><dt>Told “sold out”</dt><dd>{sim.turnedAway}</dd></div>
          </dl>
          <div className="amz-inv__legend">
            <span><i className="amz-inv__cell--paid" /> Paid</span><span><i className="amz-inv__cell--held" /> In checkout</span>
            <span><i className="amz-inv__cell--lost" /> Stuck</span><span><i className="amz-inv__cell--free" /> Available</span>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
