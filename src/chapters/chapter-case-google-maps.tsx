import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements, References,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { MapsRoutingVisualizerDemo } from './demos/maps-routing-visualizer-demo'
import { MapsTilePyramidDemo } from './demos/maps-tile-pyramid-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Mobile app', sub: 'GPS + renderer', kind: 'client', x: 7, y: 50,
    detail: 'Renders vector tiles locally, buffers GPS fixes and uploads them in batches, and keeps the active route to detect deviation without a server round trip.' },
  { id: 'cdn', label: 'CDN', sub: 'tile cache', kind: 'cdn', x: 27, y: 14,
    detail: 'Tiles are immutable per map version, so they get long TTLs and very high hit ratios. Most tile bytes never touch the origin.' },
  { id: 'tiles', label: 'Tile store', sub: 'object storage', kind: 'storage', x: 52, y: 14,
    detail: 'Pre-rendered vector tiles keyed by version/z/x/y. Sparse, deep zooms can be generated on demand and written back.' },
  { id: 'gw', label: 'API gateway', kind: 'lb', x: 27, y: 55,
    detail: 'Auth, rate limiting, routing to regional backends. Location uploads and route requests take separate paths so a surge in one cannot starve the other.' },
  { id: 'nav', label: 'Navigation API', sub: 'stateless', kind: 'service', x: 50, y: 55,
    detail: 'Geocodes origin/destination, asks routing for candidates, asks ETA for times, returns 2–3 alternatives.' },
  { id: 'routing', label: 'Routing engine', sub: 'in-memory graph', kind: 'service', x: 72, y: 40,
    detail: 'Holds a preprocessed road graph in RAM (e.g. contraction hierarchies), sharded by region with a coarse long-distance overlay. Answers most queries in milliseconds.' },
  { id: 'graph', label: 'Routing tiles', sub: 'graph versions', kind: 'db', x: 92, y: 22,
    detail: 'Road graph split into hierarchical tiles, rebuilt offline when map data changes and loaded by routing nodes per version.' },
  { id: 'speeds', label: 'Live speeds', sub: 'segment → km/h', kind: 'cache', x: 92, y: 58,
    detail: 'Current speed per road segment, blended from live probes and historical profiles. The ETA model and traffic-aware edge weights read it.' },
  { id: 'loc', label: 'Location API', sub: 'ingest', kind: 'service', x: 50, y: 88,
    detail: 'Accepts batched GPS fixes, validates them, and appends them to Kafka. It does no processing on the request path.' },
  { id: 'kafka', label: 'Kafka', sub: 'location topic', kind: 'queue', x: 72, y: 88,
    detail: 'Partitioned by region/segment so map-matching consumers get locality. Also feeds history, model training and incident detection.' },
  { id: 'traffic', label: 'Traffic stream', sub: 'map-match + agg', kind: 'worker', x: 92, y: 88,
    detail: 'Snaps GPS traces to road segments (HMM map matching), aggregates speeds per segment per minute, and writes them to the live-speed store.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'cdn' }, { from: 'cdn', to: 'tiles' },
  { from: 'client', to: 'gw' }, { from: 'gw', to: 'nav' }, { from: 'nav', to: 'routing' },
  { from: 'routing', to: 'graph' }, { from: 'routing', to: 'speeds' },
  { from: 'gw', to: 'loc' }, { from: 'loc', to: 'kafka', async: true }, { from: 'kafka', to: 'traffic' },
  { from: 'traffic', to: 'speeds' },
]

const REFS: Reference[] = [
  { title: 'A note on two problems in connexion with graphs', source: 'E. W. Dijkstra, Numerische Mathematik', year: 1959, url: 'https://doi.org/10.1007/BF01386390', kind: 'paper' },
  { title: 'A Formal Basis for the Heuristic Determination of Minimum Cost Paths', source: 'P. Hart, N. Nilsson, B. Raphael, IEEE TSSC', year: 1968, url: 'https://ieeexplore.ieee.org/document/4082128', kind: 'paper', note: 'the A* algorithm' },
  { title: 'Contraction Hierarchies: Faster and Simpler Hierarchical Routing in Road Networks', source: 'R. Geisberger et al., WEA', year: 2008, url: 'https://doi.org/10.1007/978-3-540-68552-4_24', kind: 'paper' },
  { title: 'Customizable Route Planning', source: 'D. Delling et al., SEA', year: 2011, url: 'https://doi.org/10.1007/978-3-642-20662-7_32', kind: 'paper', note: 'fast re-weighting for live traffic' },
  { title: 'Hidden Markov Map Matching Through Noise and Sparseness', source: 'P. Newson & J. Krumm, ACM SIGSPATIAL', year: 2009, url: 'https://www.microsoft.com/en-us/research/publication/hidden-markov-map-matching-noise-sparseness/', kind: 'paper' },
  { title: 'ETA Prediction with Graph Neural Networks in Google Maps', source: 'A. Derrow-Pinion et al., CIKM', year: 2021, url: 'https://arxiv.org/abs/2108.11482', kind: 'paper' },
  { title: 'Slippy map tilenames (z/x/y scheme)', source: 'OpenStreetMap Wiki', url: 'https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames', kind: 'docs' },
  { title: 'System Design Interview – An Insider’s Guide, Volume 2', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'Google Maps prompt' },
]

