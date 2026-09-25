import { useState } from 'react'
import { ArrowLeft, ArrowRight, TriangleAlert, Wrench, Scale } from 'lucide-react'
import { ArchitectureDiagram, DemoFrame } from '../../components/ui'
import { EVOLUTION } from './scaling-evolution-steps'
import './scaling-demos.css'

export function ScalingEvolutionStepper() {
  const [i, setI] = useState(0)
  const s = EVOLUTION[i]
  const go = (d: number) => setI((x) => Math.min(EVOLUTION.length - 1, Math.max(0, x + d)))

  return (
    <DemoFrame title="From one box to a global system" onReset={() => setI(0)}
      hint="Step through the evolution. Each stage exists because a specific bottleneck forced it, never because it looks impressive.">
      <div className="sc-steps" role="tablist" aria-label="Evolution stage">
        {EVOLUTION.map((st, k) => (
          <button key={st.title} role="tab" aria-selected={k === i} aria-label={`${k + 1}. ${st.title}`}
            className={`sc-steps__dot ${k === i ? 'is-active' : ''} ${k < i ? 'is-past' : ''}`} onClick={() => setI(k)}>
            {k + 1}
          </button>
        ))}
      </div>

      <div className="sc-head" key={i}>
        <div>
          <span className="demo-label">Stage {i + 1} of {EVOLUTION.length} · {s.users}</span>
          <h4 className="sc-head__title">{s.title}</h4>
        </div>
        <div className="sc-head__nav">
          <button className="btn btn--secondary btn--sm" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous stage"><ArrowLeft size={14} /></button>
          <button className="btn btn--primary btn--sm" onClick={() => go(1)} disabled={i === EVOLUTION.length - 1}>Next <ArrowRight size={14} /></button>
        </div>
      </div>

      <div className="sc-why">
        <div className="sc-why__card sc-why__card--pain"><TriangleAlert size={15} /><div><b>Bottleneck</b><p>{s.bottleneck}</p></div></div>
        <div className="sc-why__card sc-why__card--fix"><Wrench size={15} /><div><b>Change</b><p>{s.change}</p></div></div>
        <div className="sc-why__card sc-why__card--cost"><Scale size={15} /><div><b>Trade-off</b><p>{s.tradeoff}</p></div></div>
      </div>

      <ArchitectureDiagram key={s.title} nodes={s.nodes} edges={s.edges} flows={[s.flow]} height={320} />
    </DemoFrame>
  )
}
