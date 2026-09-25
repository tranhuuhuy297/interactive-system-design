import { useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { simulateCoalescing, type Routing } from './episode-discord-coalescing-model'
import './episode-discord-demos.css'

const WINDOW_MS = 1000
const MAX_DRAWN = 400
const DEFAULTS = { clients: 2000, latency: 20, instances: 4, routing: 'hash' as Routing, coalesce: false }

export function EpisodeDiscordCoalescingDemo() {
  const [clients, setClients] = useState(DEFAULTS.clients)
  const [latency, setLatency] = useState(DEFAULTS.latency)
  const [instances, setInstances] = useState(DEFAULTS.instances)
  const [routing, setRouting] = useState<Routing>(DEFAULTS.routing)
  const [coalesce, setCoalesce] = useState(DEFAULTS.coalesce)

  const r = useMemo(() => simulateCoalescing({ clients, windowMs: WINDOW_MS, latencyMs: latency, instances, routing, coalesce }),
    [clients, latency, instances, routing, coalesce])

  const reset = () => {
    setClients(DEFAULTS.clients); setLatency(DEFAULTS.latency); setInstances(DEFAULTS.instances)
    setRouting(DEFAULTS.routing); setCoalesce(DEFAULTS.coalesce)
  }
  const drawn = r.spans.slice(0, MAX_DRAWN)
  const rowH = 100 / instances

  return (
    <DemoFrame title="A hot channel: request coalescing in the data-service tier" onReset={reset}
      hint="Everyone opens the same busy channel within one second. Each dot is a database query. Toy model.">
      <div className="dsc-co">
        <div className="demo-controls">
          <Slider label="Clients reading the channel" min={10} max={5000} step={10} value={clients} onChange={setClients}
            format={(v) => v.toLocaleString('en-US')} />
          <Slider label="DB query latency" min={5} max={200} step={5} value={latency} onChange={setLatency} format={(v) => `${v} ms`} />
          <Slider label="Data-service instances" min={1} max={8} value={instances} onChange={setInstances} />
          <div>
            <div className="demo-label">Coalescing</div>
            <Segmented label="Coalescing" value={coalesce ? 'on' : 'off'} onChange={(v) => setCoalesce(v === 'on')}
              options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]} />
          </div>
          <div>
            <div className="demo-label">Routing</div>
            <Segmented label="Routing" value={routing} onChange={setRouting}
              options={[{ value: 'hash', label: 'Hash by channel' }, { value: 'random', label: 'Random instance' }]} />
          </div>
        </div>

        <div className="dsc-co__out">
          <div className="dsc-co__stats" aria-live="polite">
            <div><span>DB queries</span><strong>{r.queries.toLocaleString('en-US')}</strong><small>for {clients.toLocaleString('en-US')} reads</small></div>
            <div><span>Peak in flight</span><strong>{r.peakInFlight}</strong><small>concurrent queries</small></div>
            <div><span>Avg wait</span><strong>{r.avgWaitMs.toFixed(1)} ms</strong><small>per reader</small></div>
          </div>
          <svg className="dsc-co__chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
            aria-label={`${r.queries} database queries across ${instances} instances over one second`}>
            {Array.from({ length: instances }, (_, k) => (
              <rect key={k} x={0} y={k * rowH} width={100} height={rowH} className={k % 2 ? 'dsc-co__lane' : 'dsc-co__lane dsc-co__lane--alt'} />
            ))}
            {drawn.map((s, k) => (
              <rect key={k} className="dsc-co__q" x={(s.start / WINDOW_MS) * 100} width={Math.max(0.4, ((s.end - s.start) / WINDOW_MS) * 100)}
                y={s.instance * rowH + rowH * 0.25} height={rowH * 0.5} />
            ))}
          </svg>
          <div className="dsc-co__axis"><span>0 ms</span><span>{routing === 'hash' ? 'lane 1 = channel owner' : `${instances} instances`}</span><span>{WINDOW_MS} ms</span></div>
          {r.spans.length > MAX_DRAWN && <p className="dsc-co__note">Showing the first {MAX_DRAWN} of {r.queries.toLocaleString('en-US')} queries.</p>}
          <p className="dsc-co__note">
            {coalesce && routing === 'random'
              ? 'Coalescing only merges requests that land on the same instance. Random routing splits the hot channel, so each instance runs its own copy of the query.'
              : coalesce
                ? 'All readers of this channel reach one instance, which keeps one query in flight and fans the result out.'
                : 'Every reader becomes its own query. The database sees the full stampede.'}
          </p>
        </div>
      </div>
    </DemoFrame>
  )
}
