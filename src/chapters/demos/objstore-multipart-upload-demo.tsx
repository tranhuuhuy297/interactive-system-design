import { useEffect, useRef, useState } from 'react'
import { DemoFrame, Slider } from '../../components/ui'
import { createUpload, step } from './objstore-multipart-model'
import type { Upload } from './objstore-multipart-model'
import { rng } from './exchange-matching-model'
import './objstore-demos.css'

export function ObjstoreMultipartUploadDemo() {
  const [count, setCount] = useState(12)
  const [parallel, setParallel] = useState(4)
  const [failRate, setFailRate] = useState(0.2)
  const [upload, setUpload] = useState<Upload>(() => createUpload(12))
  const [running, setRunning] = useState(false)
  const rand = useRef(rng(3))

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setUpload((u) => step(u, parallel, failRate, rand.current)), 180)
    return () => clearInterval(t)
  }, [running, parallel, failRate])

  const done = upload.parts.filter((p) => p.state === 'done').length
  const isRunning = running && !upload.completed
  const restart = (n = count) => { setUpload(createUpload(n)); setRunning(false); rand.current = rng(Date.now() % 1000) }

  return (
    <DemoFrame title="Multipart upload: parallel parts, independent retries" onReset={() => { setCount(12); setParallel(4); setFailRate(0.2); restart(12) }}
      hint="A failed part is retried on its own. The object only becomes visible after CompleteMultipartUpload.">
      <div className="osm">
        <div className="demo-controls">
          <Slider label="Parts" min={4} max={32} value={count} onChange={(v) => { setCount(v); restart(v) }} />
          <Slider label="Parallel uploads" min={1} max={8} value={parallel} onChange={setParallel} />
          <Slider label="Failure chance per attempt" min={0} max={0.6} step={0.05} value={failRate} onChange={setFailRate} format={(v) => `${Math.round(v * 100)}%`} />
          <div className="osm__btns">
            <button className="btn btn--primary btn--sm" onClick={() => (upload.completed ? restart() : setRunning((r) => !r))}>
              {upload.completed ? 'Upload again' : isRunning ? 'Pause' : 'Start upload'}
            </button>
          </div>
        </div>
        <div className="osm__stage">
          <div className="osm__grid" aria-label="Upload parts">
            {upload.parts.map((p) => (
              <div key={p.n} className={`osm__part is-${p.state}`} title={`Part ${p.n}: ${p.state}, attempt ${p.attempts}`}>
                <i style={{ height: `${p.state === 'done' ? 100 : p.progress * 100}%` }} />
                <span className="mono">{p.n}</span>
                {p.attempts > 1 && <small>×{p.attempts}</small>}
              </div>
            ))}
          </div>
          <div className="osm__meta mono" role="status">
            <span>{done}/{upload.parts.length} parts</span>
            <span>{upload.failures} retries</span>
            <span>t={upload.tick}</span>
          </div>
          <p className={`osm__final ${upload.completed ? 'is-done' : ''}`}>
            {upload.completed
              ? 'POST ?uploadId=…  CompleteMultipartUpload → object is now visible, ETag = hash of part ETags.'
              : 'Object not visible yet. Incomplete uploads still cost storage, so add a lifecycle rule to abort them.'}
          </p>
        </div>
      </div>
    </DemoFrame>
  )
}
