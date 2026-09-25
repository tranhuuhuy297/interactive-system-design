import {
  References, TLDR, Term,
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeAirbnbAvailabilityDemo } from './demos/episode-airbnb-availability-demo'
import { AIRBNB_SRC } from './demos/episode-airbnb-sources'
import { AIRBNB_STAGES } from './demos/episode-airbnb-stages'

const FLOW_NODES: ArchNode[] = [
  { id: 'guest', label: 'Guest', kind: 'client', x: 10, y: 45 },
  { id: 'gw', label: 'API gateway', kind: 'lb', x: 28, y: 45 },
  { id: 'search', label: 'Search', kind: 'service', x: 50, y: 18,
    detail: 'Geo filter, then an availability filter (nights bitmap), then ranking. Returns a page of candidates with a quoted price.' },
  { id: 'index', label: 'Search index', sub: 'availability-aware', kind: 'search', x: 76, y: 18 },
  { id: 'booking', label: 'Booking service', kind: 'service', x: 50, y: 58,
    detail: 'Re-checks availability against the source of truth, places a short hold, charges, then commits. It never trusts the search result alone.' },
  { id: 'db', label: 'Bookings DB', sub: 'constraint on nights', kind: 'db', x: 76, y: 58, detail: 'The authoritative calendar. An exclusion or unique constraint makes a double booking impossible even if the application has a bug.' },
  { id: 'pay', label: 'Payments', kind: 'external', x: 50, y: 88 },
  { id: 'cdc', label: 'Change stream', kind: 'queue', x: 76, y: 88, detail: 'Committed bookings flow to the index within seconds, flipping the nights to unavailable.' },
]
const FLOW_EDGES: ArchEdge[] = [
  { from: 'guest', to: 'gw' }, { from: 'gw', to: 'search' }, { from: 'search', to: 'index' }, { from: 'gw', to: 'booking' },
  { from: 'booking', to: 'db' }, { from: 'booking', to: 'pay' }, { from: 'db', to: 'cdc', async: true }, { from: 'cdc', to: 'index' },
]

// Every source used anywhere in the episode, including per-stage deep dives.
const REFS: Reference[] = Object.values(AIRBNB_SRC)

