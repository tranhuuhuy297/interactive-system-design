import { useEffect, useState } from 'react'
import { Button, DemoFrame, Segmented } from '../../components/ui'
import './pay-demos.css'

type Mode = 'naive' | 'idempotent'

interface Step {
  actor: 'client' | 'server' | 'psp' | 'network'
  text: string
  /** Charge created at the PSP on this step, if any. */
  charge?: string
  bad?: boolean
}

const SCRIPTS: Record<Mode, Step[]> = {
  naive: [
    { actor: 'client', text: 'POST /payments { amount: 5000 } (no key)' },
    { actor: 'server', text: 'Creates payment row p_1, calls the PSP' },
    { actor: 'psp', text: 'Card authorized and captured', charge: 'ch_A $50.00' },
    { actor: 'network', text: 'Response lost. The client times out after 10 s', bad: true },
    { actor: 'client', text: 'Retries: POST /payments { amount: 5000 }' },
    { actor: 'server', text: 'Sees a brand-new request, creates p_2, calls the PSP' },
    { actor: 'psp', text: 'Captured again', charge: 'ch_B $50.00', bad: true },
    { actor: 'client', text: '200 OK. The customer was charged twice', bad: true },
  ],
  idempotent: [
    { actor: 'client', text: 'POST /payments  Idempotency-Key: 7f3c…  { amount: 5000 }' },
    { actor: 'server', text: 'INSERT idempotency_keys(7f3c, status=processing), which is unique' },
    { actor: 'psp', text: 'Called with the same key forwarded, captured', charge: 'ch_A $50.00' },
    { actor: 'server', text: 'Stores the response on the key row: status=succeeded' },
    { actor: 'network', text: 'Response lost. The client times out', bad: true },
    { actor: 'client', text: 'Retries with the SAME Idempotency-Key: 7f3c…' },
    { actor: 'server', text: 'Key exists with status=succeeded, so it replays the stored response' },
    { actor: 'client', text: '200 OK. Exactly one charge' },
  ],
}

/** Step through a retry-after-timeout with and without idempotency keys. */
export function PayIdempotencyDemo() {
  const [mode, setMode] = useState<Mode>('naive')
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(false)
  const script = SCRIPTS[mode]

  const done = at >= script.length
  const running = playing && !done // derived, so reaching the end stops playback without an extra render

  useEffect(() => {
    if (!running) return
    const t = setTimeout(() => setAt((a) => a + 1), 900)
    return () => clearTimeout(t)
  }, [running, at])

  const changeMode = (m: Mode) => { setMode(m); setAt(0); setPlaying(false) }
  const charges = script.slice(0, at).filter((s) => s.charge)

  return (
    <DemoFrame title="Retry after timeout: double charge vs idempotency key" onReset={() => changeMode(mode)}
      hint="Networks fail after the side effect happened. The client cannot tell whether the charge went through.">
      <div className="pay-idem">
        <div className="pay-idem__bar">
          <Segmented label="Server behaviour" value={mode} onChange={changeMode}
            options={[{ value: 'naive', label: 'No idempotency' }, { value: 'idempotent', label: 'Idempotency key' }]} />
          <div className="pay-idem__btns">
            <Button size="sm" onClick={() => setAt((a) => Math.max(0, a - 1))} disabled={at === 0}>Back</Button>
            <Button size="sm" onClick={() => setAt((a) => Math.min(script.length, a + 1))} disabled={done}>Step</Button>
            <Button size="sm" variant="primary" onClick={() => { if (done) { setAt(0); setPlaying(true) } else setPlaying(!running) }}>
              {running ? 'Pause' : done ? 'Replay' : 'Play'}
            </Button>
          </div>
        </div>

        <div className="pay-idem__grid">
          <ol className="pay-idem__log" aria-live="polite">
            {script.map((s, i) => (
              <li key={i} className={`pay-idem__step pay-idem__step--${s.actor} ${i < at ? 'is-shown' : ''} ${i === at - 1 ? 'is-current' : ''} ${s.bad ? 'is-bad' : ''}`}>
                <span className="pay-idem__actor">{s.actor}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
          <div className="pay-idem__psp">
            <div className="demo-label">Charges at the PSP</div>
            {charges.length === 0 && <p className="pay-muted">None yet</p>}
            {charges.map((c) => <div key={c.charge} className="pay-idem__charge">{c.charge}</div>)}
            {done && (
              <div className={`pay-idem__verdict ${charges.length > 1 ? 'is-bad' : 'is-good'}`}>
                {charges.length > 1 ? `Customer billed $${charges.length * 50}.00 for a $50 order` : 'Billed once: $50.00'}
              </div>
            )}
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
