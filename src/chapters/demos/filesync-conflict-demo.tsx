import { useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import { threeWayMerge } from './filesync-models'
import './filesync-demos.css'

const BASE = ['# Trip plan', 'Fly out Friday 7am', 'Hotel: Riverside Inn', 'Dinner: noodle bar', 'Budget: $800']

type Overlap = 'different' | 'same'
type Strategy = 'lww' | 'copy' | 'merge'

const edits = (overlap: Overlap) => ({
  phone: BASE.map((l, i) => (i === 1 ? 'Fly out Friday 9am' : l)),
  laptop: BASE.map((l, i) => (overlap === 'same' && i === 1 ? 'Fly out Thursday 6pm' : i === 4 ? 'Budget: $1,100' : l)),
})

const STEPS = [
  'Both devices start from server v3 and go offline.',
  'Each device edits locally while offline.',
  'Phone reconnects first: its base (v3) matches the server, so the write is accepted as v4.',
  'Laptop reconnects: its base is v3 but the server is now at v4. The version check fails, so this is a conflict.',
]

function Doc({ lines, base, label, tone }: { lines: string[]; base: string[]; label: string; tone?: string }) {
  return (
    <div className={`fs__doc ${tone ?? ''}`}>
      <div className="demo-label">{label}</div>
      {lines.map((l, i) => <div key={i} className={`fs__line ${l !== base[i] ? 'is-changed' : ''}`}>{l}</div>)}
    </div>
  )
}

export function FilesyncConflictDemo() {
  const [overlap, setOverlap] = useState<Overlap>('different')
  const [strategy, setStrategy] = useState<Strategy>('copy')
  const [step, setStep] = useState(0)
  const { phone, laptop } = edits(overlap)
  const merged = threeWayMerge(BASE, laptop, phone)
  const hasConflict = merged.some((m) => m.kind === 'conflict')

  const reset = () => { setStep(0); setOverlap('different'); setStrategy('copy') }
  const serverVersion = step >= 2 ? 4 : 3

  return (
    <DemoFrame title="Two offline edits, one file: resolving the conflict" onReset={reset}
      hint="Step through the timeline, then compare resolution strategies. Watch which edits survive.">
      <div className="fs__bar">
        <Segmented label="Edit overlap" value={overlap} onChange={(v) => { setOverlap(v); setStep(0) }}
          options={[{ value: 'different', label: 'Different lines' }, { value: 'same', label: 'Same line' }]} />
        <button className="btn btn--primary btn--sm" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}>Next step</button>
      </div>
      <ol className="fs__steps">
        {STEPS.map((s, i) => <li key={i} className={i === step ? 'is-active' : i < step ? 'is-done' : ''}>{s}</li>)}
      </ol>

      <div className="fs__docs">
        <Doc lines={step >= 1 ? phone : BASE} base={BASE} label="📱 Phone" />
        <Doc lines={step >= 1 ? laptop : BASE} base={BASE} label="💻 Laptop" />
        <Doc lines={step >= 2 ? phone : BASE} base={BASE} label={`☁️ Server v${serverVersion}`} tone="is-server" />
      </div>

      {step === STEPS.length - 1 && (
        <div className="fs__resolve">
          <Segmented label="Strategy" value={strategy} onChange={setStrategy}
            options={[{ value: 'lww', label: 'Last writer wins' }, { value: 'copy', label: 'Conflicted copy' }, { value: 'merge', label: '3-way merge' }]} />
          <div className="fs__docs">
            {strategy === 'lww' && <>
              <Doc lines={laptop} base={BASE} label="Server v5 (laptop overwrote)" tone="is-server" />
              <p className="fs__verdict is-bad">The phone's change is silently lost. Unacceptable for user documents.</p>
            </>}
            {strategy === 'copy' && <>
              <Doc lines={phone} base={BASE} label="trip.md (v4)" tone="is-server" />
              <Doc lines={laptop} base={BASE} label="trip (Laptop's conflicted copy).md" />
              <p className="fs__verdict">Nothing is lost, but the user has to reconcile by hand. This is the safe default for opaque files.</p>
            </>}
            {strategy === 'merge' && <>
              <div className="fs__doc is-server">
                <div className="demo-label">Server v5 (merged)</div>
                {merged.map((m, i) => <div key={i} className={`fs__line is-${m.kind}`}>{m.text}</div>)}
              </div>
              <p className={`fs__verdict ${hasConflict ? 'is-bad' : 'is-good'}`}>
                {hasConflict ? 'Both sides changed the same line, so a human (or a CRDT/OT editor) still has to decide.' : 'Non-overlapping edits merge cleanly. This only works for formats the server understands, such as text.'}
              </p>
            </>}
          </div>
        </div>
      )}
    </DemoFrame>
  )
}