export default function GoogleMapsChapter() {
  return (
    <>
      <p>
        “Design Google Maps” is really three systems glued together. There is a <strong>static content system</strong>
        (map tiles, CDN-shaped), a <strong>graph compute system</strong> (routing over hundreds of millions of road
        segments), and a <strong>streaming system</strong> (billions of GPS fixes becoming live traffic). Strong
        candidates name the three up front and let the interviewer pick which to go deep on.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Render the map at any zoom', 'Route A → B (driving) with ETA', 'Live traffic affects routes and ETAs', 'Reroute during navigation', 'Ingest user location (opt-in)']}
        nonFunctional={['Tile loads feel instant (CDN-served)', 'Route response p99 < 1 s', 'ETA accuracy within a few % on typical trips', 'Handle rush-hour peaks', 'Privacy: location data minimized and anonymized']}
        outOfScope={['Places search & reviews', 'Transit / walking modes', 'Street View imagery']}
      />
      <Callout kind="tip">
        Ask which part they care about. “Mostly routing and ETA” and “mostly the map rendering” lead to completely
        different deep dives. Don't spend 15 minutes on tiles if they wanted Dijkstra.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['1B daily users (illustrative)', 'Avg 5 min of active navigation per user per day', 'GPS fix every 1 s, uploaded in 15 s batches', '1 route request per user per day']}
        rows={[
          { label: 'GPS fixes', math: '1B × 300 s / 86,400', result: '≈ 3.5M/s' },
          { label: 'Upload requests', math: '3.5M / 15 per batch', result: '≈ 230K/s' },
          { label: 'Route QPS (avg)', math: '1B / 86,400', result: '≈ 12K/s' },
          { label: 'Route QPS (peak)', math: '12K × ~5 rush hour', result: '≈ 60K/s' },
          { label: 'Tiles z0–z21', math: '(4²² − 1) / 3', result: '≈ 5.9T tiles' },
          { label: 'Naive tile storage', math: '5.9T × ~25 KB', result: '≈ 150 PB' },
        ]}
      />
      <p>
        The naive tile number is the point. Nobody stores 150 PB of mostly ocean, so dedupe identical tiles and
        render sparse deep zooms lazily. The location stream is a <strong>write-heavy firehose</strong>: batch it on
        the device and never make the upload path synchronous with processing.
      </p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'GET', path: '/tiles/{ver}/{z}/{x}/{y}.pbf', desc: 'Vector tile, served by the CDN. The version in the path makes it immutable.', returns: 'protobuf tile' },
        { method: 'POST', path: '/v1/routes', desc: 'Compute routes with traffic-aware ETA.', body: '{ origin, destination, departAt?, avoid? }', returns: '{ routes: [{ polyline, etaSec, distanceM, steps }] }' },
        { method: 'POST', path: '/v1/locations:batch', desc: 'Batched GPS fixes from an opted-in device. Fire-and-forget: 202 Accepted.', body: '{ sessionId, fixes: [{ lat, lng, ts, speed, heading }] }', returns: '202' },
        { method: 'GET', path: '/v1/routes/{id}/updates', desc: 'During navigation: faster alternative or new ETA (poll or SSE).', returns: '{ etaSec, reroute?: route }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Three planes: static tiles via CDN, routing compute, and the location → traffic stream"
        flows={[
          { name: 'Load map', path: ['client', 'cdn', 'tiles'], steps: ['App requests the visible z/x/y tiles from the CDN', 'On a rare miss, the CDN fetches from the tile store and caches it'] },
          { name: 'Route', path: ['client', 'gw', 'nav', 'routing', 'speeds'], steps: ['POST /v1/routes', 'Gateway → navigation API', 'Navigation asks the routing engine for candidate paths', 'Edge weights and ETA use live segment speeds'] },
          { name: 'Location → traffic', path: ['client', 'gw', 'loc', 'kafka', 'traffic', 'speeds'], steps: ['App uploads a 15 s batch of fixes', 'Gateway → location API', 'Append to Kafka and return 202', 'Stream job map-matches and aggregates per segment', 'Live speed per segment is updated'] },
        ]} />

      <H2 id="tiles">5 · Deep dive: the tile pyramid</H2>
      <p>
        The world is a square in Web Mercator. Zoom 0 is one tile, and each level splits every tile into four, so zoom
        <em> z</em> has 4<sup>z</sup> tiles addressed by <code>z/x/y</code>. The client only fetches the handful of
        tiles in the viewport, which is why the map feels instant.
      </p>
      <MapsTilePyramidDemo />
      <CompareTable
        columns={['Raster tiles', 'Vector tiles']}
        rows={[
          { label: 'Payload', cells: ['PNG/JPEG images', 'Geometry + attributes (protobuf)'] },
          { label: 'Size', cells: ['Larger, one per style', 'Smaller; one tile serves many styles'] },
          { label: 'Client work', cells: ['Just draw images', 'GPU rendering on device'] },
          { label: 'Rotation / 3D / labels', cells: ['Baked in, blurry when rotated', 'Crisp at any angle, dynamic labels'] },
          { label: 'Dark mode / restyle', cells: ['Re-render every tile server-side', 'Change the style on the client'] },
        ]}
      />

      <H2 id="routing">6 · Deep dive: routing on a road graph</H2>
      <p>
        Roads form a directed weighted graph: intersections are nodes, road segments are edges, and the weight is
        travel time. Textbook Dijkstra is correct but explores outward in every direction. On a continental graph it
        would touch millions of nodes per query.
      </p>
      <MapsRoutingVisualizerDemo />
      <CompareTable
        columns={['Nodes explored', 'Preprocessing', 'Live traffic']}
        rows={[
          { label: 'Dijkstra', cells: ['Everything closer than the goal', 'None', 'Trivial: just read current weights'] },
          { label: 'A*', cells: ['Far fewer, guided by the heuristic', 'None', 'Easy; heuristic must stay admissible'] },
          { label: 'Bidirectional', cells: ['Two smaller balls meeting in the middle', 'None', 'Easy'] },
          { label: 'Contraction hierarchies', cells: ['Hundreds, not millions', 'Hours to build shortcuts', 'Hard: weights change, so use customizable variants (CCH/CRP)'] },
        ]}
      />
      <CodeBlock lang="ts" title="hierarchical routing idea" code={`
// Split the graph into routing tiles at several levels:
//   L0: every local street, small tiles
//   L1: arterials, medium tiles
//   L2: highways, continent-wide
// A long trip searches L0 near origin/destination, then jumps to L1/L2.
function route(origin: Node, dest: Node) {
  const start = searchLocal(origin, { level: 0, radiusKm: 5 })   // reach nearby arterials
  const end   = searchLocal(dest,   { level: 0, radiusKm: 5, reverse: true })
  return searchOverlay(start.frontier, end.frontier, { levels: [1, 2] })
}`} />
      <Callout kind="info">
        In practice, production engines use preprocessing techniques such as contraction hierarchies or
        multi-level partitioning (CRP) with a fast <strong>customization</strong> step. Traffic updates then
        re-weight the overlay in seconds instead of rebuilding for hours.
      </Callout>

      <H2 id="eta">7 · Deep dive: ETA and live traffic</H2>
      <ul>
        <li><strong>Historical profiles</strong>: expected speed per segment per 15-minute slot of the week. This is the baseline for any departure time.</li>
        <li><strong>Live probes</strong>: map-matched GPS traces give current segment speeds, trusted more where probe density is high.</li>
        <li><strong>Blend</strong>: weight live vs historical by freshness and sample count, then sum segment times along the path. A learned model corrects systematic error such as turns, lights and merges. Google has published work on graph neural networks for this.</li>
        <li><strong>Prediction</strong>: for a 40-minute trip, the segment you reach at minute 35 should use the <em>predicted</em> speed for then, not the speed now.</li>
      </ul>
      <CodeBlock lang="ts" title="blending a segment speed" code={`
function segmentSpeed(seg: SegmentId, at: Date): number {
  const hist = historicalProfile(seg, slotOfWeek(at))       // e.g. 42 km/h
  const live = liveSpeeds.get(seg)                          // { kmh, samples, ageSec } | undefined
  if (!live || live.ageSec > 600) return hist
  const trust = Math.min(1, live.samples / 20) * Math.exp(-live.ageSec / 300)
  return trust * live.kmh + (1 - trust) * hist
}`} />

      <H2 id="ingestion">8 · Deep dive: location ingestion and rerouting</H2>
      <CompareTable
        columns={['Send every fix', 'Batch on device (chosen)']}
        rows={[
          { label: 'Requests', cells: ['≈ 3.5M/s', '≈ 230K/s (15× fewer)'] },
          { label: 'Battery / radio', cells: ['Radio awake constantly', 'Radio wakes briefly'] },
          { label: 'Freshness', cells: ['~1 s', '≤ 15 s, fine for traffic aggregation'] },
        ]}
      />
      <p>
        <strong>Rerouting</strong> happens in two places. The client detects <em>deviation</em> locally, since it
        knows the route polyline, and requests a new route immediately. The server detects <em>better
        alternatives</em> when traffic changes along the remaining path. It only offers them if the saving beats a
        threshold, such as 3 minutes or 10%, so the route doesn't flap between two near-equal options.
      </p>

      <H2 id="data-model">9 · Data model</H2>
      <CodeBlock lang="ts" title="core records" code={`
type RoadSegment = {
  id: bigint; fromNode: bigint; toNode: bigint
  lengthM: number; speedLimitKmh: number; roadClass: 'local' | 'arterial' | 'highway'
  geometry: [number, number][]           // polyline for rendering + map matching
}
type LiveSpeed = { segmentId: bigint; kmh: number; samples: number; updatedAt: number } // KV, TTL ~10 min
type LocationFix = { sessionId: string; ts: number; lat: number; lng: number; speed: number; heading: number }
// Fixes: Kafka (hours) → anonymized aggregates (long term). Raw traces are not kept per user by default.`} />

      <H2 id="staff">10 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Version consistency</strong>: tiles, routing graph and geocoder must agree on one map version. Otherwise a route follows a road the map doesn't show. Put the version in every URL and response, and roll it out region by region.</li>
          <li><strong>Privacy</strong>: truncate trip starts and ends so homes aren't revealed, rotate session IDs, aggregate before storing, and enforce k-anonymity on segment speeds in sparse areas.</li>
          <li><strong>Feedback loops</strong>: if everyone is routed onto the same side street, it jams. Spread load across near-equal alternatives.</li>
          <li><strong>Offline and degraded modes</strong>: downloadable regions (tiles plus a routing subgraph) and on-device routing when the network drops.</li>
          <li><strong>Cost</strong>: CDN egress for tiles dominates. Vector tiles, delta updates between versions and client caches are cost levers, not just UX features.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Why not just run Dijkstra on the whole road graph for each request?"
        senior={<p>It's too slow on a graph with hundreds of millions of edges. A* with a distance heuristic explores far fewer nodes, and you can split the graph by region.</p>}
        staff={<>
          <p>Dijkstra settles every node closer than the destination. For a cross-country trip that is a large fraction of the continent, per request, at 60K QPS. A* helps a lot but a straight-line heuristic is weak on real road networks, where the highway is not in the straight-line direction.</p>
          <p>The production answer is <strong>preprocessing</strong>: contraction hierarchies or multi-level partitions reduce queries to hundreds of node visits. The catch is live traffic, since shortcuts precompute weights. So I'd pick a <strong>customizable</strong> variant, with a slow metric-independent preprocessing step once per map version and a fast customization step, seconds per region, whenever speeds change. That keeps queries fast and weights fresh.</p>
        </>}
        followUps={['How do you handle a road closure reported 30 seconds ago?', 'How do you route across two shards (regions)?', 'How would you add turn restrictions and U-turn penalties?']}
      />
      <InterviewQuestion
        q="How do you turn raw phone GPS into live traffic speeds?"
        senior={<p>Phones send locations to a service that writes to Kafka. A stream processor computes average speeds per road and stores them in a cache that routing reads.</p>}
        staff={<>
          <p>The hard step is <strong>map matching</strong>: GPS is noisy and urban canyons bounce signals, so a raw fix can land on a parallel street. An HMM (or similar) over the sequence of fixes picks the most likely path through the road graph. Only then do you get per-segment speeds.</p>
          <p>Then comes <strong>trust</strong>: weight by sample count and freshness, fall back to historical profiles when probes are sparse, and drop outliers such as a parked phone or a bus. Partition Kafka by region so matching has geographic locality. I'd also design for privacy from the start: aggregate per segment and minute, never persist raw per-user traces beyond a short window.</p>
        </>}
        followUps={['A stadium empties and 50K phones report 0 km/h on one road. Is that a jam?', 'How fresh must live speeds be to be useful?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Split the problem into three planes: static tiles (CDN), routing compute, and a location → traffic stream.',
        'The tile count is 4^z per level, so dedupe and render lazily. Versioned z/x/y URLs make tiles perfectly cacheable.',
        'A* beats Dijkstra, but production routing needs preprocessing (contraction hierarchies or CRP) with fast re-weighting for traffic.',
        'ETA blends historical profiles with live map-matched probes and predicts future segment speeds.',
        'Staff depth: map-version consistency, privacy of traces, routing feedback loops, offline mode, egress cost.',
      ]} />
    </>
  )
}
