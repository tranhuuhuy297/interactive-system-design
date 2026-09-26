import { useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { fmtCount, fmtMs, simulateFunnel } from './episode-youtube-funnel-model'
import './episode-youtube-demos.css'

const DEFAULTS = { corpusExp: 7, candidates: 500, rankUs: 150, workers: 16, shown: 20, budgetMs: 100 }

/** Retrieval narrows the corpus so an expensive ranker fits in the latency budget. */
export function EpisodeYoutubeFunnelDemo() {
  const [v, setV] = useState(DEFAULTS)
  const set = (k: keyof typeof DEFAULTS) => (n: number) => setV((p) => ({ ...p, [k]: n }))
  const corpus = Math.round(10 ** v.corpusExp)
  const r = simulateFunnel({ corpus, candidates: v.candidates, rankUs: v.rankUs, workers: v.workers, shown: v.shown, budgetMs: v.budgetMs })
  const maxLog = Math.log10(corpus)
  const parts = [
    { key: 'ret', label: 'Retrieval', ms: r.retrievalMs },
    { key: 'rank', label: 'Ranking', ms: r.rankMs },
    { key: 'rules', label: 'Rules', ms: r.rulesMs },
  ]
  const scale = Math.max(r.totalMs, v.budgetMs)

  return (
    <DemoFrame title="Two-stage recommender: why retrieval comes first" onReset={() => setV(DEFAULTS)}
      hint="Toy latency model with illustrative constants. Grow the candidate pool: recall rises, but ranking eats the budget.">
      <div className="yt-fn">
        <div className="demo-controls">
          <Slider label="Corpus size" min={5} max={9} step={0.5} value={v.corpusExp} onChange={set('corpusExp')} format={() => fmtCount(corpus)} />
          <Slider label="Candidates from retrieval" min={50} max={5000} step={50} value={v.candidates} onChange={set('candidates')} format={fmtCount} />
          <Slider label="Ranking cost per item" min={20} max={1000} step={10} value={v.rankUs} onChange={set('rankUs')} format={(n) => `${n} µs`} />
          <Slider label="Parallel rankers" min={1} max={64} value={v.workers} onChange={set('workers')} />
          <Slider label="Latency budget" min={30} max={300} step={10} value={v.budgetMs} onChange={set('budgetMs')} format={(n) => `${n} ms`} />
        </div>

        <div className="yt-fn__out">
          <div className="demo-label">Funnel</div>
          <ol className="yt-fn__funnel" aria-label="Items at each stage">
            {r.stages.map((s) => (
              <li key={s.label} style={{ ['--w' as string]: `${Math.max(14, (Math.log10(Math.max(s.count, 1)) / maxLog) * 100)}%` }}>
                <span className="yt-fn__bar"><strong>{fmtCount(s.count)}</strong></span>
                <span className="yt-fn__lbl">{s.label}</span>
              </li>
            ))}
          </ol>

          <div className="demo-label">Latency per request</div>
          <div className="yt-fn__track" role="img" aria-label={`Total ${fmtMs(r.totalMs)} against a ${v.budgetMs} ms budget`}>
            {parts.map((p) => (
              <span key={p.key} className={`yt-fn__seg yt-fn__seg--${p.key}`} style={{ width: `${(p.ms / scale) * 100}%` }} title={`${p.label}: ${fmtMs(p.ms)}`} />
            ))}
            <i className="yt-fn__budget" style={{ left: `${(v.budgetMs / scale) * 100}%` }} aria-hidden />
          </div>
          <div className="yt-fn__legend">
            {parts.map((p) => <span key={p.key}><i className={`yt-fn__dot yt-fn__seg--${p.key}`} />{p.label} {fmtMs(p.ms)}</span>)}
          </div>

          <div className="yt-fn__stats">
            <div className={r.withinBudget ? 'is-good' : 'is-bad'}><span>Two-stage total</span><strong>{fmtMs(r.totalMs)}</strong><small>{r.withinBudget ? 'within budget' : 'over budget'}</small></div>
            <div><span>Candidate recall</span><strong>{Math.round(r.recall * 100)}%</strong><small>toy curve</small></div>
            <div className="is-bad"><span>Rank everything instead</span><strong>{fmtMs(r.bruteForceMs)}</strong><small>per request</small></div>
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
