import { CATALOG, PALETTE_ORDER } from './studio-catalog'
import { DRAG_TYPE } from './studio-labels'
import { STUDIO_ICONS } from './studio-icons'
import type { CompKind } from './studio-types'

/** Component palette: click to add at a free spot, or drag onto the canvas. */
export function StudioPalette({ onAdd }: { onAdd: (kind: CompKind) => void }) {
  return (
    <div className="studio-palette" role="toolbar" aria-label="Add a component">
      {PALETTE_ORDER.map((kind) => {
        const item = CATALOG[kind]
        const Icon = STUDIO_ICONS[kind]
        return (
          <button key={kind} className="studio-palette__item" onClick={() => onAdd(kind)} draggable
            onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, kind); e.dataTransfer.effectAllowed = 'copy' }}
            title={`${item.name}: ${item.blurb}`}>
            <Icon size={16} aria-hidden />
            <span>{item.short}</span>
          </button>
        )
      })}
    </div>
  )
}
