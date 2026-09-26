import { motion } from 'motion/react'
import { ArrowRight, Clapperboard, Clock, Command, Crown, Sparkles, Target } from 'lucide-react'
import { CHAPTERS, GROUPS } from '../../data/chapters-registry'
import { useProgress } from '../../lib/use-progress'
import { HeroTrafficSimulator } from './hero-traffic-simulator'
import { DailyReviewHomeCard } from './daily-review-home-card'
import { InterviewSprintPlan } from './interview-sprint-plan'
import './home-page.css'

const totalMinutes = CHAPTERS.reduce((s, c) => s + c.minutes, 0)

export function HomePage({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { isDone, done } = useProgress()
  const nextUp = CHAPTERS.find((c) => !isDone(c.id)) ?? CHAPTERS[0]
  const pct = done.length / CHAPTERS.length

  return (
    <div className="home">
      <section className="hero">
        <motion.div className="hero__copy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <span className="hero__eyebrow"><Sparkles size={13} /> Staff Engineer interview edition</span>
          <h1 className="hero__title">
            Design for the <em className="accent-text">next 10×</em>,<br />not the last one.
          </h1>
          <p className="hero__lede">
            An interactive system design handbook. Estimate like an SRE, simulate every building
            block — hash rings, quorums, Raft, rate limiters, Kafka — then work classic case
            studies end-to-end at the depth staff interviews demand.
          </p>
          <div className="hero__cta">
            <a className="btn btn--primary btn--md" href={`#/${nextUp.id}`}>
              {done.length ? 'Continue' : 'Start learning'} <ArrowRight size={16} />
            </a>
            <button className="btn btn--secondary btn--md" onClick={onOpenSearch}><Command size={15} /> Search</button>
            <a className="btn btn--secondary btn--md" href="#/ep-netflix"><Clapperboard size={15} /> Watch an episode</a>
            <a className="btn btn--ghost btn--md" href="#/mock"><Target size={15} /> Mock interview</a>
          </div>
          <dl className="hero__stats">
            <div><dt>Chapters</dt><dd>{CHAPTERS.filter((c) => c.group !== 'About').length}</dd></div>
            <div><dt>Hours</dt><dd>{(totalMinutes / 60).toFixed(1)}</dd></div>
            <div><dt>Playgrounds</dt><dd>90+</dd></div>
            <div><dt>Case studies</dt><dd>{CHAPTERS.filter((c) => c.group === 'Case Studies').length}</dd></div>
          </dl>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
          <HeroTrafficSimulator />
        </motion.div>
      </section>

      <section className="progress-strip">
        <ProgressRing value={pct} />
        <div>
          <strong>{done.length ? `${done.length} of ${CHAPTERS.length} chapters complete` : 'Your journey starts here'}</strong>
          <p>Up next: <a href={`#/${nextUp.id}`}>{nextUp.title}</a> · {nextUp.minutes} min</p>
        </div>
        <div className="progress-strip__tip"><Crown size={15} /> Every chapter has <b>Staff signal</b> callouts and senior-vs-staff model answers.</div>
      </section>
      <DailyReviewHomeCard />

      {GROUPS.filter((g) => g.name !== 'About').map((g, gi) => (
        <section key={g.name} className="track" style={{ ['--hue' as string]: g.hue }}>
          <header className="track__head">
            <span className="track__num">0{gi + 1}</span>
            <div>
              <h2>{g.name}</h2>
              <p>{g.tagline}</p>
            </div>
          </header>
          <div className="track__grid">
            {CHAPTERS.filter((c) => c.group === g.name).map((c, i) => {
              const Icon = c.icon
              return (
                <motion.a key={c.id} href={`#/${c.id}`} className={`ch-card ${isDone(c.id) ? 'is-done' : ''}`}
                  initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, delay: Math.min(i, 6) * 0.04, ease: [0.22, 1, 0.36, 1] }}>
                  <span className="ch-card__icon"><Icon size={18} /></span>
                  <h3>{c.title}</h3>
                  <p>{c.blurb}</p>
                  <span className="ch-card__meta"><Clock size={12} /> {c.minutes} min {isDone(c.id) && <b>· Done</b>}</span>
                </motion.a>
              )
            })}
          </div>
        </section>
      ))}

      <InterviewSprintPlan />

      <footer className="home-foot">
        <p>
          Independent educational project. Original writing with cited sources; company names are used only to describe
          publicly documented engineering and imply no affiliation or endorsement.
        </p>
        <nav>
          <a href="#/about">About, sources &amp; license</a>
          <a href="https://github.com/tranhuuhuy297/interactive-system-design" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://github.com/tranhuuhuy297/interactive-system-design/issues" target="_blank" rel="noopener noreferrer">Report an error</a>
        </nav>
      </footer>
    </div>
  )
}

function ProgressRing({ value }: { value: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="ring" role="img" aria-label={`${Math.round(value * 100)}% complete`}>
      <defs>
        <linearGradient id="ring-g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--accent-3)" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="url(#ring-g)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset 0.8s var(--ease-out)' }} />
      <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text)">{Math.round(value * 100)}%</text>
    </svg>
  )
}
