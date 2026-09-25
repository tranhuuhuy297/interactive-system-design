import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, FlowDiagram, H2,
  InterviewQuestion, KeyTakeaways, MentalModel, References, Requirements, SideBySide, StatRow, Tabs, Term,
  TLDR,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { Copy, DatabaseZap, RotateCcw } from 'lucide-react'
import { AdclickWindowingDemo } from './demos/adclick-windowing-demo'

const NODES: ArchNode[] = [
  { id: 'ads', label: 'Ad servers', sub: 'redirect', kind: 'service', x: 10, y: 45,
    detail: 'Log each click with a unique click_id, ad_id, event timestamp, user and geo attributes. Log first, then redirect. The log is the product.' },
  { id: 'raw', label: 'Raw clicks', sub: 'Kafka · ad_id', kind: 'queue', x: 27, y: 45,
    detail: 'The durable, replayable source of truth. Keep days or weeks of retention so you can reprocess after a bug.' },
  { id: 'agg', label: 'Aggregator', sub: 'Flink', kind: 'worker', x: 44, y: 22,
    detail: 'Dedupes by click_id, assigns event-time windows, aggregates per (ad, minute) and top-N. Checkpoints state for exactly-once processing.' },
  { id: 'aggq', label: 'Aggregates', sub: 'Kafka', kind: 'queue', x: 62, y: 22 },
  { id: 'olap', label: 'OLAP store', sub: 'ClickHouse / Pinot', kind: 'db', x: 80, y: 22,
    detail: 'Columnar and fast for group-by and filter queries over time. Writes are idempotent upserts keyed by (ad_id, window_start).' },
  { id: 'lake', label: 'Data lake', sub: 'object storage', kind: 'storage', x: 46, y: 78,
    detail: 'Raw clicks archived as Parquet. The input for batch recounts, backfills and ML.' },
  { id: 'batch', label: 'Batch recount', sub: 'Spark, nightly', kind: 'worker', x: 66, y: 78,
    detail: 'Recomputes yesterday from raw data with every late event included. Its numbers are what advertisers are billed on.' },
  { id: 'query', label: 'Query service', kind: 'service', x: 80, y: 55 },
  { id: 'dash', label: 'Dashboards', kind: 'client', x: 90, y: 85 },
]

const EDGES: ArchEdge[] = [
  { from: 'ads', to: 'raw', async: true }, { from: 'raw', to: 'agg', async: true }, { from: 'agg', to: 'aggq', async: true },
  { from: 'aggq', to: 'olap', async: true }, { from: 'raw', to: 'lake', async: true }, { from: 'lake', to: 'batch' },
  { from: 'batch', to: 'olap', label: 'overwrite' }, { from: 'olap', to: 'query' }, { from: 'query', to: 'dash' },
]

