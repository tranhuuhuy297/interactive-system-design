import {
  References,
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion, KeyTakeaways,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeUberDispatchDemo } from './demos/episode-uber-dispatch-demo'
import { UBER_STAGES } from './demos/episode-uber-stages'

const MATCH_NODES: ArchNode[] = [
  { id: 'rider', label: 'Rider app', kind: 'client', x: 10, y: 30 },
  { id: 'driver', label: 'Driver app', kind: 'client', x: 10, y: 78 },
  { id: 'gw', label: 'API edge', kind: 'lb', x: 30, y: 30 },
  { id: 'trips', label: 'Trip service', kind: 'service', x: 50, y: 30,
    detail: 'Owns the trip state machine. Every transition is a conditional write, so a retried “accept” is a no-op instead of a second driver.' },
  { id: 'dispatch', label: 'Dispatch', kind: 'service', x: 50, y: 60,
    detail: 'Collects requests for a short window, pulls candidate drivers from nearby cells, scores them by ETA, and solves the assignment.' },
  { id: 'geo', label: 'Geo index', sub: 'hex cells', kind: 'cache', x: 74, y: 78, detail: 'Latest driver positions keyed by cell. Candidates come from the rider’s cell plus a ring of neighbours.' },
  { id: 'eta', label: 'ETA / routing', kind: 'service', x: 74, y: 44, detail: 'Road-graph routing plus live speeds. Straight-line distance is only a cheap pre-filter.' },
  { id: 'push', label: 'Driver channel', sub: 'persistent conn.', kind: 'external', x: 30, y: 78, detail: 'Offers go out over a long-lived connection, with push notifications as a fallback. The driver has a few seconds to accept.' },
  { id: 'store', label: 'Trip store', kind: 'db', x: 74, y: 14 },
]
const MATCH_EDGES: ArchEdge[] = [
  { from: 'rider', to: 'gw' }, { from: 'gw', to: 'trips' }, { from: 'trips', to: 'store' }, { from: 'trips', to: 'dispatch' },
  { from: 'dispatch', to: 'geo' }, { from: 'dispatch', to: 'eta' }, { from: 'dispatch', to: 'push' }, { from: 'push', to: 'driver' },
  { from: 'driver', to: 'gw' },
]

// Primary public sources behind the “In the real world” notes.
const REFS: Reference[] = [
  { title: "H3: Uber’s Hexagonal Hierarchical Spatial Index", source: "Uber Engineering", year: 2018, url: "https://www.uber.com/us/en/blog/h3/", kind: "blog" },
  { title: "H3 (open-source library)", source: "Uber on GitHub", url: "https://github.com/uber/h3", kind: "docs" },
  { title: "Designing Schemaless, Uber Engineering’s Scalable Datastore Using MySQL", source: "Uber Engineering", year: 2016, url: "https://www.uber.com/us/en/blog/schemaless-part-one-mysql-datastore/", kind: "blog" },
  { title: "The Architecture of Schemaless, Uber Engineering’s Trip Datastore Using MySQL", source: "Uber Engineering", year: 2016, url: "https://www.uber.com/us/en/blog/schemaless-part-two-architecture/", kind: "blog" },
  { title: "H3 documentation", source: "h3geo.org", url: "https://h3geo.org/", kind: "docs" },
  { title: "Disaster recovery for multi-region Kafka at Uber", source: "Uber Engineering", url: "https://www.uber.com/us/en/blog/kafka/", kind: "blog", note: "“one of the largest Kafka deployments”" },
]

