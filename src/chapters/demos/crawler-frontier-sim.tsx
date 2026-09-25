import { useEffect, useState } from 'react'
import { Pause, Play, StepForward } from 'lucide-react'
import { DemoFrame, Slider } from '../../components/ui'
import { HOSTS, initFrontier, stepFrontier } from './crawler-frontier-model'
import type { Priority } from './crawler-frontier-model'
import './crawler-demos.css'

const PRIO_LABEL: Record<Priority, string> = { 1: 'P1 · news', 2: 'P2 · wiki', 3: 'P3 · other' }

export function CrawlerFrontierSim() {
  const [state, setState] = useState(initFrontier)
  const [delay, setDelay] = useState(3)
  const [workers, setWorkers] = useState(2)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setState((s) => stepFrontier(s, delay, workers)), 650)
    return () => clearInterval(t)
  }, [playing, delay, workers])

  const reset = () => { setPlaying(false); setState(initFrontier()) }
  const frontTotal = state.front[1].length + state.front[2].length + state.front[3].length

  return (
    <DemoFrame title="URL frontier: priority in front, politeness in back" onReset={reset}
      hint="A host can't be fetched again until its crawl delay expires. Raise the delay and watch the back queues fill up while workers sit idle.">
      <div className="crw__controls">
        <button className="btn btn--primary btn--sm" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pause' : 'Run'}
        </button>
        <button className="btn btn--secondary btn--sm" onClick={() => setState((s) => stepFrontier(s, delay, workers))} disabled={playing}>
          <StepForward size={14} /> Step
        </button>
        <div className="crw__slider"><Slider label="Crawl delay (ticks)" min={1} max={8} value={delay} onChange={setDelay} /></div>
        <div className="crw__slider"><Slider label="Fetch workers" min={1} max={4} value={workers} onChange={setWorkers} /></div>
      </div>

      <div className="crw__lanes">
        <section>
          <div className="demo-label">Front queues (prioritizer) · {frontTotal}</div>
          {([1, 2, 3] as Priority[]).map((p) => (
            <div key={p} className={`crw__queue crw__queue--p${p}`}>
              <span className="crw__qname">{PRIO_LABEL[p]}</span>
              <div className="crw__items">
                {state.front[p].slice(0, 6).map((u) => <span key={u.url} className="crw__chip">{u.url.split('.example')[1] || '/'}</span>)}
                {state.front[p].length > 6 && <span className="crw__more">+{state.front[p].length - 6}</span>}
              </div>
            </div>
          ))}
        </section>
        <section>
          <div className="demo-label">Back queues (one per host)</div>
          {HOSTS.map((h) => {
            const wait = Math.max(0, state.nextAllowed[h] - state.tick)
            return (
              <div key={h} className={`crw__queue ${wait > 0 ? 'is-cooling' : ''}`}>
                <span className="crw__qname">{h.replace('.example', '')}</span>
                <div className="crw__items">
                  {state.back[h].slice(0, 5).map((u, i) => <span key={u.url + i} className="crw__chip">{u.url.split('.example')[1] || '/'}</span>)}
                  {state.back[h].length > 5 && <span className="crw__more">+{state.back[h].length - 5}</span>}
                </div>
                <span className="crw__timer mono" aria-label={`${h} ready in ${wait} ticks`}>{wait > 0 ? `⏳${wait}` : 'ready'}</span>
              </div>
            )
          })}
        </section>
      </div>

      <div className="crw__stats">
        <div><span>Tick</span><strong>{state.tick}</strong></div>
        <div><span>Fetched</span><strong>{state.fetched}</strong></div>
        <div><span>Unique URLs seen</span><strong>{state.seen.length}</strong></div>
        <div><span>Duplicates dropped</span><strong>{state.dupes}</strong></div>
      </div>
      <ul className="crw__log" aria-label="Fetch log">
        {state.log.map((e, i) => (
          <li key={`${e.tick}-${e.url}-${i}`}><span className="mono">t{e.tick}</span> fetched <b>{e.url}</b> → +{e.discovered} new, {e.dupes} dup</li>
        ))}
      </ul>
    </DemoFrame>
  )
}
