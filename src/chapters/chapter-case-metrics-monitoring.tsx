import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements, References, TLDR, Term,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { MetricsAlertEvaluatorDemo } from './demos/metrics-alert-evaluator-demo'
import { MetricsDownsamplingDemo } from './demos/metrics-downsampling-demo'

const NODES: ArchNode[] = [
  { id: 'hosts', label: 'Services', sub: 'OTel SDK', kind: 'service', x: 10, y: 45,
    detail: 'Each process exposes counters, gauges and histograms. Instrumentation libraries such as OpenTelemetry keep naming and labels consistent.' },
  { id: 'sd', label: 'Service discovery', sub: 'k8s / Consul', kind: 'external', x: 26, y: 12,
    detail: 'Collectors learn what to scrape from the orchestrator. The target list changes every deploy.' },
  { id: 'coll', label: 'Collectors', sub: 'scrape / push', kind: 'worker', x: 28, y: 45,
    detail: 'Pull every 10–15 s, or receive pushes from short-lived jobs. Batch, relabel, drop high-cardinality labels, then forward.' },
  { id: 'kafka', label: 'Ingest buffer', sub: 'Kafka', kind: 'queue', x: 46, y: 45,
    detail: 'Absorbs spikes and TSDB maintenance windows, and lets multiple consumers (TSDB, anomaly detection) read the same stream.' },
  { id: 'tsdb', label: 'TSDB cluster', sub: 'sharded', kind: 'db', x: 64, y: 45,
    detail: 'The in-memory head block plus WAL takes recent writes. Older data is flushed to compressed, immutable blocks. Sharded by hash(series), replicated ×2–3.' },
  { id: 'cold', label: 'Object storage', sub: 'downsampled', kind: 'storage', x: 58, y: 85,
    detail: 'Compacted and downsampled blocks for long retention at object-storage prices (the Thanos/Mimir pattern).' },
  { id: 'query', label: 'Query service', sub: 'PromQL-like', kind: 'service', x: 82, y: 22,
    detail: 'Fans out to shards, merges results, caches frequent dashboard queries by (query, step-aligned time range).' },
  { id: 'rules', label: 'Rule evaluator', kind: 'worker', x: 82, y: 60,
    detail: 'Evaluates alert and recording rules every 30–60 s. Recording rules precompute expensive aggregates.' },
  { id: 'am', label: 'Alert manager', sub: 'dedupe · route', kind: 'service', x: 86, y: 90,
    detail: 'Groups related alerts into one page, dedupes across HA evaluators, applies silences and inhibitions, and routes to on-call.' },
  { id: 'dash', label: 'Dashboards', kind: 'client', x: 90, y: 10 },
]

const EDGES: ArchEdge[] = [
  { from: 'sd', to: 'coll' }, { from: 'coll', to: 'hosts', label: 'scrape' }, { from: 'coll', to: 'kafka', async: true },
  { from: 'kafka', to: 'tsdb', async: true }, { from: 'tsdb', to: 'cold', async: true, label: 'compact' },
  { from: 'query', to: 'tsdb' }, { from: 'query', to: 'cold' }, { from: 'rules', to: 'query' }, { from: 'rules', to: 'am' },
  { from: 'dash', to: 'query' },
]

const REFS: Reference[] = [
  { title: 'Gorilla: A Fast, Scalable, In-Memory Time Series Database', source: 'T. Pelkonen et al., VLDB', year: 2015, url: 'https://www.vldb.org/pvldb/vol8/p1816-teller.pdf', kind: 'paper', note: 'delta-of-delta + XOR, ~1.37 bytes/sample' },
  { title: 'Storage (head block, WAL, 2-hour blocks)', source: 'Prometheus documentation', url: 'https://prometheus.io/docs/prometheus/latest/storage/', kind: 'docs' },
  { title: 'Data model (metric names and labels)', source: 'Prometheus documentation', url: 'https://prometheus.io/docs/concepts/data_model/', kind: 'docs', note: 'series = name + label set' },
  { title: 'Alertmanager', source: 'Prometheus documentation', url: 'https://prometheus.io/docs/alerting/latest/alertmanager/', kind: 'docs', note: 'grouping, inhibition, routing' },
  { title: 'Alerting on SLOs', source: 'Google, The Site Reliability Workbook', year: 2018, url: 'https://sre.google/workbook/alerting-on-slos/', kind: 'book', note: 'multi-window burn-rate alerts' },
  { title: 'Monitoring Distributed Systems', source: 'Google, Site Reliability Engineering', year: 2016, url: 'https://sre.google/sre-book/monitoring-distributed-systems/', kind: 'book', note: 'symptoms vs causes' },
  { title: 'System Design Interview – An Insider’s Guide, Volume 2', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'metrics monitoring and alerting prompt' },
]