export default function UberEpisode() {
  return (
    <>
      <p>
        Uber looks like a map with cars on it. Underneath, it is a <strong>real-time marketplace</strong>. Millions of
        moving drivers stream their location every few seconds, and each ride request must be matched to the right
        driver in seconds. Once a trip exists, it must survive dropped phones, double taps, and whole data-center
        outages. This episode builds that system from a single server in a single city.
      </p>
      <Callout kind="info" title="How to watch this episode">
        At every stage, ask: <em>what is the hot path, and what state must never be lost?</em> In ride-hailing those
        are two very different things. Locations are disposable; trips are sacred.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by Uber; all trademarks belong to their owners.</em></p>

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={UBER_STAGES} height={420} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <EstimationTable
        assumptions={['Illustrative: 5M drivers online at global peak', 'One GPS update every 4 s per online driver', 'Order of 10M+ trips/day (Uber reports billions of trips per year)']}
        rows={[
          { label: 'Location writes', math: '5M / 4 s', result: '≈ 1.25M/s' },
          { label: 'Location payload', math: '1.25M × ~100 B', result: '≈ 125 MB/s' },
          { label: 'Latest-position state', math: '5M × ~100 B', result: '≈ 0.5 GB' },
          { label: 'Trip writes', math: '~15M trips × ~6 transitions / 86,400 s', result: '≈ 1K/s' },
        ]}
      />
      <p>
        The asymmetry is the design. Location traffic is huge but <strong>tiny in state</strong>: the latest position of
        every driver fits in memory on a handful of machines. Trips are a trickle of writes, but each one is money.
        So locations get an in-memory, loss-tolerant path, and trips get a durable, strongly consistent one.
      </p>

      <H2 id="request-flow">From “Request” to a driver’s phone</H2>
      <ArchitectureDiagram nodes={MATCH_NODES} edges={MATCH_EDGES} height={400}
        caption="The matching loop: seconds end to end, with a durable trip record at every step"
        flows={[
          { name: 'Match', path: ['rider', 'gw', 'trips', 'dispatch', 'geo'], steps: ['Rider requests a trip', 'Edge routes to the trip service', 'A trip is created in state “requested” and handed to dispatch', 'Dispatch gathers candidates from nearby cells'] },
          { name: 'Offer', path: ['dispatch', 'eta', 'dispatch', 'push', 'driver'], steps: ['Dispatch scores candidates by road ETA', 'It picks the best assignment for the batch', 'The offer goes out over the driver channel', 'The driver sees the request with a countdown'] },
          { name: 'Accept', path: ['driver', 'gw', 'trips', 'store'], steps: ['Driver accepts', 'Routed to the trip service', 'Conditional write: requested → accepted, only if still requested'] },
        ]} />

      <H2 id="matching">Deep dive: why nearest-driver is not optimal</H2>
      <p>
        Greedy dispatch gives each rider the closest free driver the moment they tap. It feels fair, but it is
        <strong> locally optimal and globally wasteful</strong>. An early rider can take the only driver who was
        perfectly placed for the next rider, leaving that rider with a long wait. Collecting requests over a short
        window and solving the assignment together lowers total pickup time for the whole city.
      </p>
      <EpisodeUberDispatchDemo />
      <Callout kind="tip">
        The batched solver here is an exact minimum-total-ETA assignment, fine for a handful of riders. Real systems
        solve much larger bipartite matchings every few seconds per region, using heuristics and constraints: driver
        preferences, vehicle type, and trips that finish soon (“chaining”).
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Driver locations', cells: ['In-memory, latest value only', 'Row per ping in SQL', 'Huge write rate, tiny state, loss-tolerant (drivers re-report)'] },
          { label: 'Spatial index', cells: ['Hexagonal cells', 'Lat/long bounding box, geohash squares', 'Uniform neighbour distance; clean multi-resolution smoothing'] },
          { label: 'Matching', cells: ['Batched, ETA-based', 'Greedy nearest by distance', 'Lower total wait; ETA reflects roads, not crow-flies distance'] },
          { label: 'Trip state', cells: ['State machine + conditional writes', 'Free-form status field', 'Idempotent retries; no double accept; auditable'] },
          { label: 'Driver notification', cells: ['Persistent connection + push fallback', 'Polling', 'Offers expire in seconds; polling is slow and wasteful'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Classify state by cost of loss.</strong> Location: disposable, optimize for throughput. Trip and payment: durable, optimize for correctness. Saying this out loud is the key insight interviewers look for.</li>
          <li><strong>Optimize the marketplace, not one request.</strong> Batching, chaining, and surge exist because the objective is system-wide: total wait, utilization, and reliability.</li>
          <li><strong>Design for the phone as a replica.</strong> Mobile networks drop constantly; the client must hold enough state to resume and reconcile after a failover.</li>
          <li><strong>Surge is a policy surface.</strong> Mention caps, transparency, and regulatory limits. The algorithm is the easy part.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="How do you store and query the real-time locations of millions of drivers?"
        senior={<p>Drivers send location every few seconds to a location service that writes to Redis with geospatial commands (GEOADD/GEOSEARCH). Dispatch queries drivers within a radius. Shard by city.</p>}
        staff={<>
          <p>First classify the data: it is <strong>latest-value-wins and loss-tolerant</strong>, about 1M+ writes/s but well under a few GB of state. So keep it in memory and skip durable writes on the hot path. Index by hexagonal cell at a resolution where a cell holds tens of drivers. A query then reads the rider’s cell plus one ring of neighbours.</p>
          <p>Partition by cell (or by region, then cell) so writes and reads for an area land on the same shard. Handle hot cells, such as airports and stadiums, by splitting to a finer resolution. Publish the raw stream to a log for history, ETA training, and fraud, off the critical path. If a shard dies, drivers re-populate it within one reporting interval.</p>
        </>}
        followUps={['How do you avoid showing a driver who just went offline?', 'What resolution of cell would you choose, and why?', 'How do you handle a driver crossing a shard boundary?']}
      />
      <InterviewQuestion
        q="Two drivers tap Accept on the same trip within 50 ms. What happens?"
        senior={<p>Use a lock or a database transaction on the trip row so only one accept wins; the other driver gets an error.</p>}
        staff={<>
          <p>The trip is a <strong>state machine</strong>, so accepting is a compare-and-set: “set driver = D, state = accepted <em>where</em> state = requested and version = v”. Exactly one write succeeds, and the loser gets a clear “trip taken” response and returns to the pool immediately. No long-held locks are needed.</p>
          <p>Make the accept idempotent per (trip, driver), so a network retry from the winner doesn’t fail. Ideally dispatch offers a trip to one driver at a time with a short timeout, so races are rare by design. The CAS is the safety net, not the primary mechanism.</p>
        </>}
        followUps={['What if the trip store is unavailable when a driver accepts?', 'How do you design offer timeouts to balance wait time and driver fairness?']}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Split disposable, high-rate location data from durable, low-rate trip data. They need opposite designs.',
        'Index space with hierarchical cells; query a cell plus its neighbours.',
        'Match on road ETA and batch requests. Greedy nearest-driver wastes total pickup time.',
        'Model trips as state machines with conditional, idempotent transitions.',
        'Streams turn raw pings into ETAs, surge, and fraud signals; multi-region keeps trips alive through outages.',
      ]} />
    </>
  )
}
