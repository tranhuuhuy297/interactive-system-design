import { useMemo, useState } from 'react'
import { Button, DemoFrame, Segmented, Slider } from '../../components/ui'
import { runAgent, type Approval, type FailureMode, type RunStatus } from './ai-agent-loop-model'
import './ai-agent-demos.css'

const STATUS: Record<RunStatus, { label: string; tone: string }> = {
  done: { label: 'Task completed', tone: 'ok' },
  budget: { label: 'Stopped: step budget', tone: 'warn' },
  loop: { label: 'Stopped: loop detected', tone: 'warn' },
  awaiting: { label: 'Paused: needs approval', tone: 'info' },
  rejected: { label: 'Write rejected by human', tone: 'info' },
}

const KIND_LABEL = { thought: 'Thought', call: 'Tool call', obs: 'Observation', error: 'Error', guard: 'Guardrail', final: 'Answer' }

export function AiAgentLoopDemo() {
  const [maxSteps, setMaxSteps] = useState(8)
  const [failure, setFailure] = useState<FailureMode>('none')
  const [confirmWrites, setConfirmWrites] = useState(true)
  const [approval, setApproval] = useState<Approval>('pending')

  // Any config change starts a fresh run, so a previous approval never leaks into it.
  const configure = (fn: () => void) => { fn(); setApproval('pending') }
  const run = useMemo(() => runAgent({ maxSteps, failure, confirmWrites, approval }), [maxSteps, failure, confirmWrites, approval])
  const peak = Math.max(...run.contextPerTurn, 1)
  const status = STATUS[run.status]

  const reset = () => { setMaxSteps(8); setFailure('none'); setConfirmWrites(true); setApproval('pending') }

  return (
    <DemoFrame title="Agent loop trace: budgets, failures, and approvals" onReset={reset}
      hint="Task: “Email finance our top 3 customers from last month.” The script is deterministic; the guardrails are the point.">
      <div className="agl">
        <div className="demo-controls">
          <Slider label="Step budget" min={1} max={10} value={maxSteps} onChange={(v) => configure(() => setMaxSteps(v))} />
          <div>
            <div className="demo-label">Inject tool failure (sql_query)</div>
            <Segmented label="Tool failure" value={failure} onChange={(v) => configure(() => setFailure(v))}
              options={[{ value: 'none', label: 'None' }, { value: 'transient', label: 'Once' }, { value: 'persistent', label: 'Always' }]} />
          </div>
          <label className="agl__check">
            <input type="checkbox" checked={confirmWrites} onChange={(e) => configure(() => setConfirmWrites(e.target.checked))} />
            Require human approval for write tools
          </label>
          <div className={`agl__status agl__status--${status.tone}`} role="status">{status.label}</div>
          {run.status === 'awaiting' && (
            <div className="agl__approve">
              <Button variant="primary" size="sm" onClick={() => setApproval('approved')}>Approve send</Button>
              <Button size="sm" onClick={() => setApproval('rejected')}>Reject</Button>
            </div>
          )}
          <dl className="agl__stats">
            <div><dt>Model turns</dt><dd>{run.contextPerTurn.length}</dd></div>
            <div><dt>Input tokens (all turns)</dt><dd>{run.totalInputTokens.toLocaleString('en-US')}</dd></div>
          </dl>
        </div>

        <div className="agl__right">
          <ol className="agl__trace" aria-label="Agent trace">
            {run.events.map((ev, i) => (
              <li key={i} className={`agl__ev agl__ev--${ev.kind}`}>
                <span className="agl__step">#{ev.step}</span>
                <span className="agl__kind">{KIND_LABEL[ev.kind]}</span>
                <span className="agl__text">{ev.text}</span>
              </li>
            ))}
          </ol>
          <div className="agl__ctx" aria-label="Context size per turn">
            <div className="demo-label">Context sent per turn (tokens)</div>
            {run.contextPerTurn.map((c, i) => (
              <div key={i} className="agl__bar">
                <span>T{i + 1}</span>
                <i style={{ width: `${(c / peak) * 100}%` }} />
                <b className="mono">{c.toLocaleString('en-US')}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
