import { CATALOG } from './studio-catalog'
import type { Design } from './studio-types'

/** MIME type used when dragging a palette item onto the canvas. */
export const DRAG_TYPE = 'application/x-studio-kind'

export const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

/** Display name for a node: its custom label, else the component's short name. */
export const nodeName = (d: Design, id: string) => {
  const n = d.nodes.find((x) => x.id === id)
  return n ? n.label || CATALOG[n.kind].short : id
}
