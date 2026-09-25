import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { annualLossProbability, fragments, minReadable, nines, overhead, tolerance } from './objstore-durability-model'
import type { Scheme } from './objstore-durability-model'
import './objstore-demos.css'

type Kind = 'replication' | 'ec'

export function ObjstoreErasureCodingDemo() {
  const [kind, setKind] = useState<Kind>('ec')
  const [copies, setCopies] = useState(3)
  const [k, setK] = useState(8)
  const [m, setM] = useState(4)
  const [afr, setAfr] = useState(2)
  const [repair, setRepair] = useState(24)
  const [failed, setFailed] = useState<Set<number>>(new Set())

  const scheme: Scheme = kind === 'replication' ? { kind, copies } : { kind, k, m }
  const n = fragments(scheme)
  const loss = annualLossProbability(scheme, afr / 100, repair)
  const nn = nines(loss)
  const liveFailed = [...failed].filter((i) => i < n).length
  const recoverable = liveFailed <= tolerance(scheme)

  const toggle = (i: number) => setFailed((prev) => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s })
  const reset = () => { setKind('ec'); setCopies(3); setK(8); setM(4); setAfr(2); setRepair(24); setFailed(new Set()) }
  const change = (fn: () => void) => { fn(); setFailed(new Set()) }

  return (
    <DemoFrame title="Replication vs erasure coding: cost, tolerance, durability" onReset={reset}
      hint="Click fragments to fail their disks. The object survives while failures stay within tolerance.">
      <div className="osd">
        <div className="demo-controls">
          <Segmented label="Scheme" value={kind} onChange={(v) => change(() => setKind(v))}
            options={[{ value: 'replication', label: 'Replication' }, { value: 'ec', label: 'Erasure coding' }]} />
          {kind === 'replication'
            ? <Slider label="Copies" min={1} max={5} value={copies} onChange={(v) => change(() => setCopies(v))} />
            : <>
                <Slider label="Data fragments (k)" min={2} max={16} value={k} onChange={(v) => change(() => setK(v))} />
                <Slider label="Parity fragments (m)" min={1} max={6} value={m} onChange={(v) => change(() => setM(v))} />
              </>}
          <Slider label="Annual disk failure rate" min={0.5} max={8} step={0.5} value={afr} onChange={setAfr} format={(v) => `${v}%`} />
          <Slider label="Repair time" min={1} max={168} value={repair} onChange={setRepair} format={(v) => `${v} h`} />
        </div>

        <div className="osd__out">
          <div className="osd__stats">
            <div><span>Raw storage per 1 TB</span><strong className="mono">{overhead(scheme).toFixed(2)} TB</strong></div>
            <div><span>Disk failures tolerated</span><strong className="mono">{tolerance(scheme)}</strong></div>
            <div><span>Modelled durability</span><strong className="mono">{nn >= 20 ? '≥ 20' : nn.toFixed(1)} nines</strong></div>
          </div>
          <div className="osd__frags" role="group" aria-label="Fragments, click to fail">
            {Array.from({ length: n }, (_, i) => {
              const parity = kind === 'ec' && i >= k
              return (
                <button key={i} className={`osd__frag ${parity ? 'is-parity' : ''} ${failed.has(i) ? 'is-failed' : ''}`}
                  onClick={() => toggle(i)} aria-pressed={failed.has(i)}
                  aria-label={`${kind === 'replication' ? 'Copy' : parity ? 'Parity' : 'Data'} fragment ${i + 1}${failed.has(i) ? ', failed' : ''}`}>
                  {kind === 'replication' ? `R${i + 1}` : parity ? `P${i - k + 1}` : `D${i + 1}`}
                </button>
              )
            })}
          </div>
          <p className={`osd__verdict ${recoverable ? '' : 'is-lost'}`} role="status">
            {recoverable
              ? `${liveFailed} failed. Readable from any ${minReadable(scheme)} surviving fragment${minReadable(scheme) > 1 ? 's' : ''}; repair rebuilds the rest.`
              : `${liveFailed} failed > tolerance ${tolerance(scheme)}. Object is unrecoverable.`}
          </p>
          <p className="osd__note">Model assumes independent failures and a fixed repair window. Real fleets see correlated failures (racks, batches, power), so place fragments across failure domains.</p>
        </div>
      </div>
    </DemoFrame>
  )
}
