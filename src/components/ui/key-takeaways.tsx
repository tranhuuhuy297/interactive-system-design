import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'

export function KeyTakeaways({ items }: { items: ReactNode[] }) {
  return (
    <div className="takeaways">
      <div className="takeaways__title">Key takeaways</div>
      <ul>
        {items.map((it, i) => (
          <li key={i}><CheckCircle2 size={16} aria-hidden /> <span>{it}</span></li>
        ))}
      </ul>
    </div>
  )
}
