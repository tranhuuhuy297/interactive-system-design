import { useMemo, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import './network-demos.css'

const WINDOW = 60 // seconds simulated
const EVENTS = [3.2, 4.1, 11.7, 25.3, 26.0, 26.4, 41.8, 52.5]
const LP_TIMEOUT = 20
const RECONNECT = 0.3

interface Lane { name: string; requests: number[]; delivered: { ev: number; at: number }[]; stream?: boolean; empty: number; note: string }

function shortPoll(interval: number): Lane {
  const requests: number[] = []
  for (let t = interval; t <= WINDOW; t += interval) requests.push(t)
  const delivered = EVENTS.map((ev) => ({ ev, at: requests.find((r) => r >= ev) ?? WINDOW }))
  const empty = requests.filter((r, i) => !EVENTS.some((ev) => ev <= r && ev > (requests[i - 1] ?? 0))).length
  return { name: `Short polling (every ${interval}s)`, requests, delivered, empty, note: 'Simple and cache-friendly, but most responses are empty and latency ≈ interval/2.' }
}

function longPoll(): Lane {
  const requests: number[] = [0]
  const delivered: Lane['delivered'] = []
  let empty = 0
  let t = 0
  let k = 0
  while (t < WINDOW) {
    const next = EVENTS[k]
    if (next !== undefined && next < t + LP_TIMEOUT) {
      const at = Math.max(next, t)
      while (EVENTS[k] !== undefined && EVENTS[k] <= at) delivered.push({ ev: EVENTS[k++], at }) // batch pending events
      t = at + RECONNECT
    } else {
      t += LP_TIMEOUT
      empty++
    }
    if (t < WINDOW) requests.push(t)
  }
  return { name: `Long polling (${LP_TIMEOUT}s timeout)`, requests, delivered, empty, note: 'Near real-time, but every message costs a new HTTP request, and events can arrive during reconnect gaps.' }
}

const stream = (name: string, note: string): Lane => ({ name, requests: [0], delivered: EVENTS.map((ev) => ({ ev, at: ev })), stream: true, empty: 0, note })

export function NetworkRealtimeTransportSimulator() {
  const [interval, setInterval_] = useState(5)
  const lanes = useMemo(() => [
    shortPoll(interval),
    longPoll(),
    stream('Server-Sent Events', 'One long-lived HTTP response, server → client only. Auto-reconnect is built in.'),
    stream('WebSocket', 'One upgraded connection, full duplex. Needs sticky routing and connection-aware scaling.'),
  ], [interval])

  const pct = (t: number) => `${(t / WINDOW) * 100}%`

  return (
    <DemoFrame title="Polling vs long polling vs SSE vs WebSocket" onReset={() => setInterval_(5)}
      hint="The same 8 server events over 60 seconds. Ticks are HTTP requests, dots are deliveries, and the line is the delay.">
      <Slider label="Short-poll interval" min={1} max={15} value={interval} onChange={setInterval_} format={(v) => `${v}s`} />
      <div className="net-rt">
        <div className="net-rt__lane net-rt__lane--server">
          <span className="net-rt__name">Server events</span>
          <div className="net-rt__track">{EVENTS.map((ev) => <span key={ev} className="net-rt__ev" style={{ left: pct(ev) }} />)}</div>
          <span />
        </div>
        {lanes.map((l) => {
          const avg = l.delivered.reduce((s, d) => s + (d.at - d.ev), 0) / l.delivered.length
          return (
            <div key={l.name} className="net-rt__lane">
              <span className="net-rt__name">{l.name}<small>{l.note}</small></span>
              <div className="net-rt__track">
                {l.stream && <span className="net-rt__conn" />}
                {l.requests.map((r, i) => <span key={i} className="net-rt__req" style={{ left: pct(r) }} />)}
                {l.delivered.map((d, i) => (
                  <span key={i} className="net-rt__lag" style={{ left: pct(d.ev), width: `calc(${pct(d.at - d.ev)} + 1px)` }}>
                    <i />
                  </span>
                ))}
              </div>
              <span className="net-rt__stats mono">
                <b>{l.stream ? '1 conn' : `${l.requests.length} req`}</b>
                <span>{l.empty} empty</span>
                <span>avg {avg.toFixed(1)}s delay</span>
              </span>
            </div>
          )
        })}
        <div className="net-rt__axis"><span>0s</span><span>30s</span><span>60s</span></div>
      </div>
    </DemoFrame>
  )
}
