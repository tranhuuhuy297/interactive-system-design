import { useState } from 'react'
import { Button, DemoFrame } from '../../components/ui'
import { insertPosition, uuidv4, uuidv7 } from './uid-helpers'
import './uid-demos.css'

const N = 60
const PAGE = 6 // keys per simulated B-tree leaf page

interface Series { inserts: { order: number; pos: number; size: number }[]; appends: number; coldInserts: number; sample: string[] }

function simulate(gen: (i: number) => string): Series {
  const sorted: string[] = []
  const inserts: Series['inserts'] = []
  let appends = 0
  let coldInserts = 0
  const base = Date.now()
  for (let i = 0; i < N; i++) {
    const id = gen(base + i)
    const pos = insertPosition(sorted, id)
    if (pos === sorted.length) appends += 1
    if (pos < sorted.length - PAGE) coldInserts += 1 // lands outside the rightmost leaf page
    inserts.push({ order: i, pos, size: sorted.length })
    sorted.splice(pos, 0, id)
  }
  return { inserts, appends, coldInserts, sample: sorted.slice(0, 3) }
}

const run = () => ({ v4: simulate(() => uuidv4()), v7: simulate((ms) => uuidv7(ms)) })

export function UidUuidLocalityDemo() {
  const [data, setData] = useState(run)

  return (
    <DemoFrame title="UUIDv4 vs UUIDv7: where does each insert land in the index?" onReset={() => setData(run())}
      hint={`Insert ${N} keys, one per millisecond. Each dot is one insert: x = insertion order, y = its position in the sorted index (top = rightmost leaf).`}>
      <div className="uid__plots">
        {(['v4', 'v7'] as const).map((k) => {
          const s = data[k]
          return (
            <figure key={k} className="uid__plot">
              <figcaption>
                <strong>UUID{k}</strong>
                <span className="mono">{Math.round((s.appends / N) * 100)}% appends · {s.coldInserts} inserts outside the hot leaf</span>
              </figcaption>
              <svg viewBox="0 0 200 110" role="img" aria-label={`UUID${k} insert positions`}>
                <line x1="5" y1="5" x2="195" y2="5" className="uid__diag" />
                {s.inserts.map((p) => {
                  const cx = 5 + (p.order / (N - 1)) * 190
                  const cy = 105 - (p.size === 0 ? 1 : p.pos / p.size) * 100
                  return <circle key={p.order} cx={cx} cy={cy} r="2.6" className={p.pos === p.size ? 'uid__dot uid__dot--append' : 'uid__dot'} />
                })}
              </svg>
              <div className="uid__sample mono">{s.sample.map((x) => <div key={x}>{x}</div>)}</div>
            </figure>
          )
        })}
      </div>
      <p className="uid__note">
        v7 keys always land on the rightmost leaf, so the B-tree appends. That means hot pages stay in cache and pages split cleanly.
        v4 keys land anywhere, which touches random pages, causes 50/50 page splits and bloats the index. This is a toy model with {PAGE} keys per leaf.
      </p>
      <Button size="sm" onClick={() => setData(run())}>Regenerate</Button>
    </DemoFrame>
  )
}
