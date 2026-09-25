import {
  References, TLDR, Term,
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeUberDispatchDemo } from './demos/episode-uber-dispatch-demo'
import { UBER_SRC } from './demos/episode-uber-sources'
import { UBER_STAGES } from './demos/episode-uber-stages'

const MATCH_NODES: ArchNode[] = [
  { id: 'rider', label: 'Rider app', kind: 'client', x: 10, y: 30 },
  { id: 'driver', label: 'Driver app', kind: 'client', x: 10, y: 78 },
  { id: 'gw', label: 'API edge', kind: 'lb', x: 30, y: 30 },
  { id: 'trips', label: 'Trip service', kind: 'service', x: 50, y: 30,
    detail: 'Owns the trip state machine. Every transition is a conditional write, so a retried “accept” is a no-op, not a second driver.' },
  { id: 'dispatch', label: 'Dispatch', kind: 'service', x: 50, y: 60,
    detail: 'Collects requests for a short window, pulls candidate drivers from nearby cells, scores them by ETA, and solves the assignment.' },
  { id: 'geo', label: 'Geo index', sub: 'cells', kind: 'cache', x: 74, y: 78, detail: 'Latest driver positions keyed by cell. Candidates come from the rider’s cell plus a ring of neighbours.' },
  { id: 'eta', label: 'ETA / routing', kind: 'service', x: 74, y: 44, detail: 'Road-graph routing plus live speeds and a learned correction. Straight-line distance is only a cheap pre-filter.' },
  { id: 'push', label: 'Driver channel', sub: 'persistent conn.', kind: 'external', x: 30, y: 78, detail: 'Offers go out over a long-lived connection, with push notifications as a fallback. The driver has a few seconds to accept.' },
  { id: 'store', label: 'Trip store', kind: 'db', x: 74, y: 14 },
]
const MATCH_EDGES: ArchEdge[] = [
  { from: 'rider', to: 'gw' }, { from: 'gw', to: 'trips' }, { from: 'trips', to: 'store' }, { from: 'trips', to: 'dispatch' },
  { from: 'dispatch', to: 'geo' }, { from: 'dispatch', to: 'eta' }, { from: 'dispatch', to: 'push' }, { from: 'push', to: 'driver' },
  { from: 'driver', to: 'gw' },
]

// Every source used anywhere in the episode, including per-stage deep dives.
const REFS: Reference[] = Object.values(UBER_SRC)

