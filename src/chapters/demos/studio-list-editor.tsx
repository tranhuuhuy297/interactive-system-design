import { ChevronDown } from 'lucide-react'
import { CATALOG } from './studio-catalog'
import { STUDIO_ICONS } from './studio-icons'
import { StudioInspector, type InspectorProps } from './studio-inspector'
import { nodeName } from './studio-labels'

interface ListEditorProps extends Omit<InspectorProps, 'selectedEdge' | 'onConnectStart'> {
  highlight: string[]
  onConnect: (from: string, to: string) => void
}

/** Small-screen editor: the same design as a list, with connections picked from a menu. */
export function StudioListEditor(p: ListEditorProps) {
  return (
    <ul className="studio-list" aria-label="Components in your design">
      {p.design.nodes.map((n) => {
        const item = CATALOG[n.kind]
        const Icon = STUDIO_ICONS[n.kind]
        const open = p.selectedId === n.id
        const load = p.loads?.get(n.id)
        const targets = p.design.nodes.filter((t) => t.id !== n.id && !p.design.edges.some((e) => e.from === n.id && e.to === t.id))
        return (
          <li key={n.id} className={`studio-list__item ${p.highlight.includes(n.id) ? 'is-flagged' : ''}`}>
            <button className="studio-list__row" aria-expanded={open} onClick={() => p.onSelect(open ? '' : n.id)}>
              <Icon size={16} aria-hidden />
              <span className="studio-list__name">{n.label || item.short}</span>
              <span className="studio-list__meta">{n.kind === 'client' ? 'source' : `×${n.units}`}{load && Number.isFinite(load.capacity) && load.onPath ? ` · ${Math.round(load.util * 100)}%` : ''}</span>
              <ChevronDown size={14} aria-hidden className="studio-list__chev" />
            </button>
            <div className="studio-list__edges">
              {p.design.edges.filter((e) => e.from === n.id).map((e) => <span key={e.to}>→ {nodeName(p.design, e.to)}</span>)}
            </div>
            {open && (
              <div className="studio-list__body">
                <StudioInspector {...p} selectedEdge={null} />
                {targets.length > 0 && (
                  <label className="studio-field"><span>Add a connection</span>
                    <select value="" onChange={(e) => e.target.value && p.onConnect(n.id, e.target.value)}>
                      <option value="">Send traffic to…</option>
                      {targets.map((t) => <option key={t.id} value={t.id}>{t.label || CATALOG[t.kind].short}</option>)}
                    </select>
                  </label>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
