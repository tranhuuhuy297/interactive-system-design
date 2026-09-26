import { useMemo, useState } from 'react'
import { Inbox, MailX, ShieldAlert } from 'lucide-react'
import { DemoFrame, Slider } from '../../components/ui'
import { runPipeline, sampleMail, type Verdict } from './email-inbound-pipeline-model'
import './email-inbound-pipeline-demo.css'

const DEFAULTS = { enforceDmarc: false, spamThreshold: 5, rejectThreshold: 9.5 }
const LANES: { v: Verdict; label: string; icon: typeof Inbox }[] = [
  { v: 'inbox', label: 'Inbox', icon: Inbox },
  { v: 'spam', label: 'Spam folder', icon: ShieldAlert },
  { v: 'reject', label: 'Rejected at SMTP', icon: MailX },
]

export function EmailInboundPipelineDemo() {
  const mail = useMemo(() => sampleMail(), [])
  const [s, setS] = useState(DEFAULTS)
  const r = runPipeline(mail, s)
  const total = mail.length
  const pct = (x: number) => `${Math.round(x * 100)}%`

  return (
    <DemoFrame title="Inbound mail pipeline: authenticate, then score" onReset={() => setS(DEFAULTS)}
      hint="400 sample messages: normal mail, forwarded mail, bulk spam, domain spoofs, and phishing from look-alike domains. Toggle DMARC and move the thresholds. Mix and scores are illustrative.">
      <div className="emp">
        <div className="demo-controls">
          <label className="emp__toggle">
            <input type="checkbox" checked={s.enforceDmarc} onChange={(e) => setS({ ...s, enforceDmarc: e.target.checked })} />
            <span>Enforce DMARC <small>reject mail that fails both SPF and DKIM alignment when the domain says p=reject</small></span>
          </label>
          <Slider label="Spam-folder threshold" min={1} max={9} step={0.5} value={s.spamThreshold}
            onChange={(v) => setS({ ...s, spamThreshold: v, rejectThreshold: Math.max(v, s.rejectThreshold) })} format={(v) => `score ≥ ${v}`} />
          <Slider label="Reject-at-SMTP threshold" min={5} max={10} step={0.5} value={s.rejectThreshold}
            onChange={(v) => setS({ ...s, rejectThreshold: Math.max(v, s.spamThreshold) })} format={(v) => (v >= 10 ? 'off' : `score ≥ ${v}`)} />
          <div className="emp__kpis">
            <div><span>Good mail missed</span><strong className={r.falsePositiveRate > 0.05 ? 'is-bad' : ''}>{pct(r.falsePositiveRate)}</strong></div>
            <div><span>Bad mail stopped</span><strong className={r.catchRate > 0.9 ? 'is-good' : ''}>{pct(r.catchRate)}</strong></div>
            <div><span>Spoofs in inbox</span><strong className={r.spoofsInInbox ? 'is-bad' : 'is-good'}>{r.spoofsInInbox}</strong></div>
          </div>
        </div>

        <div className="emp__lanes" role="table" aria-label="Where messages end up">
          {LANES.map(({ v, label, icon: Icon }) => {
            const c = r.counts[v]
            return (
              <div key={v} className={`emp__lane emp__lane--${v}`} role="row">
                <div className="emp__lane-head" role="rowheader"><Icon size={16} aria-hidden /> {label}</div>
                <div className="emp__bar" role="cell" aria-label={`${c.wanted} wanted, ${c.unwanted} unwanted`}>
                  <i className="emp__seg emp__seg--wanted" style={{ width: `${(c.wanted / total) * 100}%` }} />
                  <i className="emp__seg emp__seg--unwanted" style={{ width: `${(c.unwanted / total) * 100}%` }} />
                </div>
                <div className="emp__nums mono" role="cell"><span>{c.wanted} good</span><span>{c.unwanted} bad</span></div>
              </div>
            )
          })}
          <div className="emp__legend"><span><i className="emp__seg--wanted" /> wanted mail</span><span><i className="emp__seg--unwanted" /> spam, spoofs, phishing</span></div>
          <p className="emp__note">
            {s.enforceDmarc
              ? 'DMARC stops spoofs of protected domains before scoring. A few forwarded messages with broken DKIM get rejected too: the cost of strict policy.'
              : 'Without DMARC, spoofed “bank” mail competes on spam score alone, and some of it lands in the inbox.'}
          </p>
        </div>
      </div>
    </DemoFrame>
  )
}