const REFS: Reference[] = [
  { title: 'The Dataflow Model', source: 'T. Akidau et al., VLDB', year: 2015, url: 'https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf', kind: 'paper', note: 'event time, windows, watermarks, triggers' },
  { title: 'Streaming 101: The world beyond batch', source: 'T. Akidau, O’Reilly Radar', year: 2015, url: 'https://www.oreilly.com/radar/the-world-beyond-batch-streaming-101/', kind: 'blog', note: 'event time vs processing time' },
  { title: 'Timely stream processing (event time & watermarks)', source: 'Apache Flink documentation', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/', kind: 'docs' },
  { title: 'Checkpointing', source: 'Apache Flink documentation', url: 'https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/fault-tolerance/checkpointing/', kind: 'docs', note: 'consistent offsets + state after restore' },
  { title: 'How to beat the CAP theorem', source: 'N. Marz', year: 2011, url: 'http://nathanmarz.com/blog/how-to-beat-the-cap-theorem.html', kind: 'blog', note: 'origin of the lambda architecture' },
  { title: 'Questioning the Lambda Architecture', source: 'J. Kreps, O’Reilly Radar', year: 2014, url: 'https://www.oreilly.com/radar/questioning-the-lambda-architecture/', kind: 'blog', note: 'the kappa alternative' },
  { title: 'System Design Interview – An Insider’s Guide, Volume 2', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'ad click event aggregation prompt' },
]

export default function AdClickAggregationChapter() {
  return (
    <>
      <TLDR items={[
        'Core problem: count about a billion ad clicks a day, fresh within a minute, and bill advertisers from them.',
        'Key decision: a stream job windows clicks by when they happened, not when they arrived.',
        'The hard part: late clicks, duplicates and crash replays must never change a billed number.',
        'Staff insight: fast numbers for dashboards, exact batch recounts for invoices, and label which is which.',
      ]} />
      <MentalModel id="ad-click" />
      <p>
        Counting clicks sounds trivial until the counts become <strong>invoices</strong>. This prompt is a streaming
        systems interview in disguise.
      </p>
      <p>
        Expect questions on event time vs processing time, late data, exactly-once state and hot keys. You also need
        a story for how fast numbers and correct numbers live side by side.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>First, separate what dashboards need from what billing needs. They have very different accuracy bars.</p>
      <Requirements
        functional={['Click count per ad over the last M minutes', 'Top-N most clicked ads per minute', 'Filter by attributes (country, device)', 'Billing-grade daily totals']}
        nonFunctional={['Dashboards fresh within ~1 minute', 'Billing numbers correct (dedupe, no loss)', 'Survive processor crashes without double counting', 'Reprocess history after a bug']}
        outOfScope={['Ad serving and auction', 'Click-fraud ML (hook provided)']}
      />
      <Callout kind="tip">
        Ask whether dashboard numbers and billed numbers must be <strong>identical</strong>. Almost always the answer
        is “eventually”. That one answer licenses a fast approximate path plus a slow exact path.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>Next, size the ingest rate and storage. This decides how many partitions and workers we need.</p>
      <EstimationTable
        assumptions={['1B clicks/day (illustrative)', 'Peak 5× average', '~100 B per raw click event', '2M active ads']}
        rows={[
          { label: 'Average ingest', math: '1B / 86,400 s', result: '≈ 11.6K/s' },
          { label: 'Peak ingest', math: '11.6K × 5', result: '≈ 58K/s' },
          { label: 'Raw volume', math: '1B × 100 B', result: '≈ 100 GB/day' },
          { label: 'Minute aggregates', math: '2M ads × 1,440 min (upper bound)', result: '≤ 2.9B rows/day' },
        ]}
      />
      <StatRow caption="Kafka with a few dozen partitions and a modest Flink cluster covers this ingest rate"
        stats={[
          { value: '≈ 58K/s', label: 'peak click ingest' },
          { value: '≈ 100 GB', label: 'raw clicks per day' },
          { value: '≤ 2.9B', label: 'minute rows per day', note: 'upper bound; only a fraction of ads get clicks each minute' },
        ]} />

      <H2 id="api">3 · API</H2>
      <p>Two read endpoints cover the product: a time series per ad and a top-N list.</p>
      <ApiSpec endpoints={[
        { method: 'GET', path: '/v1/ads/{adId}/clicks', desc: 'Time series of counts.', body: '?from&to&granularity=1m&country=', returns: '[{ windowStart, count }]' },
        { method: 'GET', path: '/v1/ads/top', desc: 'Most-clicked ads.', body: '?window=1m&limit=100', returns: '[{ adId, count }]' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>Now connect the pieces. Every click lands in one durable log, which feeds two paths: a fast stream and a slow batch.</p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={400}
        caption="A fast streaming path for dashboards and a batch path that produces the billed numbers"
        flows={[
          { name: 'Streaming', path: ['ads', 'raw', 'agg', 'aggq', 'olap', 'query', 'dash'], steps: ['Log the click with click_id + event time', 'Kafka keyed by ad_id keeps each ad in one partition', 'Dedupe + event-time window per (ad, minute)', 'Emit when the watermark passes window end', 'Idempotent upsert on (ad_id, window_start)', 'Dashboard reads are fresh within ~1 min'] },
          { name: 'Batch correction', path: ['raw', 'lake', 'batch', 'olap'], steps: ['Archive raw clicks to Parquet', 'Nightly job recounts including all late clicks', 'Overwrite yesterday’s aggregates: billing uses these'] },
        ]} />

      <H2 id="windows">5 · Deep dive: event time, windows & watermarks</H2>
      <p>
        Here we decide which minute a click belongs to. A click that happened at 10:00:59 but arrived at 10:01:07
        belongs to the <strong>10:00 minute</strong>. That is its{' '}
        <Term def="The timestamp when the click actually happened, recorded by the ad server.">event time</Term>.
      </p>
      <p>
        Windowing by arrival time (<Term def="The time the stream processor happens to see the event.">processing time</Term>)
        is simpler. But it produces numbers that change with network weather.
      </p>
      <p>
        A <strong><Term def="A marker in the stream saying: no more events older than time T are expected.">watermark</Term></strong>{' '}
        is the stream's claim that no more events older than T are expected. Window results are emitted when the
        watermark passes the window end. Drag the watermark in the demo to see the trade-off.
      </p>
      <AdclickWindowingDemo />
      <CompareTable
        columns={['Tumbling', 'Sliding (hopping)', 'Session']}
        rows={[
          { label: 'Shape', cells: ['Fixed, non-overlapping', 'Fixed size, overlapping hops', 'Closes after a gap of inactivity'] },
          { label: 'Use here', cells: ['Clicks per ad per minute', 'Top-N over the last 5 min, updated every minute', 'User engagement bursts'] },
          { label: 'State cost', cells: ['1 window per key', 'size/slide windows per event', 'Unbounded until the gap'] },
        ]}
      />

      <H2 id="exactly-once">6 · Deep dive: exactly-once counts</H2>
      <p>
        Billing cannot tolerate a click counted twice. Double counting comes from three places, and each needs its own
        fix. Crash recovery relies on Flink{' '}
        <Term def="A periodic consistent snapshot of the job's state and input positions, used to recover after a crash.">checkpoints</Term>;
        the sink relies on an{' '}
        <Term def="A write that inserts or overwrites a row by key, so repeating it leaves the same result.">idempotent upsert</Term>.
      </p>
      <SideBySide caption="Exactly-once effect = dedupe + checkpointed state + idempotent sink" panels={[
        { title: 'Duplicate clicks', icon: Copy, points: ['- Client retries, redirect replays', '+ Dedupe on click_id in keyed state', '+ TTL of a few minutes, longer than the watermark lag'], verdict: 'Fix: dedupe on click_id' },
        { title: 'Crash and replay', icon: RotateCcw, points: ['- Processor restarts mid-window', '+ Checkpoints store Kafka offsets and window state together', '+ After a restore, both rewind consistently'], verdict: 'Fix: checkpointed state' },
        { title: 'Sink duplicates', icon: DatabaseZap, points: ['- Results emitted again after replay', '+ Transactional sink (two-phase commit on checkpoint)', '+ Or upsert keyed by (ad_id, window_start)'], verdict: 'Fix: re-emit overwrites, never adds' },
      ]} />
      <CodeBlock lang="ts" title="aggregate row (idempotent by construction)" code={`
// PRIMARY KEY (ad_id, window_start, dims_hash)
type AdMinute = {
  adId: string
  windowStart: number     // epoch minute (event time)
  dimsHash: string        // country|device combo, or '*' for total
  clicks: number          // overwritten, never incremented, on re-emit
  source: 'stream' | 'batch'
}`} />

      <H2 id="hot-keys">7 · Deep dive: hot ads & the two-path architecture</H2>
      <p>
        Two last decisions: how to spread one very popular ad, and how to correct history. A Super Bowl ad can take a
        big share of all clicks. Keying by <code>ad_id</code> pins it to one partition and one task.
      </p>
      <p>
        Fix: <strong><Term def="Append a small random suffix to a hot key so its events spread over several workers.">salt the key</Term></strong>{' '}
        (<code>ad_id#0..7</code>) and pre-aggregate in parallel. Then merge the 8 partial counts in a second, much
        smaller stage.
      </p>
      <p>For correcting history, there are two classic architectures:</p>
      <Tabs items={[
        { label: 'Lambda', content: <>
          <FlowDiagram steps={[{ label: 'Raw log', sub: 'Kafka + lake' }, { label: 'Speed layer', sub: 'stream, approximate' }, { label: 'Batch layer', sub: 'exact recount' }, { label: 'Serving', sub: 'batch overwrites stream' }]} />
          <p>Two codebases compute “the same” numbers. You get correctness from batch and freshness from streaming, but also logic drift between two implementations.</p>
        </> },
        { label: 'Kappa', content: <>
          <FlowDiagram steps={[{ label: 'Raw log', sub: 'long retention' }, { label: 'One stream job', sub: 'event-time, exactly-once' }, { label: 'Serving', sub: 'idempotent upserts' }, { label: 'Reprocess', sub: 'replay log into v2 job' }]} />
          <p>One codebase. Corrections come from replaying the log through a new version of the job. That needs long log retention and a stream engine you trust with state.</p>
        </> },
      ]} />

      <H2 id="staff">8 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Name the contract</strong>: dashboards are “preliminary, ±x%”, invoices come from the closed-day batch. Put it in the API response (<code>source: stream|batch</code>) so no team bills from preliminary numbers.</li>
          <li><strong>Reconciliation as a metric</strong>: alert when stream and batch totals diverge by more than a threshold. Divergence is an early bug detector for the stream job.</li>
          <li><strong>Replay is a feature</strong>: size Kafka retention and the lake to support a backfill after the inevitable dedupe bug, and practise it.</li>
          <li><strong>Privacy</strong>: raw clicks contain user identifiers. Put retention limits and deletion propagation (GDPR) on the lake, not just on the OLAP store.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How do you handle clicks that arrive minutes late?"
        senior={<p>Use event-time windows with a watermark that allows some lateness. Events later than that are dropped or sent to a side output.</p>}
        staff={<>
          <p>Make it a trade-off with a number. The watermark lag is how long every dashboard waits, so I'd pick it from the observed delay distribution (say, covering p99 at ~10 s). Events later than that go to a <strong>side output</strong>, never silently dropped.</p>
          <p>For billing, the nightly batch recount over the raw log includes everything and overwrites the day. I'd also measure the late-event rate as an SLI, because a spike usually means a broken client SDK or a region outage, not normal jitter.</p>
        </>}
        followUps={['What if a client clock is wrong by an hour?', 'How much state does dedup need?', 'How would you backfill after a bug?']}
      />
      <InterviewQuestion
        q="Your stream job crashes and restarts. Why don't counts double?"
        senior={<p>Flink checkpoints store the Kafka offsets and state together, so after restore it replays from the checkpointed offsets with consistent state.</p>}
        staff={<>
          <p>That covers the <em>internal</em> state. The sink is where people get burned: results emitted after the last checkpoint get emitted again on replay.</p>
          <p>Either use a transactional sink that commits on checkpoint completion (adds latency equal to the checkpoint interval), or make writes <strong>idempotent upserts keyed by window</strong>. I prefer the latter because it's simpler, and it also makes batch overwrites and backfills safe.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Window by event time; watermarks trade freshness for completeness.',
        'Late events go to a side output, and the batch recount produces billable truth.',
        'Exactly-once effect = dedupe on click_id + checkpointed state + idempotent sink.',
        'Salt hot keys and merge partial aggregates in a second stage.',
        'Lambda vs kappa is about how you correct history. Choose deliberately and label numbers by source.',
      ]} />
    </>
  )
}
