import type { ReactNode } from 'react'
import { RotateCcw, Sparkles } from 'lucide-react'

interface DemoFrameProps {
  title: string
  hint?: string
  onReset?: () => void
  children: ReactNode
}

/** Visual container that marks a block as an interactive playground. */
export function DemoFrame({ title, hint, onReset, children }: DemoFrameProps) {
  return (
    <section className="demo" aria-label={title}>
      <header className="demo__head">
        <span className="demo__badge"><Sparkles size={12} /> Interactive</span>
        <span className="demo__title">{title}</span>
        {onReset && (
          <button className="demo__reset" onClick={onReset} aria-label="Reset demo">
            <RotateCcw size={14} />
          </button>
        )}
      </header>
      {hint && <p className="demo__hint">{hint}</p>}
      <div className="demo__body">{children}</div>
    </section>
  )
}
