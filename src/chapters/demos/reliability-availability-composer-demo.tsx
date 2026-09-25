import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, DemoFrame } from '../../components/ui'
import { downtime, parallel, serial } from './reliability-sim'
import './reliability-demos.css'

interface Dep { id: number; name: string; a: number; replicas: number }

const NINES = [0.99, 0.995, 0.999, 0.9995, 0.9999, 0.99999]
const DEFAULTS: Dep[] = [
  { id: 1, name: 'Load balancer', a: 0.9999, replicas: 1 },
  { id: 2, name: 'App servers', a: 0.999, replicas: 3 },
  { id: 3, name: 'Cache', a: 0.999, replicas: 1 },
  { id: 4, name: 'Primary DB', a: 0.9995, replicas: 1 },
  { id: 5, name: 'Payment provider', a: 0.999, replicas: 1 },
]
const pct = (a: number) => `${(a * 100).toFixed(a > 0.9999 ? 4 : 3)}%`

export function ReliabilityAvailabilityComposerDemo() {
  const [deps, setDeps] = useState<Dep[]>(DEFAULTS)
  const effective = deps.map((d) => parallel(d.a, d.replicas))
  const total = serial(effective)
  const dt = downtime(total)
  const weakest = deps[effective.indexOf(Math.min(...effective))]

  const update = (id: number, patch: Partial<Dep>) => setDeps((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  const add = () => setDeps((ds) => [...ds, { id: Date.now(), name: `Dependency ${ds.length + 1}`, a: 0.999, replicas: 1 }])

  return (
    <DemoFrame title="Availability composer: every hard dependency multiplies" onReset={() => setDeps(DEFAULTS)}
      hint="Each row is on the critical path, so availabilities multiply. Replicas are redundant copies that each fail independently. That is the optimistic assumption: shared AZs, config pushes and deploys correlate failures.">
      <div className="av__rows">
        {deps.map((d, i) => (
          <div key={d.id} className={`av__row ${weakest?.id === d.id ? 'is-weakest' : ''}`}>
            <input className="av__name" value={d.name} aria-label="Dependency name" onChange={(e) => update(d.id, { name: e.target.value })} />
            <select value={d.a} aria-label={`${d.name} availability`} onChange={(e) => update(d.id, { a: Number(e.target.value) })}>
              {NINES.map((n) => <option key={n} value={n}>{pct(n)}</option>)}
            </select>
            <label className="av__rep">×
              <input type="number" min={1} max={5} value={d.replicas} aria-label={`${d.name} replicas`}
                onChange={(e) => update(d.id, { replicas: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
            </label>
            <span className="av__eff mono">{pct(effective[i])}</span>
            <button className="av__del" aria-label={`Remove ${d.name}`} onClick={() => setDeps((ds) => ds.filter((x) => x.id !== d.id))}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <Button size="sm" onClick={add} disabled={deps.length >= 8}><Plus size={14} />Add dependency</Button>

      <div className="av__total">
        <div><span className="demo-label">End-to-end availability</span><strong className="mono">{pct(total)}</strong></div>
        <div><span className="demo-label">Downtime / year</span><strong className="mono">{dt.year}</strong></div>
        <div><span className="demo-label">Downtime / month</span><strong className="mono">{dt.month}</strong></div>
        {weakest && <div><span className="demo-label">Weakest link</span><strong>{weakest.name}</strong></div>}
      </div>
    </DemoFrame>
  )
}
