import { Suspense, lazy, useEffect, type ComponentType, type LazyExoticComponent } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock } from 'lucide-react'
import { CHAPTERS, GROUPS, chapterIndex, type Chapter } from '../../data/chapters-registry'
import { useProgress } from '../../lib/use-progress'
import { OnThisPageToc } from './on-this-page-toc'

// One lazy wrapper per chapter, created once so React keeps the loaded module.
const LAZY: Record<string, LazyExoticComponent<ComponentType>> = Object.fromEntries(
  CHAPTERS.map((c) => [c.id, lazy(c.load)]),
)

export function ChapterView({ chapter }: { chapter: Chapter }) {
  const Content = LAZY[chapter.id]
  const idx = chapterIndex(chapter.id)
  const prev = CHAPTERS[idx - 1]
  const next = CHAPTERS[idx + 1]
  const hue = GROUPS.find((g) => g.name === chapter.group)?.hue
  const { isDone, toggle } = useProgress()
  const done = isDone(chapter.id)
  const Icon = chapter.icon

  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.title = `${chapter.title} — Blueprint`
  }, [chapter.id, chapter.title])

  return (
    <div className="chapter-layout">
      <article className="chapter" style={{ ['--hue' as string]: hue }}>
        <motion.header className="chapter-head" key={chapter.id}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <div className="chapter-head__meta">
            <span className="chapter-head__icon"><Icon size={18} /></span>
            <span>{chapter.group === 'Episodes'
              ? `Episode ${String(CHAPTERS.filter((c) => c.group === 'Episodes').findIndex((c) => c.id === chapter.id) + 1).padStart(2, '0')}`
              : `Chapter ${String(idx + 1).padStart(2, '0')}`}</span>
            <span className="dot" />
            <span>{chapter.group}</span>
            <span className="dot" />
            <span><Clock size={13} /> {chapter.minutes} min</span>
          </div>
          <h1 className="chapter-head__title">{chapter.title}</h1>
          <p className="chapter-head__lede">{chapter.blurb}</p>
        </motion.header>

        <div className="chapter-body prose">
          <Suspense fallback={<ChapterSkeleton />}>
            <Content />
          </Suspense>
        </div>

        <footer className="chapter-foot">
          <button className={`complete-btn ${done ? 'is-done' : ''}`} onClick={() => toggle(chapter.id)}>
            {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            <span>{done ? 'Completed — nice work' : 'Mark chapter as complete'}</span>
          </button>
          <div className="pager">
            {prev ? (
              <a className="pager__card" href={`#/${prev.id}`}>
                <small><ArrowLeft size={13} /> Previous</small><span>{prev.title}</span>
              </a>
            ) : <span />}
            {next ? (
              <a className="pager__card pager__card--next" href={`#/${next.id}`}>
                <small>Next <ArrowRight size={13} /></small><span>{next.title}</span>
              </a>
            ) : <span />}
          </div>
        </footer>
      </article>
      <OnThisPageToc routeKey={chapter.id} />
    </div>
  )
}

function ChapterSkeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading chapter">
      {[92, 100, 78, 0, 60, 100, 85].map((w, i) => <span key={i} style={{ width: `${w}%`, height: w ? 14 : 28 }} />)}
    </div>
  )
}
