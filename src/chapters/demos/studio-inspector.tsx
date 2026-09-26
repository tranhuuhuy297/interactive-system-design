import { Link2, Minus, Plus, Trash2, X } from 'lucide-react'
import { CATALOG } from './studio-catalog'
import { STUDIO_ICONS } from './studio-icons'
import { nodeName } from './studio-labels'
import type { Design, NodeLoad, StudioEdge, StudioNode } from './studio-types'

export interface InspectorProps {
  design: Design
  selectedId: string | null
  selectedEdge: StudioEdge | null
  loads?: Map<string, NodeLoad>
  onUpdate: (id: string, patch: Partial<Pick<StudioNode, 'label' | 'units' | 'hitRatio'>>) => void
  onDelete: (id: string) => void
  onDisconnect: (from: string, to: string) => void
  /** Omitted in list mode, where connections are picked from a menu instead. */
  onConnectStart?: (id: string) => void
  onSelect: (id: string) => void
}

const fmt = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '∞')

export function StudioInspector(p: InspectorProps) {
  const n = p.design.nodes.find((x) => x.id === p.selectedId)
  if (p.selectedEdge && !n) {
    const e = p.selectedEdge
    return (
      <aside className="studio-inspector" aria-label="Connection">
        <h4>Connection</h4>
        <p className="studio-inspector__edge">{nodeName(p.design, e.from)} → {nodeName(p.design, e.to)}</p>
        <button className="btn btn--secondary btn--sm" onClick={() => p.onDisconnect(e.from, e.to)}><Trash2 size={14} /> Remove connection</button>
      </aside>
    )
  }
  if (!n) {
    return (
      <aside className="studio-inspector studio-inspector--help" aria-label="How to use the canvas">
        <h4>How to sketch</h4>
        <ol>
          <li>Click or drag components from the palette.</li>
          <li>Click a component’s <strong>●</strong> handle, then click another component to connect them.</li>
          <li>Select a component to set replicas, shards, or cache hit ratio.</li>
          <li>Press <strong>Review design</strong> when you are ready.</li>
        </ol>
        <p className="studio-inspector__keys">Keyboard: Tab to a component, Enter selects, arrows move, C starts a connection, Delete removes.</p>
      </aside>
    )
  }
  const item = CATALOG[n.kind]
  const Icon = STUDIO_ICONS[n.kind]
  const load = p.loads?.get(n.id)
  const outs = p.design.edges.filter((e) => e.from === n.id)
  const ins = p.design.edges.filter((e) => e.to === n.id)
  const cacheLike = n.kind === 'cache' || n.kind === 'cdn'
  return (
    <aside className="studio-inspector" aria-label={`${item.name} settings`}>
      <div className="studio-inspector__head"><Icon size={18} aria-hidden /><div><h4>{item.name}</h4><p>{item.blurb}</p></div></div>
      <label className="studio-field"><span>Label</span>
        <input value={n.label ?? ''} placeholder={item.short} maxLength={40} onChange={(e) => p.onUpdate(n.id, { label: e.target.value })} />
      </label>
      {n.kind !== 'client' && (
        <div className="studio-field"><span>{item.unitLabel}</span>
          <div className="studio-stepper">
            <button aria-label={`Fewer ${item.unitLabel}`} onClick={() => p.onUpdate(n.id, { units: n.units - 1 })} disabled={n.units <= 1}><Minus size={14} /></button>
            <input type="number" min={1} max={999} value={n.units} aria-label={item.unitLabel} onChange={(e) => p.onUpdate(n.id, { units: Number(e.target.value) || 1 })} />
            <button aria-label={`More ${item.unitLabel}`} onClick={() => p.onUpdate(n.id, { units: n.units + 1 })}><Plus size={14} /></button>
          </div>
        </div>
      )}
      {cacheLike && (
        <label className="studio-field"><span>Hit ratio · {Math.round((n.hitRatio ?? item.defaultHit ?? 0) * 100)}%</span>
          <input type="range" min={0} max={0.99} step={0.01} value={n.hitRatio ?? item.defaultHit ?? 0} onChange={(e) => p.onUpdate(n.id, { hitRatio: Number(e.target.value) })} />
        </label>
      )}
      {n.kind !== 'client' && (
        <p className="studio-inspector__cap">
          Toy capacity: {Number.isFinite(item.cap) ? `${fmt(item.cap)}/s per unit → ${fmt(item.cap * n.units)}/s` : 'managed, effectively unlimited'}
          {item.writeCap ? ` · writes capped at ${fmt(item.writeCap)}/s (one primary)` : ''}
        </p>
      )}
      {load && load.onPath && n.kind !== 'client' && (
        <div className="studio-inspector__load">
          <span>≈{fmt(load.reads)} reads/s · {fmt(load.writes)} writes/s</span>
          {Number.isFinite(load.capacity) && <strong className={load.util >= 1 ? 'is-over' : load.util >= 0.8 ? 'is-hot' : ''}>{Math.round(load.util * 100)}% utilized</strong>}
        </div>
      )}
      <div className="studio-inspector__links">
        <span>Sends to</span>
        {outs.length ? outs.map((e) => <Chip key={e.to} label={nodeName(p.design, e.to)} onGo={() => p.onSelect(e.to)} onRemove={() => p.onDisconnect(e.from, e.to)} />) : <em>nothing yet</em>}
        <span>Receives from</span>
        {ins.length ? ins.map((e) => <Chip key={e.from} label={nodeName(p.design, e.from)} onGo={() => p.onSelect(e.from)} onRemove={() => p.onDisconnect(e.from, e.to)} />) : <em>nothing yet</em>}
      </div>
      <div className="studio-inspector__actions">
        {p.onConnectStart && <button className="btn btn--secondary btn--sm" onClick={() => p.onConnectStart?.(n.id)}><Link2 size={14} /> Connect to…</button>}
        <button className="btn btn--ghost btn--sm" onClick={() => p.onDelete(n.id)}><Trash2 size={14} /> Delete</button>
      </div>
    </aside>
  )
}

function Chip({ label, onGo, onRemove }: { label: string; onGo: () => void; onRemove: () => void }) {
  return (
    <span className="studio-chip">
      <button onClick={onGo}>{label}</button>
      <button onClick={onRemove} aria-label={`Remove connection with ${label}`}><X size={12} /></button>
    </span>
  )
}