export default function MetricsMonitoringChapter() {
  return (
    <>
      <TLDR items={[
        'Core problem: ingest about a million samples per second and keep two years of history affordably.',
        'Key decision: a sharded time-series database with compressed blocks and downsampled cold tiers.',
        'The hard part: cardinality. One careless label can multiply the number of series a million times.',
        'Staff insight: page on SLO burn rate, not on causes, and monitor the monitoring from outside.',
      ]} />
      <p>
        A metrics platform is a write-heavy{' '}
        <Term def="Time-series database: storage optimised for timestamped numeric samples, queried by time range.">TSDB</Term>{' '}
        with an alerting brain attached. The traps are not QPS.
      </p>
      <p>
        They are <strong><Term def="The number of distinct series, i.e. unique combinations of metric name and label values.">cardinality</Term></strong>{' '}
        (one careless label multiplies storage), <strong>retention economics</strong>, and <strong>alert
        quality</strong>. A monitoring system that pages people for noise is worse than none.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>First, fix the ingest rate, query latency and retention. Those three numbers size everything else.</p>
      <Requirements
        functional={['Collect metrics from all services and hosts', 'Query and graph over arbitrary ranges', 'Alert rules with routing to on-call', 'Retain data for about 2 years at reduced resolution']}
        nonFunctional={['Ingest ~1M samples/s, sustained', 'Recent-data queries < 1 s', 'The monitoring system must outlive what it monitors', 'Cost scales sub-linearly with retention']}
        outOfScope={['Logs and traces (separate pipelines)', 'Business analytics']}
      />

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>Next, turn series counts into bytes. Compression turns out to be the biggest lever.</p>
      <EstimationTable
        assumptions={['10M active series (illustrative large company)', '10-second resolution', 'Compressed ≈ 1.37 B/sample, as reported for Facebook’s Gorilla encoding']}
        rows={[
          { label: 'Ingest rate', math: '10M / 10 s', result: '1M samples/s' },
          { label: 'Samples/day', math: '1M × 86,400', result: '86.4B' },
          { label: 'Raw, uncompressed', math: '86.4B × 16 B (ts + float)', result: '≈ 1.4 TB/day' },
          { label: 'Compressed', math: '86.4B × 1.37 B', result: '≈ 118 GB/day' },
          { label: 'Raw 15-day hot tier', math: '118 GB × 15 × RF 2', result: '≈ 3.5 TB' },
        ]}
      />

      <H2 id="api">3 · API</H2>
      <p>Three calls cover the system: write samples, query a range, and manage alert rules.</p>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/api/v1/write', desc: 'Batched push (remote-write style), snappy-compressed protobuf.', body: '[{ labels, samples: [[ts, value]] }]' },
        { method: 'GET', path: '/api/v1/query_range', desc: 'Range query evaluated on a step grid.', body: '?query=rate(http_requests_total{svc="api"}[5m])&start&end&step=30s' },
        { method: 'POST', path: '/api/v1/rules', desc: 'Alert and recording rules, versioned in git in practice.' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>Now connect the pieces. Samples flow through a buffer into sharded storage; dashboards and alerts share one query layer.</p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Ingest is buffered and sharded by series. Queries and alerts read through one query layer."
        flows={[
          { name: 'Ingest', path: ['sd', 'coll', 'kafka', 'tsdb', 'cold'], steps: ['Collectors learn their scrape targets from service discovery', 'Scrape, relabel, and batch samples into Kafka', 'TSDB consumes: append to head block + WAL, compact every 2 h', 'Downsampled blocks are shipped to object storage'] },
          { name: 'Dashboard', path: ['dash', 'query', 'tsdb'], steps: ['Grafana issues a range query', 'Fan out to shards holding the matching series, then merge'] },
          { name: 'Alert', path: ['rules', 'query', 'tsdb', 'query', 'rules', 'am'], steps: ['Every 30 s the evaluator runs its rules as queries', 'Query service fans out to the TSDB shards', 'Matching series come back', 'Aggregated result returns to the evaluator', 'Firing alerts → dedupe, group, route to on-call'] },
        ]} />

      <H2 id="data-model">5 · Deep dive: data model & cardinality</H2>
      <p>
        Here we decide what a “series” is, because storage cost grows with the number of series. A series is one
        metric name plus one set of label values.
      </p>
      <CodeBlock lang="ts" title="a series = metric name + label set" code={`
http_requests_total{service="checkout", method="POST", status="500", region="eu-west-1"}
// series count = product of distinct label values in use:
//   20 services × 5 methods × 10 statuses × 6 regions = 6,000 series  ✅
// add  user_id="…"  with 1M users                     = 6 BILLION     ❌`} />
      <Callout kind="pitfall">
        Unbounded label values (user IDs, request IDs, raw URLs) are the number-one way to take down a metrics
        cluster. Enforce <strong>per-tenant series limits</strong> at ingest and drop or rewrite offending labels,
        because one team's bad deploy shouldn't page everyone else.
      </Callout>
      <p>The other data-model choice is how samples arrive: collectors pull them, or services push them.</p>
      <CompareTable
        columns={['Pull (scrape)', 'Push']}
        rows={[
          { label: 'Health signal', cells: ['A failed scrape = the target is down', 'Silence is ambiguous'] },
          { label: 'Short-lived jobs', cells: ['Missed; needs a push gateway', 'Natural fit'] },
          { label: 'Network', cells: ['Collector must reach the targets', 'Works through NAT and firewalls'] },
          { label: 'Backpressure', cells: ['Collector controls its rate', 'Must rate-limit clients'] },
          { label: 'Typical', cells: ['Prometheus in Kubernetes', 'OTLP agents, serverless, IoT'] },
        ]}
      />

      <H2 id="storage">6 · Deep dive: storage engine & downsampling</H2>
      <p>
        Next, how to store samples cheaply. Time-series data is append-only, arrives almost in order, and is queried
        by recent time range. A TSDB exploits all three:
      </p>
      <ul>
        <li>An <strong>in-memory head block</strong> with a{' '}<Term def="Write-ahead log: an append-only file written before applying changes, so they survive a crash.">WAL</Term>{' '}for durability.</li>
        <li>Periodic flushes to immutable compressed blocks.</li>
        <li><strong><Term def="Store the change in the gap between timestamps, not the timestamp itself. Regular intervals compress to almost nothing.">Delta-of-delta</Term></strong>{' '}encoding for timestamps. Regular intervals compress to about a bit each.</li>
        <li><strong>XOR</strong> encoding for float values that change slowly.</li>
      </ul>
      <p>Older data can be <Term def="Replace many fine-grained samples with one summary per coarser bucket, e.g. per hour.">downsampled</Term>. See what survives in the demo.</p>
      <MetricsDownsamplingDemo />
      <Callout kind="warn">
        Downsampling with only <code>avg</code> erases the spikes you care about. Store <strong>min / max / sum /
        count</strong> per bucket so the query layer can reconstruct avg, max and rate correctly at any resolution.
      </Callout>

      <H2 id="alerting">7 · Deep dive: alerting that people trust</H2>
      <p>
        Finally, decide what wakes a human up. Alert on <strong>symptoms users feel</strong> (error rate, latency
        SLOs), not on causes (CPU at 80%). Compare three rule styles in the demo.
      </p>
      <MetricsAlertEvaluatorDemo />
      <p>
        Multi-window{' '}
        <Term def="How fast the error budget is being used up, relative to the rate that would spend exactly all of it by the end of the SLO window.">burn-rate</Term>{' '}
        rules, as popularised by Google's SRE workbook, page quickly on fast budget burn and stay quiet on noise.
        Slower burns go to tickets, not pages.
      </p>
      <p>Grouping and dedup in the alert manager turn “200 pods are failing” into one page.</p>

      <H2 id="staff">8 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Meta-monitoring</strong>: the monitoring stack runs in a separate failure domain, with a dead-man's-switch alert (an always-firing heartbeat) that pages if it <em>stops</em> arriving.</li>
          <li><strong>Cardinality governance</strong> is a platform product: per-team budgets, usage dashboards, and automatic label dropping with notifications.</li>
          <li><strong>Cost model</strong>: charge back by active series. The storage math shows retention tiers, not compute, dominate the bill.</li>
          <li><strong>Buy vs build</strong>: most companies should run Prometheus + Thanos/Mimir or a vendor. Build only when scale or cost forces it, and say so.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Storage costs doubled overnight. What happened and how do you prevent it?"
        senior={<p>Probably a cardinality explosion: someone added a label with many unique values. Find the metric with the most series, remove the label, and add limits.</p>}
        staff={<>
          <p>Almost certainly <strong>cardinality</strong>. I'd confirm with top-N series-count by metric and by label from the TSDB index stats, correlated with deploys.</p>
          <p>Prevention is a system, not a postmortem action item: per-tenant active-series limits enforced at ingest, relabel rules that drop known-bad labels (IDs, raw paths), a cardinality dashboard per team, and a CI lint on instrumentation changes.</p>
          <p>For truly per-user questions, point teams to logs or traces with exemplars, the right tools for high cardinality.</p>
        </>}
        followUps={['Where exactly do you enforce limits?', 'What happens to data over the limit?', 'How would you bill teams?']}
      />
      <InterviewQuestion
        q="On-call complains about alert fatigue. How would you redesign alerting?"
        senior={<p>Add for-durations to reduce flapping, raise thresholds, and group related alerts together.</p>}
        staff={<>
          <p>Re-anchor alerts on <strong>SLOs</strong>: page only when a user-facing SLO's error budget is burning fast (multi-window burn rate), and turn cause-based alerts into dashboard or ticket signals.</p>
          <p>Measure the result: pages per on-call shift, share of pages that were actionable, and time to detect for real incidents. Tune against those numbers.</p>
          <p>Organisationally, every paging rule needs an owner and a runbook link, and a periodic review deletes rules that never led to action.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'The hard problems are cardinality, retention cost and alert quality, not raw QPS.',
        'Head block + WAL + compressed immutable blocks; delta-of-delta and XOR encoding.',
        'Downsample into min/max/sum/count tiers and ship old blocks to object storage.',
        'Page on SLO burn rate across two windows; group, dedupe and route in an alert manager.',
        'Monitor the monitoring system from a separate failure domain.',
      ]} />
    </>
  )
}
