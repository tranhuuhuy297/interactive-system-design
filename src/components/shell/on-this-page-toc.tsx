import { useEffect, useState } from 'react'

interface Heading { id: string; text: string }

/** Right-rail TOC built from H2s inside `.chapter-body`, with scroll-spy. */
export function OnThisPageToc({ routeKey }: { routeKey: string }) {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState('')

  useEffect(() => {
    const root = document.querySelector('.chapter-body')
    if (!root) return
    let signature: string | null = null // null forces the first collect to replace the previous chapter's list
    const collect = () => {
      const hs = Array.from(root.querySelectorAll<HTMLHeadingElement>('h2[id]'))
      const next = hs.map((h) => ({ id: h.id, text: h.textContent ?? '' }))
      // Live demos mutate the DOM constantly; only re-render when the heading list actually changes.
      const sig = next.map((h) => `${h.id}\u0000${h.text}`).join('\u0001')
      if (sig === signature) return
      signature = sig
      setHeadings(next)
    }
    collect()
    // Chapters are lazy-loaded, so headings appear after the first paint.
    const mo = new MutationObserver(collect)
    mo.observe(root, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [routeKey])

  useEffect(() => {
    if (!headings.length) return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -65% 0px' },
    )
    headings.forEach((h) => { const el = document.getElementById(h.id); if (el) io.observe(el) })
    return () => io.disconnect()
  }, [headings])

  if (!headings.length) return null
  return (
    <nav className="toc" aria-label="On this page">
      <div className="toc__label">On this page</div>
      <ul>
        {headings.map((h) => (
          <li key={h.id}>
            <button className={`toc__link ${active === h.id ? 'is-active' : ''}`} aria-current={active === h.id ? 'location' : undefined}
              onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })}>
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
