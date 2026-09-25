import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import './styles/tokens.css'
import './components/ui/ui-kit.css'
import './components/ui/system-design-kit.css'
import './components/ui/episode-player.css'
import { AppShell } from './components/shell/app-shell'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
)
