import { BookA, Brain, MessagesSquare } from 'lucide-react'
import { Segmented, Slider } from '../../components/ui'
import { GROUPS, type ChapterGroup } from '../../data/chapters-registry'
import { useSpacedRepetition, type SrsSource } from '../../lib/use-spaced-repetition'
import { SOURCE_LABELS, type SrsCard } from './srs-deck'

const ICON = { qb: MessagesSquare, mm: Brain, gl: BookA } as const
type Track = ChapterGroup | 'All'

/** Which cards are in play, and how many per day. */
export function SrsSettingsPanel({ deck }: { deck: SrsCard[] }) {
  const { settings, updateSettings } = useSpacedRepetition()
  const tracks = GROUPS.map((g) => g.name).filter((g) => deck.some((c) => c.groups.includes(g)))
  const count = (src: SrsSource) => deck.filter((c) => c.source === src && (settings.track === 'All' || c.groups.includes(settings.track))).length

  return (
    <div className="srs-settings">
      <div className="srs-settings__row">
        <span className="demo-label">Sources</span>
        <div className="srs-sources">
          {(Object.keys(SOURCE_LABELS) as SrsSource[]).map((src) => {
            const Icon = ICON[src]
            const on = settings.sources[src]
            // Keep at least one source on so the deck is never empty by accident.
            const lastOn = on && Object.values(settings.sources).filter(Boolean).length === 1
            return (
              <button key={src} className={`srs-source ${on ? 'is-on' : ''}`} aria-pressed={on} disabled={lastOn}
                onClick={() => updateSettings({ sources: { ...settings.sources, [src]: !on } })}>
                <Icon size={15} aria-hidden /> {SOURCE_LABELS[src]} <b className="mono">{count(src)}</b>
              </button>
            )
          })}
        </div>
      </div>
      <div className="srs-settings__row">
        <span className="demo-label">Track</span>
        <Segmented<Track> label="Track" value={settings.track} onChange={(track) => updateSettings({ track })}
          options={['All', ...tracks] as Track[]} />
      </div>
      <div className="srs-settings__sliders">
        <Slider label="New cards per day" min={0} max={50} value={settings.newPerDay} onChange={(newPerDay) => updateSettings({ newPerDay })} />
        <Slider label="Max cards per session" min={10} max={200} step={10} value={settings.maxPerSession} onChange={(maxPerSession) => updateSettings({ maxPerSession })} />
      </div>
    </div>
  )
}
