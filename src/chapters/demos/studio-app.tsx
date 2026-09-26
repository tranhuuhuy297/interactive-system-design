import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useMediaQuery } from '../../lib/use-media-query'
import { analyze } from './studio-analyzer'
import { StudioCanvas } from './studio-canvas'
import { addNode, connect, disconnect, moveNode, removeNode, sanitizeDesign, updateNode } from './studio-design-ops'
import { StudioInspector } from './studio-inspector'
import { StudioListEditor } from './studio-list-editor'
import { designMarkdown } from './studio-markdown'
import { StudioPalette } from './studio-palette'
import { PROMPTS, starterDesign } from './studio-prompts'
import { StudioReportPanel } from './studio-report'
import { useStudioStore } from './studio-store'
import { StudioToolbar } from './studio-toolbar'
import type { StudioEdge } from './studio-types'
import './studio.css'

type Armed = 'reset' | 'reference' | null

/** Design Studio: sketch an architecture for a prompt and get an automated review. */
export function StudioApp() {
  const { prompt, design, edit, setPrompt } = useStudioStore()
  const narrow = useMediaQuery('(max-width: 719px)')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<StudioEdge | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string[]>([])
  const [reviewOn, setReviewOn] = useState(false)
  const [compareOn, setCompareOn] = useState(false)
  const [status, setStatus] = useState('')
  const [armed, setArmed] = useState<Armed>(null)
  const timer = useRef<number | undefined>(undefined)

  const report = useMemo(() => analyze(design, prompt), [design, prompt])
  const loads = useMemo(() => new Map(report.loads.map((l) => [l.id, l])), [report])
  const utilById = useMemo(() => (reviewOn ? new Map(report.loads.filter((l) => l.onPath && Number.isFinite(l.capacity)).map((l) => [l.id, l.util])) : undefined), [report, reviewOn])

  useEffect(() => () => window.clearTimeout(timer.current), [])
  const flash = (msg: string) => {
    setStatus(msg)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { setStatus(''); setArmed(null) }, 3000)
  }
  const clearSelection = () => { setSelectedId(null); setSelectedEdge(null); setConnectFrom(null); setHighlight([]) }

  const choosePrompt = (id: string) => { setPrompt(id); clearSelection(); setCompareOn(false) }
  const add = (kind: Parameters<typeof addNode>[1], at?: { x: number; y: number }) => {
    let newId = ''
    edit((d) => { const r = addNode(d, kind, at); newId = r.id; return r.design })
    setSelectedId(newId || null)
    setSelectedEdge(null)
  }
  const del = (id: string) => { edit((d) => removeNode(d, id)); if (selectedId === id) setSelectedId(null); setHighlight((h) => h.filter((x) => x !== id)) }
  const doConnect = (from: string, to: string) => { edit((d) => connect(d, from, to)); setConnectFrom(null); setSelectedId(to) }

  const guarded = (kind: Exclude<Armed, null>, run: () => void, msg: string) => {
    if (armed === kind || design.nodes.length <= 1) { run(); setArmed(null); flash('Done.') }
    else { setArmed(kind); flash(msg) }
  }
  const reset = () => guarded('reset', () => { edit(() => starterDesign()); clearSelection() }, 'Press Reset again to clear this design.')
  const loadReference = () => guarded('reference', () => { edit(() => prompt.reference); clearSelection(); setCompareOn(false) }, 'Press Load reference again to replace your design.')

  const copy = async () => {
    try { await navigator.clipboard.writeText(designMarkdown(prompt, design, report)); flash('Copied summary as Markdown.') }
    catch { flash('Clipboard is blocked in this browser.') }
  }
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ promptId: prompt.id, design }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `design-${prompt.id}.json` })
    a.click()
    URL.revokeObjectURL(url)
    flash('Exported JSON.')
  }
  const importJson = async (file: File) => {
    try {
      const parsed = sanitizeDesign(JSON.parse(await file.text()))
      if (!parsed) return flash('That file has no usable design.')
      edit(() => parsed)
      clearSelection()
      flash(`Imported ${parsed.nodes.length} components.`)
    } catch { flash('Could not read that file as JSON.') }
  }

  const onKey = (e: KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdge && !(e.target instanceof HTMLInputElement)) {
      edit((d) => disconnect(d, selectedEdge.from, selectedEdge.to))
      setSelectedEdge(null)
    }
  }

  const common = {
    design, selectedId, loads: reviewOn ? loads : undefined,
    onUpdate: (id: string, patch: Parameters<typeof updateNode>[2]) => edit((d) => updateNode(d, id, patch)),
    onDelete: del,
    onDisconnect: (from: string, to: string) => { edit((d) => disconnect(d, from, to)); setSelectedEdge(null) },
    onSelect: (id: string) => { setSelectedId(id || null); setSelectedEdge(null) },
  }

  return (
    <div className="studio" onKeyDown={onKey}>
      <StudioToolbar prompt={prompt} prompts={PROMPTS} onPrompt={choosePrompt} reviewOn={reviewOn} onReview={() => setReviewOn((v) => !v)}
        compareOn={compareOn} onCompare={() => setCompareOn((v) => !v)} onLoadReference={loadReference}
        onExport={exportJson} onImport={importJson} onCopy={copy} onReset={reset} status={status} />
      <StudioPalette onAdd={(k) => add(k)} />
      {connectFrom && !narrow && <p className="studio-hint" role="status">Click the component to connect to. Press Esc or click empty space to cancel.</p>}
      <div className={`studio-body ${reviewOn ? 'has-report' : ''}`}>
        <div className="studio-work">
          {narrow ? (
            <StudioListEditor {...common} highlight={highlight} onConnect={doConnect} />
          ) : (
            <div className="studio-stage">
              <StudioCanvas design={design} ghost={compareOn ? prompt.reference : undefined} selectedId={selectedId} selectedEdge={selectedEdge}
                connectFrom={connectFrom} highlight={highlight} utilById={utilById}
                onSelect={(id) => { setSelectedId(id); if (id) setSelectedEdge(null) }} onSelectEdge={(e) => { setSelectedEdge(e); if (e) setSelectedId(null) }}
                onMove={(id, x, y) => edit((d) => moveNode(d, id, x, y))} onConnectStart={setConnectFrom} onConnect={doConnect}
                onDelete={del} onDropKind={(k, x, y) => add(k, { x, y })} />
              <StudioInspector {...common} selectedEdge={selectedEdge} onConnectStart={setConnectFrom} />
            </div>
          )}
          {compareOn && narrow && <p className="studio-hint">The reference overlay needs a wider screen. Use Load reference to see it as a list.</p>}
        </div>
        {reviewOn && <StudioReportPanel report={report} prompt={prompt} design={design} highlight={highlight} onHighlight={setHighlight} />}
      </div>
    </div>
  )
}
