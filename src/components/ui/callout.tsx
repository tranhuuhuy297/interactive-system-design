import type { ReactNode } from 'react'
import { AlertTriangle, Crown, Info, Lightbulb, Skull } from 'lucide-react'

type Kind = 'info' | 'tip' | 'warn' | 'staff' | 'pitfall'

const META: Record<Kind, { icon: typeof Info; label: string }> = {
  info: { icon: Info, label: 'Note' },
  tip: { icon: Lightbulb, label: 'Tip' },
  warn: { icon: AlertTriangle, label: 'Watch out' },
  staff: { icon: Crown, label: 'Staff signal' },
  pitfall: { icon: Skull, label: 'Common pitfall' },
}

/** Aside box. Use kind="staff" for what distinguishes a staff-level answer. */
export function Callout({ kind = 'info', title, children }: { kind?: Kind; title?: string; children: ReactNode }) {
  const { icon: Icon, label } = META[kind]
  return (
    <aside className={`callout callout--${kind}`}>
      <div className="callout__head">
        <Icon size={16} aria-hidden />
        <span>{title ?? label}</span>
      </div>
      <div className="callout__body">{children}</div>
    </aside>
  )
}