export default function AirbnbEpisode() {
  return (
    <>
      <TLDR items={[
        'Airbnb sells time: a specific home on specific nights. That one fact shapes search, booking, and payments.',
        '“Is this home free on these nights?” lives in two places: a fast, slightly stale copy for search and the source of truth for booking.',
        'Search moved off the database into sharded indexes, and later learned to rank and retrieve homes with machine learning.',
        'Correctness sits in the database: constraints stop double bookings, and idempotency keys stop double charges.',
        'Along the way Airbnb built tools the industry now uses, such as Airflow, and moved from a Rails monolith to services.',
      ]} />
      <p>
        Airbnb is a two-sided marketplace where the product is <strong>time</strong>. Search must filter millions of
        listings by calendar. Booking must make double-booking impossible. And money must reach guests and hosts at
        different moments.
      </p>
      <p>
        This episode grows the system in 11 stages, from a Rails monolith to a service-oriented platform. Years appear
        where Airbnb has published details. Stages marked “Design step” are this episode’s own reasoning, and they say so.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Watch the gap between the fast copy of the calendar and the true one. Open “Go deeper” for the step-by-step
        flow, numbers, alternatives, and sources behind each stage.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Airbnb; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <ol>
        {AIRBNB_STAGES.map((s) => (
          <li key={s.title}><strong>{s.era}</strong> · {s.title.replace(/^v\d+ · /, '')}: {s.summary}</li>
        ))}
      </ol>

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={AIRBNB_STAGES} height={420} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <EstimationTable
        assumptions={['Illustrative: 7M active listings', '~50 searches per booking (browsing is cheap, booking is rare)', '365 nights of calendar per listing']}
        rows={[
          { label: 'Calendar as bits', math: '7M × 365 bits', result: '≈ 320 MB' },
          { label: 'Search : booking', math: '~50 : 1', result: 'read-dominated' },
          { label: 'Bookings / day', math: 'illustrative 1–2M', result: '≈ 10–25 /s avg' },
          { label: 'Searches / day', math: '1.5M × 50', result: '≈ 75M (~900 /s avg)' },
        ]}
      />
      <p>
        The whole world’s calendar fits in memory as bits. That is why availability can live <strong>inside the search
        index</strong> instead of being a join against the bookings table. Bookings are a gentle write rate, so they can
        afford strong consistency and strict constraints.
      </p>

      <H2 id="request-flow">Search, then book</H2>
      <ArchitectureDiagram nodes={FLOW_NODES} edges={FLOW_EDGES} height={400}
        caption="Search reads a fast copy; booking writes the truth and propagates it back"
        flows={[
          { name: 'Search', path: ['guest', 'gw', 'search', 'index'], steps: ['Guest searches a city and dates', 'Gateway routes to search', 'Index filters by geo, nights bitmap, and guests, then ranks'] },
          { name: 'Book', path: ['guest', 'gw', 'booking', 'db'], steps: ['Guest reserves a listing', 'Gateway routes to booking', 'Booking re-checks and commits under a constraint'] },
          { name: 'Propagate', path: ['booking', 'db', 'cdc', 'index'], steps: ['Booking commits', 'The change is captured from the database log', 'The index flips those nights to unavailable'] },
        ]} />

      <H2 id="availability">Deep dive: availability search and double-booking</H2>
      <p>
        Checking availability by scanning booking rows costs work in proportion to <em>all bookings</em> in the area.
        Keeping one bit per night per listing turns the check into a single AND per listing.
      </p>
      <p>
        But the index is a copy, updated through{' '}
        <Term def="Change data capture: reading committed changes from the database’s log and streaming them to other systems.">CDC</Term>.
        The booking path must still enforce correctness in the database itself.
      </p>
      <EpisodeAirbnbAvailabilityDemo />
      <CodeBlock lang="ts" title="the database is the last line of defense (PostgreSQL)" code={`
// One row per stay; the exclusion constraint forbids overlapping ranges per listing.
const ddl = \`
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  CREATE TABLE bookings (
    id          bigserial PRIMARY KEY,
    listing_id  bigint     NOT NULL,
    nights      daterange  NOT NULL,          -- [check_in, check_out)
    guest_id    bigint     NOT NULL,
    EXCLUDE USING gist (listing_id WITH =, nights WITH &&)
  );\`

// A concurrent overlapping insert fails with SQLSTATE 23P01 (exclusion_violation),
// which the booking service turns into "those nights were just taken".`} />

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Search serving', cells: ['Sharded index, built offline', 'SQL on the primary database', 'Search load stays off bookings; instant rollback'] },
          { label: 'Availability in search', cells: ['Nights bitmap in the index', 'Join against bookings at query time', 'Constant-cost check; the calendar fits in memory'] },
          { label: 'Index freshness', cells: ['CDC from the bookings DB', 'App code calls reindex', 'No code path can forget; replayable'] },
          { label: 'Double-booking guard', cells: ['DB constraint + short holds', 'Check-then-insert in app code', 'Races are impossible, not just unlikely'] },
          { label: 'Payments', cells: ['Idempotency keys on every call', 'Blind retries after timeouts', 'A retry returns the first result, never a second charge'] },
          { label: 'Architecture', cells: ['Incremental move to services', 'Big-bang rewrite', 'Keeps shipping; each path moves when proven'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Name the two copies of truth.</strong> Search reads a fast, eventually consistent copy; booking writes the authoritative one. Say how stale the copy may be and what the user sees when it is wrong.</li>
          <li><strong>Correctness belongs in the database.</strong> App-level checks are optimizations. A constraint is the guarantee that survives bugs and races.</li>
          <li><strong>Time is the product.</strong> Holds, cancellation windows, payout timing, and timezone-correct nights are core domain logic.</li>
          <li><strong>Platforms pay off.</strong> Experiment tooling, pipeline orchestration, and CDC made every later team faster.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="How would you make “available for these dates” fast in search across millions of listings?"
        senior={<p>Store availability in the search engine as a list of booked date ranges per listing, and filter with a range query. Cache popular searches.</p>}
        staff={<>
          <p>Estimate first: 365 nights × millions of listings is only a few hundred MB as bits. So I would store a <strong>per-night bitmap</strong> per listing in the index shards and filter with a bitwise AND after the geo filter narrows candidates.</p>
          <p>Freshness comes from CDC off the bookings database, seconds behind at worst. Search can occasionally show a just-booked home, because booking re-checks the source of truth. I would track the “sorry, just booked” rate to see whether the lag hurts.</p>
        </>}
        followUps={['How do you handle minimum-stay rules and check-in-day restrictions?', 'What changes for hourly bookings (e.g. meeting rooms)?', 'How do you shard the index: by geography or by listing id?']}
      />
      <InterviewQuestion
        q="Two guests try to book the same home for overlapping nights at the same moment. Walk me through it."
        senior={<p>Use a transaction with SELECT … FOR UPDATE on the listing, check for overlaps, then insert. The second transaction waits and then sees the conflict.</p>}
        staff={<>
          <p>Put the invariant in the schema: an exclusion constraint on (listing, night range). The database decides the race, and the loser gets a specific error that we map to alternative dates. Row locks also work, but they serialize all bookings for a listing, even for other dates.</p>
          <p>Payment takes seconds, so add a <strong>short hold</strong>: insert a pending booking under the same constraint with an expiry, charge with an idempotency key, then confirm. An expiry job releases abandoned holds.</p>
        </>}
        followUps={['What if payment succeeds but confirming the booking fails?', 'How long should a hold last, and who decides?']}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Availability is the defining query: store nights as bits in the search index, fed by change data capture.',
        'Search reads a fast, slightly stale copy; booking enforces the truth in the database.',
        'Make double-booking impossible with constraints and short holds, and double-charging impossible with idempotency keys.',
        'Invest in platforms early: risk scoring, experiments, and pipelines made every later step safer.',
        'Break up a monolith incrementally, comparing old and new behaviour as traffic moves.',
      ]} />
    </>
  )
}
