import { useCallback, useEffect } from 'react'
import { useLocalStorageState } from './use-local-storage-state'

export type Theme = 'dark' | 'light'

/** Stored under 'sdh:theme' as JSON; index.html reads the same key before first paint. */
export const THEME_KEY = 'sdh:theme'

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'

export function useTheme() {
  const [theme, setTheme] = useLocalStorageState<Theme>(THEME_KEY, systemTheme())
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [setTheme])
  return { theme, toggle }
}
