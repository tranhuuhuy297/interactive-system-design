import { useMemo, useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import { cdcChunks, fixedChunks } from './filesync-models'
import './filesync-demos.css'

const INITIAL = `Quarterly plan. Ship offline mode for the mobile app, then migrate the sync engine to content-defined chunking. Measure upload bytes per edit before and after. Risks: large binary files, flaky networks, and clients stuck on old versions. Owners: storage team for block service, clients team for the chunker, infra for rollout.`

type Mode = 'fixed' | 'cdc'

export function FilesyncChunkingDemo() {
  const [text, setText] = useState(INITIAL)
  const [mode, setMode] = useState<Mode>('cdc')
  const [server, setServer] = useState<Set<string>>(() => new Set(cdcChunks(INITIAL).map((c) => c.hash).concat(fixedChunks(INITIAL).map((c) => c.hash))))

  const chunks = useMemo(() => (mode === 'fixed' ? fixedChunks(text) : cdcChunks(text)), [text, mode])
  const fresh = chunks.filter((c) => !server.has(c.hash))
  const bytesUp = fresh.reduce((s, c) => s + c.text.length, 0)

  const sync = () => setServer(new Set([...server, ...fixedChunks(text).map((c) => c.hash), ...cdcChunks(text).map((c) => c.hash)]))
  const reset = () => { setText(INITIAL); setServer(new Set(cdcChunks(INITIAL).map((c) => c.hash).concat(fixedChunks(INITIAL).map((c) => c.hash)))) }
  const prepend = () => setText((t) => `URGENT: ${t}`)

  return (
    <DemoFrame title="Delta sync: upload only the chunks the server doesn't have" onReset={reset}
      hint="Edit the file. Highlighted chunks are new and must be uploaded; the rest are deduplicated by hash. Then try “insert at start” with fixed-size chunks.">
      <div className="fs__bar">
        <Segmented label="Chunking" value={mode} onChange={setMode}
          options={[{ value: 'fixed', label: 'Fixed-size' }, { value: 'cdc', label: 'Content-defined' }]} />
        <button className="btn btn--secondary btn--sm" onClick={prepend}>Insert at start</button>
        <button className="btn btn--primary btn--sm" onClick={sync} disabled={fresh.length === 0}>Sync to server</button>
      </div>
      <label className="fs__edit">
        <span className="demo-label">Local file (edit me)</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} spellCheck={false} />
      </label>

      <div className="demo-label fs__lbl">Chunks ({chunks.length})</div>
      <div className="fs__chunks">
        {chunks.map((c, i) => {
          const isNew = !server.has(c.hash)
          return (
            <span key={`${c.start}-${c.hash}-${i}`} className={`fs__chunk ${isNew ? 'is-new' : ''}`} title={`#${c.hash} · ${c.text.length} chars`}>
              <sup className="mono">{c.hash}</sup>{c.text}
            </span>
          )
        })}
      </div>

      <div className="fs__stats">
        <div><span>Chunks to upload</span><strong>{fresh.length} / {chunks.length}</strong></div>
        <div><span>Bytes to upload</span><strong>{bytesUp} / {text.length}</strong></div>
        <div><span>Saved vs full upload</span><strong className={bytesUp < text.length * 0.5 ? 'is-good' : 'is-bad'}>{text.length ? Math.round((1 - bytesUp / text.length) * 100) : 0}%</strong></div>
      </div>
      <p className="fs__note">Real systems use chunks of roughly 1–8 MB (Dropbox historically used 4 MB blocks) and a strong hash such as SHA-256. Chunks here are tiny so each edit is visible.</p>
    </DemoFrame>
  )
}
