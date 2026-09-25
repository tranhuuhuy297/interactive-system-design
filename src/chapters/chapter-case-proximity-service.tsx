import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, References, Requirements, TLDR, Term,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { GeoGeohashExplorer } from './demos/geo-geohash-explorer'
import { GeoQuadtreeDemo } from './demos/geo-quadtree-demo'

const REFS: Reference[] = [
  { title: 'Geohash', source: 'Wikipedia (algorithm by Gustavo Niemeyer, 2008)', url: 'https://en.wikipedia.org/wiki/Geohash', kind: 'docs', note: 'encoding and cell dimensions per precision' },
  { title: 'Quad trees: a data structure for retrieval on composite keys', source: 'R. A. Finkel & J. L. Bentley, Acta Informatica', year: 1974, url: 'https://link.springer.com/article/10.1007/BF00288933', kind: 'paper' },
  { title: 'S2 cell hierarchy', source: 'S2 Geometry documentation', url: 'https://s2geometry.io/devguide/s2cell_hierarchy.html', kind: 'docs' },
  { title: 'H3: Uber’s Hexagonal Hierarchical Spatial Index', source: 'Isaac Brodsky, Uber Engineering', year: 2018, url: 'https://www.uber.com/us/en/blog/h3/', kind: 'blog' },
  { title: 'H3 documentation', source: 'h3geo.org', url: 'https://h3geo.org/docs/', kind: 'docs' },
  { title: 'Redis geospatial indexes', source: 'Redis documentation', url: 'https://redis.io/docs/latest/develop/data-types/geospatial/', kind: 'docs', note: 'GEOADD / GEOSEARCH' },
  { title: 'PostGIS documentation', source: 'PostGIS', url: 'https://postgis.net/docs/', kind: 'docs', note: 'spatial indexes in a relational database' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 2 (ch. “Proximity Service”)', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'user', label: 'Mobile app', sub: 'lat/lon', kind: 'client', x: 10, y: 45 },
  { id: 'lb', label: 'Load balancer', sub: 'path routing', kind: 'lb', x: 31, y: 45 },
  { id: 'lbs', label: 'Location service', sub: 'read-only', kind: 'service', x: 47, y: 22,
    detail: 'Computes the covering cells for (lat, lon, radius), fetches candidate business IDs, filters by exact distance, ranks, and paginates. It holds no state, so it scales by adding replicas.' },
  { id: 'biz', label: 'Business service', sub: 'CRUD, owners', kind: 'service', x: 47, y: 75,
    detail: 'Handles owner edits and new listings. Writes are rare (a few per second) and can take effect on the next index refresh. Real-time consistency is not a requirement here.' },
  { id: 'geo', label: 'Geo index', sub: 'geohash → ids', kind: 'cache', x: 71, y: 22,
    detail: 'About 200M entries of (geohash, business_id), a few GB, so the whole index fits in memory. Replicate it to many read nodes (Redis or in-process) rather than sharding it.' },
  { id: 'cache', label: 'Business cache', sub: 'id → details', kind: 'cache', x: 71, y: 50,
    detail: 'Name, rating, hours and photos by ID, for rendering results. Hot businesses stay cached.' },
  { id: 'db', label: 'Business DB', sub: 'replicated', kind: 'db', x: 90, y: 75,
    detail: 'The source of truth. Read replicas serve cache misses. The primary takes the low write volume.' },
  { id: 'job', label: 'Index builder', sub: 'nightly / CDC', kind: 'worker', x: 71, y: 85,
    detail: 'Rebuilds or incrementally updates the geo index from the DB, via a nightly batch or change-data-capture for faster freshness.' },
]

const EDGES: ArchEdge[] = [
  { from: 'user', to: 'lb' }, { from: 'lb', to: 'lbs' }, { from: 'lb', to: 'biz' },
  { from: 'lbs', to: 'geo' }, { from: 'lbs', to: 'cache' }, { from: 'cache', to: 'db' },
  { from: 'biz', to: 'db' }, { from: 'db', to: 'job', async: true }, { from: 'job', to: 'geo', async: true },
]

export default function ProximityServiceChapter() {
  return (
    <>
      <TLDR items={[
        'Find businesses near a point, fast, for a read-heavy workload.',
        'Ordinary indexes are one-dimensional; the trick is mapping 2D location onto something an index can answer.',
        'Geohash turns nearby points into shared string prefixes; always search the cell and its 8 neighbors.',
        'For static businesses the whole index fits in memory, so replicate it instead of sharding.',
        'Moving objects (drivers, friends) need a different, write-heavy design.',
      ]} />

      <p>
        “Find restaurants within 2 km” looks like a database query. But ordinary indexes are one-dimensional, and
        location is two-dimensional.
      </p>
      <p>
        The whole problem comes down to <strong>turning 2D proximity into something an index can answer</strong>: a
        string prefix (geohash), a tree (quadtree), or a{' '}
        <Term def="A path that visits every cell of a 2D grid in one line, so nearby cells mostly get nearby numbers. S2 and H3 build on this idea.">space-filling curve</Term>{' '}
        (S2/H3). Once that is in place, the rest is a read-heavy service that caches easily.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>Agree on the search features, and ask whether the objects move. That one answer changes the design.</p>
      <Requirements
        functional={['Return businesses near (lat, lon) within a radius', 'Filter by category / open now; sort by distance or rating', 'Business owners add or update listings', 'View a business’s details']}
        nonFunctional={['100M DAU (illustrative)', 'Search p99 < 200 ms', 'High availability for reads', 'Listing updates visible within hours (not seconds)', 'Privacy of user location']}
        outOfScope={['Moving objects (drivers, friends) — see extensions', 'Reviews & photos pipeline', 'Turn-by-turn routing']}
      />
      <Callout kind="tip">
        Ask: <strong>do the objects move?</strong> Static businesses allow a precomputed, replicated index. Moving
        drivers need an index that absorbs constant writes (e.g. Redis geo sets keyed by cell, with TTLs). That is a
        different design.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>Estimate search load and the size of the index.</p>
      <EstimationTable
        assumptions={['100M DAU, ~5 searches each per day', '200M businesses', 'Index entry ≈ 24 B (geohash + id + overhead)']}
        rows={[
          { label: 'Search QPS', math: '100M × 5 ÷ 86,400', result: '≈ 5.8K/s' },
          { label: 'Peak', math: '× 3 (meal times)', result: '≈ 17K/s' },
          { label: 'Geo index size', math: '200M × 24 B', result: '≈ 5 GB' },
          { label: 'Business writes', math: 'new + edits', result: 'tens/s at most' },
          { label: 'Business details', math: '200M × ~1 KB', result: '≈ 200 GB (DB + cache)' },
        ]}
      />
      <p>
        A 5 GB index fits in RAM on one machine, so <strong>replicate rather than shard</strong>. Read QPS scales
        linearly with replicas, and writes are rare enough to rebuild the index.
      </p>

      <H2 id="api">3 · API</H2>
      <p>One search call serves users; separate calls let owners manage listings.</p>
      <ApiSpec endpoints={[
        { method: 'GET', path: '/v1/search/nearby', desc: 'Businesses within a radius, paginated.', body: '?lat=&lon=&radius=2000&category=cafe&cursor=', returns: '{ results: [{ id, name, distanceM, rating }], nextCursor }' },
        { method: 'GET', path: '/v1/businesses/{id}', desc: 'Business details (cacheable).', returns: '{ id, name, address, lat, lon, hours, … }' },
        { method: 'POST', path: '/v1/businesses', desc: 'Owner creates a listing; goes live after the next index refresh.', body: '{ name, lat, lon, category, … }', returns: '201 { id }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>A location service answers searches from an in-memory geo index. A separate business service handles the rare listing updates.</p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={380}
        caption="Read path (search) is separate from the rare write path (listings)"
        flows={[
          { name: 'Nearby search', path: ['user', 'lb', 'lbs', 'geo', 'lbs', 'cache'], steps: ['App sends location + radius', 'Routed to any location-service replica', 'Compute covering cells and read their business IDs', 'IDs come back; filter by exact distance and rank', 'Hydrate the top results from the business cache'] },
          { name: 'Update listing', path: ['user', 'lb', 'biz', 'db', 'job', 'geo'], steps: ['Owner submits a change', 'Routed to the business service', 'Written to the primary DB', 'CDC or nightly job picks it up', 'Geo index replicas refreshed'] },
        ]} />

      <H2 id="geohash">5 · Deep dive: geohash</H2>
      <p>
        <Term def="A string that encodes a rectangular cell on the map; longer strings mean smaller cells.">Geohash</Term>{' '}
        repeatedly halves the world, alternating longitude and latitude bits. It encodes the result in{' '}
        <Term def="An alphabet of 32 characters, so each character carries 5 bits.">base32</Term>.
      </p>
      <p>
        <strong>Nearby points usually share a prefix</strong>. So “everything in this cell” becomes{' '}
        <code>WHERE geohash LIKE '9q8yy%'</code> on an ordinary{' '}
        <Term def="The standard sorted index in relational databases; it supports fast range and prefix scans.">B-tree</Term>{' '}
        index. Click the map to explore.
      </p>
      <GeoGeohashExplorer />
      <p>Precision decides the cell size. Pick it from the search radius:</p>
      <CompareTable
        columns={['Cell size (approx. at equator)', 'Good for radius']}
        rows={[
          { label: 'Precision 4', cells: ['39 km × 19.5 km', '~20 km'] },
          { label: 'Precision 5', cells: ['4.9 km × 4.9 km', '~2–5 km'] },
          { label: 'Precision 6', cells: ['1.2 km × 0.61 km', '~0.5–1 km'] },
          { label: 'Precision 7', cells: ['153 m × 153 m', '~100 m'] },
        ]}
        caption="Pick the precision whose cell is at least the search radius, then query the cell plus its 8 neighbors."
      />
      <Callout kind="pitfall">
        Two edge cases to name: (1) <strong>boundary problem</strong>: two points 10 m apart can sit in cells with no
        common prefix (across the equator or the prime meridian), which is why you always query the <em>neighbors</em>{' '}
        too, never just the prefix. (2) <strong>Not enough results</strong>: if the cells return too few businesses,
        widen by dropping one character of precision and search again.
      </Callout>

      <H2 id="quadtree">6 · Deep dive: quadtree & alternatives</H2>
      <p>
        A <Term def="A tree where each node covers a square and splits into four children once it holds too many points.">quadtree</Term>{' '}
        adapts cell size to density: dense cities get small cells, empty regions stay large. Add points to watch it split.
      </p>
      <GeoQuadtreeDemo />
      <p>How the three indexing approaches compare:</p>
      <CompareTable
        columns={['Geohash', 'Quadtree', 'S2 / H3']}
        rows={[
          { label: 'Structure', cells: ['Fixed grid → strings', 'Adaptive tree in memory', 'Hierarchical cells on a sphere (Hilbert curve / hexagons)'] },
          { label: 'Density-aware', cells: ['No (same cell size everywhere)', 'Yes, splits where dense', 'Cover with mixed-level cells'] },
          { label: 'Storage', cells: ['Any DB with a string index, Redis', 'Custom in-process structure', 'Library + 64-bit cell IDs in any KV'] },
          { label: 'Updates', cells: ['Trivial: recompute one string', 'Tree rebuild or locking on writes', 'Trivial: recompute cell ID'] },
          { label: 'Examples', cells: ['Redis GEO, Elasticsearch geohash grid', 'Classic in-memory spatial index', 'S2 (open-sourced by Google), H3 (Uber)'] },
        ]}
      />

      <H2 id="data-model">7 · Data model & scaling</H2>
      <p>The geo index is one table keyed by geohash. The service computes the covering cells, then filters by exact distance.</p>
      <CodeBlock lang="ts" title="geo index + business table" code={`
-- geo index: one row per (cell, business). Precompute several precisions if needed.
CREATE TABLE geo_index (
  geohash     VARCHAR(12),
  business_id BIGINT,
  PRIMARY KEY (geohash, business_id)   -- range scan by prefix
);

-- query: covering cells computed by the service (center + 8 neighbors)
SELECT business_id FROM geo_index
 WHERE geohash LIKE '9q8yyk%' OR geohash LIKE '9q8yym%' /* … 7 more */;
-- then: exact haversine distance filter + ranking in the service`} />
      <ul>
        <li><strong>Replicate the index</strong> to every location-service node, or to a Redis replica set, since it fits in memory.</li>
        <li><strong>Shard business details by ID</strong> if they outgrow one DB; they are always fetched by ID.</li>
        <li><strong>Multi-region</strong>: deploy per region with a local index copy. Users naturally query near themselves, which also helps with data-residency rules.</li>
      </ul>

      <H2 id="staff">8 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Ranking is the real product</strong>: distance alone gives poor results. Blend distance, rating, open-now, and personalization, and fetch more candidates than needed before ranking.</li>
          <li><strong>Moving objects</strong> (ride-hailing): location updates every few seconds from millions of drivers. Keep an in-memory index keyed by cell with TTLs, sharded by region, and never write every ping to a durable DB.</li>
          <li><strong>Dense cities vs empty deserts</strong>: a fixed precision gives too many results downtown and too few in the countryside. Choose precision adaptively, or use an S2 region coverer.</li>
          <li><strong>Privacy</strong>: user coordinates are sensitive. Round them before logging, set strict retention, and never put exact location in URLs that CDNs or analytics tools store.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Why not just put indexes on latitude and longitude columns?"
        senior={<p>Each index narrows only one dimension. The DB finds everything in a latitude band and everything in a longitude band, then intersects them, which is a huge amount of data for a small circle.</p>}
        staff={<>
          <p>Right: a B-tree orders one key, so a 2D box becomes the intersection of two 1D range scans, each potentially millions of rows at city scale. We need a key where 2D closeness becomes 1D closeness. Geohash, S2, and H3 are all space-filling encodings that do exactly that.</p>
          <p>I'd also mention that PostGIS or R-tree indexes solve this inside the DB. At 5 GB they're a perfectly valid choice. I'd move to a precomputed, replicated geohash index only when read QPS or operational simplicity demands it.</p>
        </>}
        followUps={['How do you handle a search radius bigger than the cell?', 'What changes if businesses move?']}
      />
      <InterviewQuestion
        q="A new restaurant opens but doesn't show up in search for a day. The PM wants it instant. What do you do?"
        senior={<p>Update the geo index synchronously when the business is created, in the same request.</p>}
        staff={<>
          <p>First I'd check the actual need. Instant visibility for owners, so they can confirm the listing, can be solved by reading their own writes. General visibility within minutes usually suffices.</p>
          <p>Technically: stream DB changes with CDC into an incremental index updater. Geohash makes that trivial, since one insert per precision applies to every replica. That gives minutes of latency without coupling the write path to the read-replica fleet. Synchronous fan-out to hundreds of index replicas would make every owner edit fragile.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Proximity search turns 2D closeness into 1D keys: geohash, quadtree, S2, H3.',
        'Query the center cell plus its 8 neighbors to handle boundaries, then filter by exact distance.',
        'A static business index is small, so replicate it everywhere and scale reads linearly.',
        'Geohash for simplicity, quadtree for density adaptation, S2/H3 for spherical precision at scale.',
        'Staff depth: ranking, moving objects, adaptive precision, location privacy.',
      ]} />
    </>
  )
}
