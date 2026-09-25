import { useCallback, useEffect, useState } from 'react'
import { useMediaQuery } from '../../lib/use-media-query'
import { chapterById } from '../../data/chapters-registry'
import { useHashRoute } from '../../lib/use-hash-route'
import { useProgress } from '../../lib/use-progress'
import { useTheme } from '../../lib/use-theme'
import { HomePage } from '../home/home-page'
import { ChapterView } from './chapter-view'
import { CommandPalette } from './command-palette'
import { SidebarNavigation } from './sidebar-navigation'
import { TopBar } from './top-bar'
import './app-shell.css'

export function AppShell() {
  const route = useHashRoute()
  const chapter = chapterById(route)
  const { theme, toggle } = useTheme()
  const { reset } = useProgress()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 900px)')
  const drawerOpen = isMobile && menuOpen

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o) }
      else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault(); setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Drawer: Escape closes it and focus moves into it while open.
  useEffect(() => {
    if (!drawerOpen) return
    document.querySelector<HTMLElement>('.sidebar .nav__item')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.querySelector<HTMLElement>('.topbar__menu')?.focus()
    }
  }, [drawerOpen])

  useEffect(() => { if (!chapter) document.title = 'Blueprint — The System Design Handbook' }, [chapter])

  const closeSearch = useCallback(() => setSearchOpen(false), [])

  return (
    <div className="shell">
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
      <SidebarNavigation route={route} open={drawerOpen} hidden={isMobile && !menuOpen} onNavigate={() => setMenuOpen(false)} />
      {drawerOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <div className="shell__main">
        <TopBar chapter={chapter} theme={theme} onToggleTheme={toggle}
          onOpenSearch={() => setSearchOpen(true)} onOpenMenu={() => setMenuOpen(true)} />
        <main id="main" tabIndex={-1}>
          {chapter ? <ChapterView chapter={chapter} /> : <HomePage onOpenSearch={() => setSearchOpen(true)} />}
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={closeSearch} onToggleTheme={toggle} onResetProgress={reset} />
    </div>
  )
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}
