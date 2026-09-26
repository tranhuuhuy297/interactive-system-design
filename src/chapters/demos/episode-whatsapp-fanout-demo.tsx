import { useMemo, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { fanoutCost, type SchemeCost } from './episode-whatsapp-fanout-model'
import './episode-whatsapp-demos.css'

const DEFAULTS = { members: 200, devices: 1, messages: 50, leaves: 0 }
const fmt = (n: number) => n.toLocaleString('en-US')

function Bar({ label, cost, max, tone }: { label: string; cost: SchemeCost; max: number; tone: 'pair' | 'sk' }) {
  const pct = max ? Math.max(1.5, (cost.uploads / max) * 100) : 0
  return (
    <div className="wa-fo__row">
      <div className="wa-fo__rowhead"><strong>{label}</strong><span className="mono">{fmt(cost.uploads)} uploads</span></div>
      <div className="wa-fo__track"><span className={`wa-fo__bar wa-fo__bar--${tone}`} style={{ width: `${pct}%` }} /></div>
      <div className="wa-fo__meta">{fmt(cost.encryptions)} encryptions on the phone · {fmt(cost.deliveries)} deliveries by the server</div>
    </div>
  )
}

export function EpisodeWhatsappFanoutDemo() {
  const [members, setMembers] = useState(DEFAULTS.members)
  const [devices, setDevices] = useState(DEFAULTS.devices)
  const [messages, setMessages] = useState(DEFAULTS.messages)
  const [leaves, setLeaves] = useState(DEFAULTS.leaves)
  const r = useMemo(() => fanoutCost({ members, devicesPerMember: devices, messages, leaves }), [members, devices, messages, leaves])

  const reset = () => { setMembers(DEFAULTS.members); setDevices(DEFAULTS.devices); setMessages(DEFAULTS.messages); setLeaves(DEFAULTS.leaves) }
  const max = Math.max(r.pairwise.uploads, r.senderKeys.uploads)
  const ratio = r.senderKeys.uploads ? r.pairwise.uploads / r.senderKeys.uploads : 0
  const skWins = r.senderKeys.uploads < r.pairwise.uploads

  return (
    <DemoFrame title="One sender, one group: pairwise vs Sender Keys" onReset={reset}
      hint="Counts what one member’s phone must encrypt and upload to send a burst of group messages. Toy model: no retries, all devices online.">
      <div className="wa-fo">
        <div className="demo-controls">
          <Slider label="Group members" min={2} max={1000} value={members} onChange={setMembers} format={fmt} />
          <Slider label="Devices per member" min={1} max={5} value={devices} onChange={setDevices} />
          <Slider label="Messages this sender sends" min={1} max={300} value={messages} onChange={setMessages} />
          <Slider label="Members who leave meanwhile" min={0} max={Math.max(1, Math.min(50, members - 2))} value={Math.min(leaves, Math.max(0, members - 2))} onChange={setLeaves} />
        </div>
        <div className="wa-fo__out">
          <p className="wa-fo__reach">Each message must reach <strong>{fmt(r.recipientsDevices)}</strong> devices.</p>
          <Bar label="Pairwise (client fan-out)" cost={r.pairwise} max={max} tone="pair" />
          <Bar label="Sender Keys (server fan-out)" cost={r.senderKeys} max={max} tone="sk" />
          <p className="wa-fo__note" aria-live="polite">
            {skWins
              ? <>Sender Keys cut this phone’s uploads by <strong>{ratio.toFixed(ratio >= 10 ? 0 : 1)}×</strong>. The server does the copying instead.</>
              : <>With this few messages, the one-time key hand-out costs more than it saves. Sender Keys pay off once a sender talks repeatedly.</>}
          </p>
          {leaves > 0 && (
            <p className="wa-fo__note wa-fo__note--warn">
              Each leave makes every remaining member rotate and resend their key: <strong>{fmt(r.groupRekeys)}</strong> key messages across the group.
              This is why Sender Keys suit groups that don’t churn much.
            </p>
          )}
        </div>
      </div>
    </DemoFrame>
  )
}
