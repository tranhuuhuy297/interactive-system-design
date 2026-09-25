import { useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import { POISONED_EMAIL, simulateInjection, type AttackStyle, type Defenses, type PathResult } from './ai-sec-injection-model'
import './ai-sec-demos.css'

const LAYERS: { key: keyof Defenses; label: string; hint: string }[] = [
  { key: 'tagging', label: 'Mark untrusted content', hint: 'Delimit email text as data (spotlighting)' },
  { key: 'allowlist', label: 'Tool allowlist', hint: 'Summarizer gets read-only tools' },
  { key: 'confirmSend', label: 'Confirm before send', hint: 'Human approves any outbound action' },
  { key: 'urlFilter', label: 'Output URL filter', hint: 'Only allowlisted domains render' },
]

const NONE: Defenses = { allowlist: false, confirmSend: false, tagging: false, urlFilter: false }

function PathCard({ title, r }: { title: string; r: PathResult }) {
  const label = r.status === 'leaked' ? 'Data leaked' : r.status === 'blocked' ? `Blocked by ${r.by}` : 'Not attempted'
  return (
    <div className={`aisec__path aisec__path--${r.status}`}>
      <div className="aisec__path-head"><span>{title}</span><b>{label}</b></div>
      <p>{r.text}</p>
    </div>
  )
}

export function AiSecInjectionDemo() {
  const [attack, setAttack] = useState<AttackStyle>('naive')
  const [d, setD] = useState<Defenses>(NONE)
  const r = simulateInjection(attack, d)

  return (
    <DemoFrame title="Indirect prompt injection: an email summarizer vs a poisoned newsletter" onReset={() => { setAttack('naive'); setD(NONE) }}
      hint="User asks: “Summarize my new emails.” One email hides instructions for the AI. Turn defenses on and see which attack paths still work. Scripted scenario.">
      <div className="aisec">
        <div className="demo-controls">
          <div>
            <div className="demo-label">Attacker</div>
            <Segmented label="Attack style" value={attack} onChange={setAttack}
              options={[{ value: 'naive', label: 'Naive' }, { value: 'adaptive', label: 'Adaptive' }]} />
          </div>
          <fieldset className="aisec__layers">
            <legend>Defense layers</legend>
            {LAYERS.map((l) => (
              <label key={l.key} className="aisec__layer">
                <input type="checkbox" checked={d[l.key]} onChange={(e) => setD((p) => ({ ...p, [l.key]: e.target.checked }))} />
                <span><b>{l.label}</b><small>{l.hint}</small></span>
              </label>
            ))}
          </fieldset>
          <div className={`aisec__verdict ${r.leaked ? 'is-bad' : 'is-good'}`} role="status">
            {r.leaked ? 'Exfiltration succeeded' : 'No data left the system'}
          </div>
        </div>

        <div className="aisec__right">
          <div>
            <div className="demo-label">Poisoned email (untrusted input)</div>
            <pre className="aisec__email">{POISONED_EMAIL}</pre>
          </div>
          <div className="aisec__model">
            Model {r.followed ? <b className="is-bad">followed</b> : <b className="is-good">ignored</b>} the embedded instruction
            {attack === 'adaptive' && d.tagging && ' (adaptive wording evaded the delimiters)'}.
          </div>
          <PathCard title="Path A: send_email tool" r={r.toolPath} />
          <PathCard title="Path B: markdown image in the summary" r={r.imagePath} />
          <div>
            <div className="demo-label">What the user sees</div>
            <p className="aisec__rendered mono">{r.rendered}</p>
          </div>
        </div>
      </div>
      <p className="aisec__note">
        In real systems no layer is deterministic: delimiting only lowers the odds that a model follows injected text.
        The reliable controls are the ones enforced in code, like capability limits, approvals, and output filtering.
      </p>
    </DemoFrame>
  )
}
