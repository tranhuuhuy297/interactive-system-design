import { useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { scheduleTranscode } from './video-models'
import './video-demos.css'

const SEGMENT_OPTIONS = ['1', '4', '8', '16'] as const
type SegKey = (typeof SEGMENT_OPTIONS)[number]

const ROWS = ['Split + inspect', 'Encode 1080p', 'Encode 720p', 'Encode 480p', 'Encode 360p', 'Audio (AAC)', 'Thumbnails', 'Package HLS/DASH']

export function VideoTranscodeDag() {
  const [minutes, setMinutes] = useState(10)
  const [segKey, setSegKey] = useState<SegKey>('8')
  const [workers, setWorkers] = useState(16)
  const segments = Number(segKey)

  const { tasks, makespan } = useMemo(() => scheduleTranscode(minutes, segments, workers), [minutes, segments, workers])
  const serial = useMemo(() => scheduleTranscode(minutes, 1, 1).makespan, [minutes])
  const workerMinutes = tasks.reduce((s, t) => s + t.dur, 0)

  const reset = () => { setMinutes(10); setSegKey('8'); setWorkers(16) }

  return (
    <DemoFrame title="Transcoding as a DAG: split, fan out, join" onReset={reset}
      hint="Each bar is a task on the worker pool. Splitting on GOP boundaries lets every rendition encode in parallel. Watch time-to-publish drop, while total compute (cost) stays the same.">
      <div className="vid__controls">
        <Slider label="Video length (min)" min={1} max={60} value={minutes} onChange={setMinutes} />
        <div>
          <div className="demo-label">Segments per rendition</div>
          <Segmented label="Segments" options={SEGMENT_OPTIONS} value={segKey} onChange={setSegKey} />
        </div>
        <Slider label="Worker pool" min={1} max={64} value={workers} onChange={setWorkers} />
      </div>

      <div className="vid__gantt" role="img" aria-label={`Transcoding schedule finishes in ${makespan.toFixed(1)} minutes`}>
        {ROWS.map((row) => {
          const rowTasks = tasks.filter((t) => t.row === row)
          const lanes = Math.max(1, ...rowTasks.map((t) => t.lane + 1))
          return (
            <div key={row} className="vid__row">
              <span className="vid__rowlabel">{row}</span>
              <div className="vid__track">
                {rowTasks.map((t) => (
                  <span key={t.id} className={`vid__bar vid__bar--${row.split(' ')[0].toLowerCase()}`}
                    title={`${t.id}: ${t.start.toFixed(2)}–${t.end.toFixed(2)} min`}
                    style={{
                      left: `${(t.start / makespan) * 100}%`,
                      width: `max(2px, ${(t.dur / makespan) * 100}%)`,
                      top: `${(t.lane / lanes) * 100}%`,
                      height: `calc(${100 / lanes}% - 1px)`,
                    }} />
                ))}
              </div>
            </div>
          )
        })}
        <div className="vid__axis"><span>0</span><span>{(makespan / 2).toFixed(1)} min</span><span>{makespan.toFixed(1)} min</span></div>
      </div>

      <div className="vid__stats">
        <div><span>Time to publish</span><strong>{makespan.toFixed(1)} min</strong></div>
        <div><span>Speed-up vs 1 worker</span><strong>{(serial / makespan).toFixed(1)}×</strong></div>
        <div><span>Compute used</span><strong>{workerMinutes.toFixed(1)} worker-min</strong></div>
        <div><span>Tasks</span><strong>{tasks.length}</strong></div>
      </div>
      <p className="vid__note">Costs are illustrative. Real encode cost depends on codec (H.264 vs AV1 differs by an order of magnitude), preset, and content complexity.</p>
    </DemoFrame>
  )
}
