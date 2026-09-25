import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { fmtNum } from './estimation-format'
import './scaling-demos.css'

type Arch = 'single' | 'tiered' | 'cached'

interface Comp { name: string; capacity: number; share: (read: number) => number; baseMs: number }

// Toy capacities (req/s) chosen to illustrate the ordering of bottlenecks, not to benchmark anything.
const ARCHS: Record<Arch, { label: string; comps: Comp[] }> = {
  single: { label: 'Single server', comps: [
    { name: 'Server (web + DB)', capacity: 800, share: () => 1, baseMs: 20 },
  ] },
  tiered: { label: 'LB + 4 web + 1 DB', comps: [
    { name: 'Load balancer', capacity: 60_000, share: () => 1, baseMs: 1 },
    { name: 'Web tier (4 × 1.5K)', capacity: 6_000, share: () => 1, baseMs: 10 },
    { name: 'Database', capacity: 3_000, share: () => 1, baseMs: 8 },
  ] },
  cached: { label: '+ cache (90% hit) + 3 replicas + autoscaled web', comps: [
    { name: 'Load balancer', capacity: 60_000, share: () => 1, baseMs: 1 },
    { name: 'Web tier (20 × 1.5K)', capacity: 30_000, share: () => 1, baseMs: 10 },
    { name: 'Cache', capacity: 150_000, share: (r) => r, baseMs: 1 },
    { name: 'Read replicas (3 × 3K)', capacity: 9_000, share: (r) => r * 0.1, baseMs: 8 },
    { name: 'Primary (writes)', capacity: 3_000, share: (r) => 1 - r, baseMs: 8 },
  ] },
}

export function ScalingSaturationSimulator() {
  const [arch, setArch] = useState<Arch>('tiered')
  const [trafficExp, setTrafficExp] = useState(3.3)
  const [readPct, setReadPct] = useState(90)
  const traffic = 10 ** trafficExp
  const read = readPct / 100
  const comps = ARCHS[arch].comps.map((c) => {
    const load = traffic * c.share(read)
    return { ...c, load, util: load / c.capacity, max: c.capacity / Math.max(c.share(read), 1e-9) }
  })
  const first = comps.reduce((a, b) => (b.max < a.max ? b : a))
  const saturated = comps.some((c) => c.util >= 1)
  // M/M/1-style inflation: latency grows as 1/(1-ρ); only illustrative.
  const latency = comps.reduce((s, c) => s + (c.share(read) > 0 ? c.baseMs / Math.max(1 - c.util, 0.02) : 0), 0)

  return (
    <DemoFrame title="Which component saturates first? (toy model)"
      onReset={() => { setArch('tiered'); setTrafficExp(3.3); setReadPct(90) }}
      hint="Capacities are made up to show the pattern. Watch latency explode as utilization nears 100%, well before anything falls over.">
      <Segmented label="Architecture" value={arch} onChange={setArch}
        options={(Object.keys(ARCHS) as Arch[]).map((k) => ({ value: k, label: ARCHS[k].label }))} />
      <div className="sc-sat">
        <div className="demo-controls">
          <Slider label="Incoming traffic" min={2} max={5} step={0.05} value={trafficExp} onChange={setTrafficExp} format={(x) => `${fmtNum(10 ** x)} req/s`} />
          <Slider label="Read share" min={50} max={99} value={readPct} onChange={setReadPct} format={(x) => `${x}%`} />
          <div className="sc-sat__stats">
            <div><span className="demo-label">Est. latency</span><strong className={`mono ${saturated ? 'is-bad' : ''}`}>{saturated ? '∞ (queues grow)' : `${latency.toFixed(0)} ms`}</strong></div>
            <div><span className="demo-label">Max sustainable</span><strong className="mono">{fmtNum(first.max)} req/s</strong></div>
            <div><span className="demo-label">First bottleneck</span><strong>{first.name}</strong></div>
          </div>
        </div>
        <ul className="sc-sat__bars">
          {comps.map((c) => {
            const u = Math.min(c.util, 1.2)
            const tone = c.util >= 1 ? 'bad' : c.util >= 0.7 ? 'warn' : 'ok'
            return (
              <li key={c.name} className={`sc-sat__row is-${tone}`}>
                <div className="sc-sat__label"><span>{c.name}</span><span className="mono">{fmtNum(c.load)} / {fmtNum(c.capacity)}</span></div>
                <div className="sc-sat__track"><span style={{ width: `${Math.min(u, 1) * 100}%` }} /></div>
                <span className="sc-sat__pct mono">{(c.util * 100).toFixed(0)}%</span>
              </li>
            )
          })}
        </ul>
      </div>
    </DemoFrame>
  )
}