export default function UberEpisode() {
  return (
    <>
      <TLDR items={[
        'Uber is a real-time marketplace: millions of moving drivers must be matched to riders within seconds.',
        'Two kinds of data drive the design. Locations are huge in volume but disposable. Trips are small in volume but must never be lost.',
        'Matching moved from “nearest driver in a database” to cell-sharded, in-memory dispatch that ranks by road travel time.',
        'Growth brought its own problems: thousands of services, then tracing, a shared event backbone, an ML platform, and service domains.',
        'The trip core ended up on a transactional, multi-region database: correctness first, at the cost of latency engineering.',
      ]} />
      <p>
        Uber looks like a map with cars on it. Underneath, it is a <strong>real-time marketplace</strong>. Drivers
        stream their position every few seconds. Each ride request must reach the right driver in seconds. And a trip,
        once started, must survive dropped phones, double taps, and whole datacenter outages.
      </p>
      <p>
        This episode rebuilds that system in 12 stages, from a single Python app to today’s platform. Years appear
        where Uber has documented them; the rest are labelled as estimates.
      </p>
      <Callout kind="info" title="How to watch this episode">
        At every stage, ask two questions: <em>what is the hot path, and what state must never be lost?</em> Open
        “Go deeper” for the step-by-step flow, numbers, alternatives, and sources behind each stage.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Uber; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <ol>
        {UBER_STAGES.map((s) => (
          <li key={s.title}><strong>{s.era}</strong> · {s.title.replace(/^v\d+ · /, '')}: {s.summary}</li>
        ))}
      </ol>

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={UBER_STAGES} height={420} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <EstimationTable
        assumptions={['Illustrative: 5M drivers online at global peak', 'One GPS update every 4 s per online driver', 'Illustrative: 15M trips per day, ~6 state changes each']}
        rows={[
          { label: 'Location writes', math: '5M / 4 s', result: '≈ 1.25M/s' },
          { label: 'Location payload', math: '1.25M × ~100 B', result: '≈ 125 MB/s' },
          { label: 'Latest-position state', math: '5M × ~100 B', result: '≈ 0.5 GB' },
          { label: 'Trip writes', math: '15M × 6 / 86,400 s', result: '≈ 1K/s' },
        ]}
      />
      <p>
        The asymmetry <em>is</em> the design. Location traffic is huge, but its state is tiny: every driver’s latest
        position fits in memory on a few machines. Trips are a trickle of writes, but each one is money. So locations
        get a fast, loss-tolerant path, and trips get a durable, strongly consistent one.
      </p>

      <H2 id="request-flow">From “Request” to a driver’s phone</H2>
      <ArchitectureDiagram nodes={MATCH_NODES} edges={MATCH_EDGES} height={400}
        caption="The matching loop: seconds end to end, with a durable trip record at every step"
        flows={[
          { name: 'Match', path: ['rider', 'gw', 'trips', 'dispatch', 'geo'], steps: ['Rider requests a trip', 'The edge routes to the trip service', 'A trip is created in state “requested” and handed to dispatch', 'Dispatch gathers candidates from nearby cells'] },
          { name: 'Offer', path: ['dispatch', 'eta', 'dispatch', 'push', 'driver'], steps: ['Dispatch scores candidates by road ETA', 'It picks the best assignment for the batch', 'The offer goes out over the driver channel', 'The driver sees the request with a countdown'] },
          { name: 'Accept', path: ['driver', 'gw', 'trips', 'store'], steps: ['Driver accepts', 'Routed to the trip service', 'Conditional write: requested → accepted, only if still requested'] },
        ]} />

      <H2 id="matching">Deep dive: why nearest-driver is not optimal</H2>
      <p>
        Greedy dispatch gives each rider the closest free driver the moment they tap. It feels fair, but it is
        <strong> locally optimal and globally wasteful</strong>. An early rider can take the only driver who was
        perfectly placed for the next rider.
      </p>
      <p>
        Collecting requests over a short window and solving them together lowers total pickup time for the whole
        city. Uber’s 2015 talk listed exactly these goals: less waiting, less extra driving, and the lowest overall{' '}
        <Term def="Estimated time of arrival: how long until the driver reaches the rider, on real roads.">ETA</Term>.
      </p>
      <EpisodeUberDispatchDemo />
      <Callout kind="tip">
        The batched solver here is an exact minimum-total-ETA assignment, fine for a handful of riders. Real systems
        solve much larger matchings every few seconds per region, with heuristics and constraints: vehicle type,
        driver preferences, and trips that finish soon.
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Driver locations', cells: ['In memory, latest value only', 'One database row per ping', 'Huge write rate, tiny state, loss-tolerant'] },
          { label: 'Spatial index', cells: ['Cells (S2, later H3 hexagons)', 'Per-city shards', 'Even load; neighbours are cheap to query'] },
          { label: 'Matching', cells: ['Batched, by road ETA', 'Greedy nearest by distance', 'Lower total wait; roads, not crow-flies distance'] },
          { label: 'Trip state', cells: ['State machine + conditional writes', 'Free-form status field', 'Safe retries; no double accept; auditable'] },
          { label: 'Service sprawl', cells: ['Typed contracts, then domains', 'Ad-hoc JSON between services', 'Changes break in review, not in production'] },
          { label: 'Trip core storage', cells: ['Transactional NewSQL (Spanner)', 'NoSQL + app-level consistency', 'Invariants span entities; correctness first'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Classify state by the cost of losing it.</strong> Location: disposable, optimize for throughput. Trip and payment: durable, optimize for correctness.</li>
          <li><strong>Optimize the marketplace, not one request.</strong> Batching, planning ahead, and surge exist because the goal is system-wide.</li>
          <li><strong>Treat the phone as a replica.</strong> Mobile networks drop constantly; clients hold enough state to resume after failover.</li>
          <li><strong>Growth is an architecture problem too.</strong> Contracts, tracing, and domains are what keep thousands of services changeable.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="How do you store and query the real-time locations of millions of drivers?"
        senior={<p>Drivers send their location every few seconds to a location service that writes to Redis with geospatial commands (GEOADD/GEOSEARCH). Dispatch queries drivers within a radius. Shard by city.</p>}
        staff={<>
          <p>First classify the data: <strong>latest-value-wins and loss-tolerant</strong>, over 1M writes/s but only a few GB of state. So keep it in memory and skip durable writes on the hot path. Index by cell at a size where a cell holds tens of drivers. A query reads the rider’s cell plus one ring of neighbours.</p>
          <p>Shard by cell, not by city, so load spreads evenly. Split hot areas such as airports to a finer resolution. Publish the raw stream to a log for history, ETA training, and fraud, off the critical path. If a shard dies, drivers refill it within one reporting interval.</p>
        </>}
        followUps={['How do you avoid showing a driver who just went offline?', 'What cell size would you choose, and why?', 'How do you handle a driver crossing a shard boundary?']}
      />
      <InterviewQuestion
        q="Two drivers tap Accept on the same trip within 50 ms. What happens?"
        senior={<p>Use a lock or a database transaction on the trip row so only one accept wins; the other driver gets an error.</p>}
        staff={<>
          <p>The trip is a <strong>state machine</strong>, so accepting is a compare-and-set: “set driver = D, state = accepted, <em>only if</em> state = requested and version = v”. Exactly one write succeeds. The loser gets a clear “trip taken” response and returns to the pool. No long-held locks are needed.</p>
          <p>Make the accept idempotent per trip and driver, so the winner’s network retry doesn’t fail. Ideally dispatch offers a trip to one driver at a time with a short timeout, so races are rare by design. The compare-and-set is the safety net.</p>
        </>}
        followUps={['What if the trip store is unavailable when a driver accepts?', 'How do you set offer timeouts to balance wait time and fairness?']}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Split disposable, high-rate location data from durable, low-rate trip data. They need opposite designs.',
        'Index space with cells and query a cell plus its neighbours; shard by cell, not by city.',
        'Match on road ETA and batch requests. Greedy nearest-driver wastes total pickup time.',
        'Model trips as state machines with conditional, idempotent transitions, and keep them on transactional storage.',
        'At scale, contracts, tracing, shared event streams, and domains are what keep the system changeable.',
      ]} />
    </>
  )
}
