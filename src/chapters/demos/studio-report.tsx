import { AlertOctagon, AlertTriangle, CheckCircle2, Crown, Info } from 'lucide-react'
import { P99_FACTOR } from './studio-analyzer'
import { CATALOG } from './studio-catalog'
import { nodeName } from './studio-labels'
import type { Design, Finding, Severity, StudioPrompt, StudioReport } from './studio-types'

const SEV: Record<Severity, { label: string; Icon: typeof Info }> = {
  critical: { label: 'Critical', Icon: AlertOctagon },
  warning: { label: 'Warnings', Icon: AlertTriangle },
  info: { label: 'Notes', Icon: Info },
}

interface ReportProps {
  report: StudioReport
  prompt: StudioPrompt
  design: Design
  highlight: string[]
  onHighlight: (ids: string[]) => void
}

export function StudioReportPanel({ report, prompt, design, highlight, onHighlight }: ReportProps) {
  const util = report.loads.filter((l) => l.onPath && Number.isFinite(l.capacity) && l.kind !== 'client').sort((a, b) => b.util - a.util)
  const p99 = Math.round(report.readLatencyMs * P99_FACTOR)
  const verdict = report.score >= 85 ? 'Interview-ready' : report.score >= 60 ? 'Solid start' : 'Needs work'
  return (
    <section className="studio-report" aria-label="Design review" aria-live="polite">
      <div className="studio-report__top">
        <ScoreRing score={report.score} />
        <div>
          <strong className="studio-report__verdict">{verdict}</strong>
          <p>Estimated read p99 ≈ <b>{p99} ms</b> vs a {prompt.req.p99Ms} ms target · {report.findings.filter((f) => f.severity === 'critical').length} critical · {report.findings.filter((f) => f.severity === 'warning').length} warnings</p>
        </div>
      </div>

      {(['critical', 'warning', 'info'] as Severity[]).map((sev) => {
        const items = report.findings.filter((f) => f.severity === sev)
        if (!items.length) return null
        const { label, Icon } = SEV[sev]
        return (
          <div key={sev} className={`studio-report__group is-${sev}`}>
            <h5><Icon size={14} aria-hidden /> {label}</h5>
            <ul>{items.map((f) => <FindingRow key={f.id} f={f} active={!!f.nodeIds?.length && f.nodeIds.every((id) => highlight.includes(id))} onHighlight={onHighlight} />)}</ul>
          </div>
        )
      })}
      {!report.findings.length && <p className="studio-report__clean"><CheckCircle2 size={16} aria-hidden /> No issues found under this model. Now explain your trade-offs out loud.</p>}

      {report.passed.length > 0 && (
        <div className="studio-report__group is-pass">
          <h5><CheckCircle2 size={14} aria-hidden /> Covered</h5>
          <ul>{report.passed.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}

      {util.length > 0 && (
        <div className="studio-report__util">
          <h5>Utilization at peak <small>(toy capacities)</small></h5>
          {util.map((l) => (
            <button key={l.id} className="studio-util" onClick={() => onHighlight([l.id])} aria-label={`${nodeName(design, l.id)} ${Math.round(l.util * 100)} percent`}>
              <span className="studio-util__name">{nodeName(design, l.id)}<small>{CATALOG[l.kind].short}</small></span>
              <span className="studio-util__track"><i className={l.util >= 1 ? 'is-over' : l.util >= 0.8 ? 'is-hot' : ''} style={{ width: `${Math.min(100, l.util * 100)}%` }} /></span>
              <span className="studio-util__pct mono">{Math.round(l.util * 100)}%</span>
            </button>
          ))}
        </div>
      )}

      {report.staffMoves.length > 0 && (
        <div className="studio-report__staff">
          <h5><Crown size={14} aria-hidden /> Staff moves to mention</h5>
          <ul>{report.staffMoves.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
    </section>
  )
}

function FindingRow({ f, active, onHighlight }: { f: Finding; active: boolean; onHighlight: (ids: string[]) => void }) {
  return (
    <li className={`studio-finding ${active ? 'is-active' : ''}`}>
      <button className="studio-finding__title" onClick={() => onHighlight(active ? [] : f.nodeIds ?? [])} disabled={!f.nodeIds?.length}
        title={f.nodeIds?.length ? 'Highlight on the canvas' : undefined}>
        {f.title}
      </button>
      <p>{f.detail}</p>
      <p className="studio-finding__fix"><b>Fix:</b> {f.fix}{f.chapter && <> · <a href={`#/${f.chapter}`}>Learn more</a></>}</p>
    </li>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const tone = score >= 85 ? 'is-good' : score >= 60 ? 'is-mid' : 'is-low'
  return (
    <svg className={`studio-ring ${tone}`} width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="34" cy="34" r={r} className="studio-ring__track" />
      <circle cx="34" cy="34" r={r} className="studio-ring__value" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 34 34)" />
      <text x="34" y="39" textAnchor="middle">{score}</text>
    </svg>
  )
}
