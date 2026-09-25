import { useEffect, useState } from 'react'
import { Menu, Moon, Search, Sun } from 'lucide-react'
import type { Chapter } from '../../data/chapters-registry'

interface TopBarProps {
  chapter?: Chapter
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onOpenSearch: () => void
  onOpenMenu: () => void
}

export function TopBar({ chapter, theme, onToggleTheme, onOpenSearch, onOpenMenu }: TopBarProps) {
  const progress = useScrollProgress()
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <header className="topbar">
      <button className="icon-btn topbar__menu" onClick={onOpenMenu} aria-label="Open navigation"><Menu size={18} /></button>
      <div className="topbar__crumbs">
        <span>Handbook</span>
        {chapter && <><span className="topbar__sep">/</span><span>{chapter.group}</span><span className="topbar__sep">/</span><strong>{chapter.title}</strong></>}
      </div>
      <button className="search-trigger" onClick={onOpenSearch}>
        <Search size={15} /> <span>Search topics…</span> <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <button className="icon-btn" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <span className="topbar__progress" style={{ transform: `scaleX(${progress})` }} aria-hidden />
    </header>
  )
}

function useScrollProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [])
  return p
}
