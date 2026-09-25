import { useEffect, useReducer, useRef } from 'react'
import { DemoFrame } from '../../components/ui'
import { INITIAL_SYNC, statusOf, syncReducer, type DeviceId } from './chat-sync-model'
import './chat-demos.css'

const LINES = ['on my way', 'running 5 min late', 'got a table 🍜', 'order me ramen?', 'see you', 'where are you?']
const DEVICES: DeviceId[] = ['phone', 'laptop']

export function ChatOrderingSyncDemo() {
  const [s, dispatch] = useReducer(syncReducer, INITIAL_SYNC)
  const n = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const nextText = () => LINES[n.current++ % LINES.length]
  const top = s.messages.at(-1)?.seq ?? 0

  const send = () => {
    dispatch({ type: 'store', text: nextText() })
    DEVICES.forEach((d) => dispatch({ type: 'deliver', device: d, seq: top + 1 }))
  }

  // Two messages leave in order but the network delivers the second one first.
  const sendReordered = () => {
    const a = top + 1
    const b = top + 2
    dispatch({ type: 'store', text: nextText() })
    dispatch({ type: 'store', text: nextText() })
    DEVICES.forEach((d) => dispatch({ type: 'deliver', device: d, seq: b }))
    timers.current.push(setTimeout(() => DEVICES.forEach((d) => dispatch({ type: 'deliver', device: d, seq: a })), 1600))
  }

  const reset = () => { timers.current.forEach(clearTimeout); n.current = 0; dispatch({ type: 'reset' }) }

  return (
    <DemoFrame title="Sequence IDs, delivery receipts, and multi-device sync" onReset={reset}
      hint="You are Bob, with a phone and a laptop. Carol sends messages. Try reordering, then take the laptop offline and bring it back.">
      <div className="chats__controls">
        <button className="btn btn--primary btn--sm" onClick={send}>Carol sends</button>
        <button className="btn btn--secondary btn--sm" onClick={sendReordered}>Send 2, network reorders</button>
        <button className="btn btn--secondary btn--sm" onClick={() => dispatch({ type: 'read', device: 'phone' })}>Bob opens chat on phone</button>
      </div>

      <div className="chats__grid">
        <div className="chats__panel">
          <div className="demo-label">Server (Carol's view)</div>
          <ul className="chats__msgs">
            {s.messages.map((m) => {
              const st = statusOf(s, m.seq)
              return (
                <li key={m.seq}>
                  <code>#{m.seq}</code><span>{m.text}</span>
                  <b className={`chats__tick chats__tick--${st}`} title={st}>{st === 'sent' ? '✓' : '✓✓'}</b>
                </li>
              )
            })}
          </ul>
        </div>

        {DEVICES.map((id) => {
          const d = s.devices[id]
          return (
            <div key={id} className={`chats__panel ${d.online ? '' : 'is-offline'}`}>
              <div className="chats__head">
                <span className="demo-label">Bob's {id}</span>
                <button className="chatr__toggle" aria-pressed={d.online} onClick={() => dispatch({ type: 'toggle', device: id })}>
                  {d.online ? 'online' : 'offline'}
                </button>
              </div>
              <div className="chats__cursor mono">cursor #{d.cursor}{d.buffer.length > 0 && <em> · holding #{d.buffer.join(', #')}</em>}</div>
              <ul className="chats__msgs">
                {s.messages.filter((m) => m.seq <= d.cursor).map((m) => (
                  <li key={m.seq}><code>#{m.seq}</code><span>{m.text}</span></li>
                ))}
                {d.buffer.length > 0 && <li className="chats__gap">gap: waiting for #{d.cursor + 1}…</li>}
              </ul>
            </div>
          )
        })}
      </div>

      <ol className="chats__log" aria-live="polite">
        {s.log.map((l, i) => <li key={s.log.length - i}>{l}</li>)}
      </ol>
    </DemoFrame>
  )
}
