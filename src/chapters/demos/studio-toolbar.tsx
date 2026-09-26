import { useRef } from 'react'
import { ClipboardCopy, Download, Eye, EyeOff, FileUp, Layers, RotateCcw, Stethoscope } from 'lucide-react'
import type { StudioPrompt } from './studio-types'

interface ToolbarProps {
  prompt: StudioPrompt
  prompts: StudioPrompt[]
  onPrompt: (id: string) => void
  reviewOn: boolean
  onReview: () => void
  compareOn: boolean
  onCompare: () => void
  onLoadReference: () => void
  onExport: () => void
  onImport: (file: File) => void
  onCopy: () => void
  onReset: () => void
  status: string
}

const k = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}K` : `${v}`)
const FLAG_LABELS: Record<string, string> = {
  readHeavy: 'read-heavy', needsAsync: 'async work', money: 'money', global: 'global users',
  largeBlobs: 'large media', realtime: 'real-time push', search: 'search', rateLimited: 'abuse-prone',
}

export function StudioToolbar(p: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const r = p.prompt.req
  const flags = Object.entries(r.flags).filter(([, v]) => v).map(([f]) => FLAG_LABELS[f] ?? f)
  return (
    <div className="studio-toolbar">
      <div className="studio-brief">
        <label className="studio-field studio-brief__pick"><span>Prompt</span>
          <select value={p.prompt.id} onChange={(e) => p.onPrompt(e.target.value)}>
            {p.prompts.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </label>
        <p className="studio-brief__text">{p.prompt.brief}</p>
        <div className="studio-brief__reqs" aria-label="Requirements">
          <span><b>{k(r.readQps)}</b> reads/s</span>
          <span><b>{k(r.writeQps)}</b> writes/s</span>
          <span><b>{r.storageTbPerYear}</b> TB/yr data</span>
          {r.blobTbPerYear ? <span><b>{r.blobTbPerYear}</b> TB/yr media</span> : null}
          <span>p99 <b>{r.p99Ms} ms</b></span>
          <span><b>{r.availability}</b></span>
          {flags.map((f) => <span key={f} className="is-flag">{f}</span>)}
        </div>
      </div>
      <div className="studio-actions" role="toolbar" aria-label="Design actions">
        <button className={`btn btn--sm ${p.reviewOn ? 'btn--secondary' : 'btn--primary'}`} onClick={p.onReview} aria-pressed={p.reviewOn}>
          <Stethoscope size={14} /> {p.reviewOn ? 'Hide review' : 'Review design'}
        </button>
        <button className="btn btn--secondary btn--sm" onClick={p.onCompare} aria-pressed={p.compareOn}>
          {p.compareOn ? <EyeOff size={14} /> : <Eye size={14} />} {p.compareOn ? 'Hide reference' : 'Compare with reference'}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={p.onLoadReference}><Layers size={14} /> Load reference</button>
        <button className="btn btn--ghost btn--sm" onClick={p.onCopy}><ClipboardCopy size={14} /> Copy as Markdown</button>
        <button className="btn btn--ghost btn--sm" onClick={p.onExport}><Download size={14} /> Export</button>
        <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}><FileUp size={14} /> Import</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onImport(f); e.target.value = '' }} />
        <button className="btn btn--ghost btn--sm" onClick={p.onReset}><RotateCcw size={14} /> Reset</button>
        <span className="studio-status" role="status">{p.status}</span>
      </div>
    </div>
  )
}
