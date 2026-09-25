import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves the site from /<repo>/; dev server stays at root.
  base: command === 'build' ? '/interactive-system-design/' : '/',
}))
