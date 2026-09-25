import {
  References,
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeAirbnbAvailabilityDemo } from './demos/episode-airbnb-availability-demo'
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

// Primary public sources behind the “In the real world” notes.
const REFS: Reference[] = [
  { title: "Airbnb’s Great Migration: From Monolith to Service-Oriented", source: "Jessica Tai, QCon San Francisco", year: 2018, url: "https://qconsf.com/sf2018/sf2018/presentation/airbnbs-great-migration-monolith-service-oriented.html", kind: "talk", note: "Rails “monorail” → SOA" },
  { title: "Airbnb’s Great Migration (video and transcript)", source: "InfoQ", year: 2019, url: "https://www.infoq.com/presentations/airbnb-soa-migration/", kind: "talk" },
  { title: "Applying Deep Learning to Airbnb Search", source: "Haldar et al., KDD", year: 2019, url: "https://arxiv.org/abs/1810.09591", kind: "paper" },
  { title: "Real-time Personalization using Embeddings for Search Ranking at Airbnb", source: "Grbovic & Cheng, KDD", year: 2018, url: "https://doi.org/10.1145/3219819.3219885", kind: "paper" },
  { title: "Range types", source: "PostgreSQL documentation", url: "https://www.postgresql.org/docs/current/rangetypes.html", kind: "docs" },
  { title: "Constraints: exclusion constraints", source: "PostgreSQL documentation", url: "https://www.postgresql.org/docs/current/ddl-constraints.html", kind: "docs", note: "the no-overlap booking snippet" },
]

export default function AirbnbEpisode() {
  return (
    <>
      <p>
        Airbnb is a two-sided marketplace where the product is <strong>time</strong>: a specific home on specific
        nights. That single fact drives the architecture. Search must filter millions of listings by calendar,
        booking must make double-booking impossible, and money has to flow to guests and hosts at different moments.
        This episode grows the system from a monolith to a service-oriented platform.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Notice how the <em>same</em> fact, “is this home free on these nights?”, lives in two places: a fast,
        slightly stale copy for search and an authoritative one for booking. Most of the design is managing that gap.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Airbnb; all trademarks belong to their owners.</em></p>

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
        index</strong> instead of being a join against the bookings table. Bookings themselves are a gentle write
        rate, so they can afford strong consistency and strict constraints.
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
        Checking availability by scanning booking rows costs work proportional to <em>all bookings</em> in the area.
        Keeping one bit per night per listing turns the check into a single AND per listing, no matter how many
        bookings exist. But the index is a copy. The booking path must still enforce correctness in the database.
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
          { label: 'Availability in search', cells: ['Nights bitmap in the index', 'Join against bookings at query time', 'O(listings) filter; the calendar fits in memory'] },
          { label: 'Index freshness', cells: ['CDC from the bookings DB', 'App code calls reindex', 'Cannot be forgotten by a code path; replayable'] },
          { label: 'Double-booking guard', cells: ['DB constraint + short holds', 'Check-then-insert in app code', 'Races are impossible, not just unlikely'] },
          { label: 'Paying hosts', cells: ['Hold funds, pay out after check-in', 'Pay host at booking', 'Refunds and cancellations before the stay stay simple'] },
          { label: 'Architecture', cells: ['Incremental SOA migration', 'Big-bang rewrite', 'Keeps shipping; each path moves when ready'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Name the two copies of truth.</strong> Search reads a fast, eventually consistent copy; booking writes the authoritative one. Say how stale the copy may be and what the user sees when it is wrong.</li>
          <li><strong>Correctness belongs in the database.</strong> App-level checks are optimizations. A constraint is the guarantee that survives bugs and races.</li>
          <li><strong>Time is the product.</strong> Holds, cancellation windows, payout timing, and timezone-correct nights are core domain logic, not edge cases.</li>
          <li><strong>Migrations are a strategy problem.</strong> Sequence the monolith breakup by pain and risk, keep a proxy seam, and measure progress by traffic moved, not services created.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="How would you make “available for these dates” fast in search across millions of listings?"
        senior={<p>Store availability in the search engine (e.g. Elasticsearch) as a list of booked date ranges per listing, and filter with a range query. Cache popular searches.</p>}
        staff={<>
          <p>Estimate first: 365 nights × millions of listings is only a few hundred MB as bits. So I would materialize a <strong>per-night bitmap</strong> per listing in the index shards and filter with a bitwise AND after the geo filter narrows candidates. Range-list encodings work too, but bitmaps give a constant-cost check.</p>
          <p>Freshness comes from CDC off the bookings database, so it is seconds behind at worst. I accept that search can occasionally show a just-booked home, because the booking path re-validates against the source of truth. I would track the “sorry, just booked” rate as the metric that tells us whether the lag is hurting.</p>
        </>}
        followUps={['How do you handle minimum-stay rules and check-in-day restrictions?', 'What changes for hourly bookings (e.g. meeting rooms)?', 'How do you shard the index — by geography or by listing id?']}
      />
      <InterviewQuestion
        q="Two guests try to book the same home for overlapping nights at the same moment. Walk me through it."
        senior={<p>Use a transaction with SELECT … FOR UPDATE on the listing, check for overlaps, then insert. The second transaction waits and then sees the conflict.</p>}
        staff={<>
          <p>Put the invariant in the schema: an exclusion constraint on (listing, night range), or one row per listing-night with a unique key. Then the race is decided by the database, and the loser gets a specific error that we map to alternative dates. Row locks work too, but they serialize all bookings for a listing even when the dates do not overlap.</p>
          <p>Payment takes seconds, so I would add a <strong>short hold</strong>: insert a pending booking under the same constraint with an expiry, charge with an idempotency key, then confirm. An expiry job releases abandoned holds. That also gives honest UX: whoever reaches checkout first holds the nights for a few minutes.</p>
        </>}
        followUps={['What if payment succeeds but confirming the booking fails?', 'How long should a hold last, and who decides?']}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Availability is the defining query: materialize nights as bits in the search index.',
        'Search reads a fast, slightly stale copy; booking enforces truth in the database.',
        'Make double-booking impossible with constraints and short holds, not just app checks.',
        'Money flows at different times for guests and hosts: charge at booking, pay out after check-in.',
        'Break up the monolith incrementally, with clear data ownership per service.',
      ]} />
    </>
  )
}
