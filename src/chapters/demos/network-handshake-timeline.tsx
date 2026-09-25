import { useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import './network-demos.css'

type Seg = 'dns' | 'tcp' | 'tls' | 'req'
interface Proto { name: string; note: string; segs: { kind: Seg; rtt: number; label: string }[] }

const PROTOS: Proto[] = [
  { name: 'HTTP/1.1 · TLS 1.2', note: 'TCP handshake, then a 2-RTT TLS handshake', segs: [
    { kind: 'tcp', rtt: 1, label: 'TCP' }, { kind: 'tls', rtt: 2, label: 'TLS 1.2' }, { kind: 'req', rtt: 1, label: 'Request' }] },
  { name: 'HTTP/2 · TLS 1.3', note: 'TLS 1.3 cuts the handshake to 1 RTT', segs: [
    { kind: 'tcp', rtt: 1, label: 'TCP' }, { kind: 'tls', rtt: 1, label: 'TLS 1.3' }, { kind: 'req', rtt: 1, label: 'Request' }] },
  { name: 'HTTP/3 · QUIC', note: 'Transport and crypto handshakes combined over UDP', segs: [
    { kind: 'tls', rtt: 1, label: 'QUIC + TLS' }, { kind: 'req', rtt: 1, label: 'Request' }] },
  { name: 'HTTP/3 · 0-RTT resume', note: 'Request rides the first flight. Replayable, so idempotent requests only.', segs: [
    { kind: 'req', rtt: 1, label: 'Request (+ early data)' }] },
]

export function NetworkHandshakeTimeline() {
  const [rtt, setRtt] = useState(80)
  const [dnsCached, setDnsCached] = useState(false)
  const [reused, setReused] = useState(false)

  const rows = PROTOS.map((p) => {
    const segs = reused
      ? [{ kind: 'req' as Seg, rtt: 1, label: 'Request (warm connection)' }]
      : [...(dnsCached ? [] : [{ kind: 'dns' as Seg, rtt: 1, label: 'DNS' }]), ...p.segs]
    const total = segs.reduce((s, x) => s + x.rtt, 0)
    return { ...p, segs, total }
  })
  const maxRtt = Math.max(...rows.map((r) => r.total))

  return (
    <DemoFrame title="What a first request really costs"
      onReset={() => { setRtt(80); setDnsCached(false); setReused(false) }}
      hint="Each block is a network round trip. On a high-latency mobile link, handshakes dominate the time the user waits.">
      <div className="net-hs__controls">
        <Slider label="Round-trip time" min={5} max={300} step={5} value={rtt} onChange={setRtt} format={(v) => `${v} ms`} />
        <label className="net-toggle"><input type="checkbox" checked={dnsCached} onChange={(e) => setDnsCached(e.target.checked)} /> DNS answer cached</label>
        <label className="net-toggle"><input type="checkbox" checked={reused} onChange={(e) => setReused(e.target.checked)} /> Reuse warm connection (keep-alive)</label>
      </div>
      <ul className="net-hs">
        {rows.map((r) => (
          <li key={r.name} className="net-hs__row">
            <div className="net-hs__meta">
              <strong>{r.name}</strong>
              <small>{reused ? 'Handshakes already paid' : r.note}</small>
            </div>
            <div className="net-hs__track">
              {r.segs.map((s, i) => (
                <span key={i} className={`net-hs__seg net-hs__seg--${s.kind}`} style={{ width: `${(s.rtt / maxRtt) * 100}%`, animationDelay: `${i * 120}ms` }}
                  title={`${s.label}: ${s.rtt} RTT`}>
                  {s.label}
                </span>
              ))}
            </div>
            <span className="net-hs__total mono">{r.total * rtt} ms<small>{r.total} RTT</small></span>
          </li>
        ))}
      </ul>
      <p className="net-note">Simplified: ignores TCP slow start, server think time, and DNS resolver hops, which can each add more round trips.</p>
    </DemoFrame>
  )
}
