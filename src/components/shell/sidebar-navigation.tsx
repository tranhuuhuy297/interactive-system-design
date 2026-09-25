import { Check, Home } from 'lucide-react'
import { CHAPTERS, GROUPS, chapterIndex } from '../../data/chapters-registry'
import { useProgress } from '../../lib/use-progress'

interface SidebarProps {
  route: string
  open: boolean
  /** Off-canvas and closed (mobile): remove from tab order and the a11y tree. */
  hidden?: boolean
  onNavigate: () => void
}

export function SidebarNavigation({ route, open, hidden = false, onNavigate }: SidebarProps) {
  const { isDone, done } = useProgress()
  const pct = Math.round((done.length / CHAPTERS.length) * 100)

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`} inert={hidden} aria-label="Handbook navigation">
      <a href="#/" className="brand" onClick={onNavigate}>
        <span className="brand__mark" aria-hidden><i /><i /><i /><i /></span>
        <span className="brand__name">Blueprint<small>System Design Handbook</small></span>
      </a>

      <nav className="nav" aria-label="Chapters">
        <a href="#/" className={`nav__item ${route === '' ? 'is-active' : ''}`} onClick={onNavigate}>
          <Home size={15} className="nav__icon" /> <span>Overview</span>
        </a>
        {GROUPS.map((g) => (
          <div key={g.name} className="nav__group" style={{ ['--hue' as string]: g.hue }}>
            <div className="nav__group-label">{g.name}</div>
            {CHAPTERS.filter((c) => c.group === g.name).map((c) => {
              const Icon = c.icon
              return (
                <a key={c.id} href={`#/${c.id}`} onClick={onNavigate}
                  className={`nav__item ${route === c.id ? 'is-active' : ''}`}
                  aria-current={route === c.id ? 'page' : undefined}>
                  <Icon size={15} className="nav__icon" />
                  <span className="nav__title">{c.title}</span>
                  {isDone(c.id)
                    ? <Check size={14} className="nav__done" aria-label="completed" />
                    : <span className="nav__num">{String(chapterIndex(c.id) + 1).padStart(2, '0')}</span>}
                </a>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar__progress">
        <div className="sidebar__progress-top">
          <span>Your progress</span>
          <strong>{pct}%</strong>
        </div>
        <div className="sidebar__bar"><span style={{ width: `${pct}%` }} /></div>
      </div>
    </aside>
  )
}
