import { useEffect, useRef, useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import {
  BACKEND, BACKEND_LABEL, SERVERS, USER_SERVER, routeMessage, type ChatUser, type Hop,
} from './chat-routing-model'
import './chat-demos.css'

const USERS: ChatUser[] = ['alice', 'bob', 'carol', 'dan']
const INITIAL_ONLINE: Record<ChatUser, boolean> = { alice: true, bob: true, carol: true, dan: false }

export function ChatConnectionRoutingDemo() {
  const [from, setFrom] = useState<ChatUser>('alice')
  const [to, setTo] = useState<ChatUser>('bob')
  const [online, setOnline] = useState(INITIAL_ONLINE)
  const [hops, setHops] = useState<Hop[]>([])
  const [idx, setIdx] = useState(-1)
  const seq = useRef(41)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  const send = () => {
    if (from === to || !online[from]) return
    if (timer.current) clearInterval(timer.current)
    seq.current += 1
    const h = routeMessage(from, to, online, seq.current)
    setHops(h)
    setIdx(0)
    let i = 0
    timer.current = setInterval(() => {
      i += 1
      if (i >= h.length) { if (timer.current) clearInterval(timer.current); return }
      setIdx(i)
    }, 1300)
  }

  const reset = () => { if (timer.current) clearInterval(timer.current); setOnline(INITIAL_ONLINE); setHops([]); setIdx(-1); setFrom('alice'); setTo('bob') }
  const active = new Set(idx >= 0 ? hops[idx]?.nodes : [])
  const cls = (id: string) => `chatr__box ${active.has(id) ? 'is-active' : ''}`

  return (
    <DemoFrame title="Routing a message between stateful WebSocket gateways" onReset={reset}
      hint="Users are pinned to whichever gateway holds their socket. Toggle someone offline and send again.">
      <div className="chatr__controls">
        <Segmented label="From" value={from} onChange={setFrom} options={USERS} />
        <span className="chatr__arrow">→</span>
        <Segmented label="To" value={to} onChange={setTo} options={USERS} />
        <button className="btn btn--primary btn--sm" onClick={send} disabled={from === to || !online[from]}
          title={!online[from] ? `${from} is offline: an app with no socket queues locally and sends on reconnect` : undefined}>Send</button>
      </div>

      <div className="chatr__grid">
        <div className="chatr__col">
          <div className="demo-label">Clients</div>
          {USERS.map((u) => (
            <div key={u} className={`${cls(u)} ${online[u] ? '' : 'is-offline'}`}>
              <span className="chatr__name">{u}</span>
              <button className="chatr__toggle" aria-pressed={online[u]} onClick={() => setOnline((o) => ({ ...o, [u]: !o[u] }))}>
                {online[u] ? 'online' : 'offline'}
              </button>
            </div>
          ))}
        </div>
        <div className="chatr__col">
          <div className="demo-label">WS gateways</div>
          {SERVERS.map((s) => (
            <div key={s} className={cls(s)}>
              <span className="chatr__name mono">{s}</span>
              <small>{USERS.filter((u) => USER_SERVER[u] === s && online[u]).join(', ') || 'no sockets'}</small>
            </div>
          ))}
        </div>
        <div className="chatr__col">
          <div className="demo-label">Backend</div>
          {BACKEND.map((b) => (
            <div key={b} className={cls(b)}>
              <span className="chatr__name">{BACKEND_LABEL[b].title}</span>
              <small>{BACKEND_LABEL[b].sub}</small>
            </div>
          ))}
        </div>
      </div>

      <ol className="chatr__log" aria-live="polite">
        {hops.length === 0 && <li className="chatr__empty">Pick a sender and recipient, then press Send.</li>}
        {hops.map((h, i) => (
          <li key={i} className={i === idx ? 'is-active' : i < idx ? 'is-done' : ''}>
            <span>{i + 1}</span>{h.text}
          </li>
        ))}
      </ol>
    </DemoFrame>
  )
}
