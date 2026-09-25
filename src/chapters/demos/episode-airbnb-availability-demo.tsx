import { useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import {
  DAYS, LISTINGS, buildBitsets, conflictNights, raceBooking, searchBitset, searchScan, seedBookings,
  type Booking, type RaceMode,
} from './episode-airbnb-availability-model'
import './episode-airbnb-demos.css'

const INITIAL = seedBookings()

export function EpisodeAirbnbAvailabilityDemo() {
  const [bookings, setBookings] = useState<Booking[]>(INITIAL)
  const [start, setStart] = useState(9)
  const [nights, setNights] = useState(3)
  const [mode, setMode] = useState<RaceMode>('naive')
  const [log, setLog] = useState<string[]>([])

  const n = Math.min(nights, DAYS - start)
  const bits = useMemo(() => buildBitsets(bookings), [bookings])
  const fast = searchBitset(bits, start, n)
  const slow = searchScan(bookings, start, n)
  const conflicts = useMemo(() => conflictNights(bookings), [bookings])
  const target = fast.available[0]

  const race = () => {
    if (target === undefined) return
    const r = raceBooking(bookings, target, start, n, mode)
    setBookings(r.bookings)
    setLog(r.log)
  }
  const reset = () => { setBookings(INITIAL); setStart(9); setNights(3); setMode('naive'); setLog([]) }
  const bookedBy = (l: number, d: number) => bookings.some((b) => b.listing === l && d >= b.start && d < b.start + b.nights)

  return (
    <DemoFrame title="Availability search and the double-booking race" onReset={reset}
      hint="Each listing keeps one bit per night. A search ANDs the requested range against every listing's bits instead of scanning booking rows. Then make two guests race for the same stay.">
      <div className="bnb-av">
        <div className="bnb-av__controls">
          <Slider label="Check-in night" min={0} max={DAYS - 1} value={start} onChange={setStart} format={(v) => `#${v + 1}`} />
          <Slider label="Nights" min={1} max={7} value={nights} onChange={setNights} format={(v) => `${Math.min(v, DAYS - start)}`} />
          <div className="bnb-av__ops">
            <div><span>Bitset index</span><strong>{fast.ops} ops</strong><small>one AND per listing</small></div>
            <div><span>Scan bookings</span><strong>{slow.ops} ops</strong><small>one overlap test per booking row</small></div>
          </div>
          <p className="bnb-av__result"><strong>{fast.available.length}</strong> of {LISTINGS.length} listings free for these nights.</p>
        </div>

        <div className="bnb-av__scroll">
          <table className="bnb-av__grid" aria-label="Listing calendars">
            <thead>
              <tr><th scope="col">Listing</th>{Array.from({ length: DAYS }, (_, d) => <th key={d} scope="col" className={d >= start && d < start + n ? 'is-sel' : ''}>{d + 1}</th>)}</tr>
            </thead>
            <tbody>
              {LISTINGS.map((name, l) => {
                const free = fast.available.includes(l)
                return (
                  <tr key={name} className={free ? 'is-free' : ''}>
                    <th scope="row">{name}<em>{free ? 'free' : 'taken'}</em></th>
                    {Array.from({ length: DAYS }, (_, d) => {
                      const cls = [bookedBy(l, d) ? 'is-booked' : '', conflicts.has(`${l}:${d}`) ? 'is-clash' : '', d >= start && d < start + n ? 'is-sel' : ''].join(' ')
                      return <td key={d} className={cls} aria-label={`${name} night ${d + 1}${bookedBy(l, d) ? ' booked' : ''}`} />
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="bnb-av__race">
          <div className="bnb-av__race-head">
            <Segmented label="Booking write" value={mode} onChange={setMode}
              options={[{ value: 'naive', label: 'Check, then insert' }, { value: 'guarded', label: 'Conditional write' }]} />
            <button className="btn btn--primary btn--sm" onClick={race} disabled={target === undefined}>
              {target === undefined ? 'No free listing' : `Race 2 guests for ${LISTINGS[target]}`}
            </button>
          </div>
          <ol className="bnb-av__log" aria-live="polite">
            {log.length === 0 ? <li className="bnb-av__muted">Nothing booked yet.</li> : log.map((line, i) => (
              <li key={i} className={line.includes('DOUBLE') ? 'is-bad' : line.includes('rejected') ? 'is-ok' : ''}>{line}</li>
            ))}
          </ol>
        </div>
      </div>
    </DemoFrame>
  )
}
