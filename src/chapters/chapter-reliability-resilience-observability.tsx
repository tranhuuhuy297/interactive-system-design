import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, Tabs,
} from '../components/ui'
import { ReliabilityAvailabilityComposerDemo } from './demos/reliability-availability-composer-demo'
import { ReliabilityCircuitBreakerDemo } from './demos/reliability-circuit-breaker-demo'
import { ReliabilityRetryStormDemo } from './demos/reliability-retry-storm-demo'

export default function ReliabilityChapter() {
  return (
    <>
      <p>
        Every design eventually meets partial failure: a slow dependency, a bad deploy, a zone going dark. Reliability
        engineering is the discipline of <strong>deciding how reliable to be</strong>, <strong>limiting the
        blast radius</strong> when things break, and <strong>seeing what is happening</strong> fast enough to act.
        In interviews, this is where you show you have been on call.
      </p>

      <H2 id="slos">SLIs, SLOs, SLAs and error budgets</H2>
      <CompareTable
        columns={['What it is', 'Example']}
        rows={[
          { label: 'SLI', cells: ['A measured ratio of good events to total events', 'Share of checkout requests returning 2xx within 300 ms'] },
          { label: 'SLO', cells: ['An internal target for an SLI over a window', '99.9% of checkout requests are good over 28 days'] },
          { label: 'SLA', cells: ['A contract with consequences, looser than the SLO', '99.5% monthly, or service credits'] },
          { label: 'Error budget', cells: ['1 − SLO, the failure you are allowed', '0.1% ≈ 40 minutes of full outage per 28 days'] },
        ]}
      />
      <p>
        The error budget turns reliability into a <strong>shared decision</strong>. While budget remains, ship fast.
        When it is spent, freeze risky launches and invest in reliability. Alert on <strong>burn rate</strong> (how fast the budget
        is being consumed), not on raw error spikes. A common pattern pages when about 2% of a 30-day budget burns in an hour
        (a burn rate of roughly 14×), and opens a ticket for slow burns.
      </p>
      <Callout kind="tip">
        Measure SLIs as close to the user as you can: at the load balancer or with client telemetry, not from server CPU.
        A service can be “up” while every request times out at the edge.
      </Callout>

      <H2 id="availability-math">Availability math: dependencies multiply</H2>
      <ReliabilityAvailabilityComposerDemo />
      <ul>
        <li><strong>Serial</strong> hard dependencies multiply: five 99.9% services in a chain give ≈ 99.5%. Your SLO can't exceed the product of your critical path.</li>
        <li><strong>Redundancy</strong> helps only if failures are independent. Three replicas in one zone, behind one config system, deployed at the same time, are not three independent 99.9%s.</li>
        <li>The biggest lever is often <strong>removing a hard dependency</strong>: make it soft (degrade without it), cache its answers, or move it off the request path.</li>
      </ul>

      <H2 id="timeouts-retries">Timeouts, retries and backoff</H2>
      <p>
        Every network call needs a <strong>timeout</strong>, derived from the caller's own latency budget rather than a default of 30 s.
        Retries recover from transient faults but <strong>multiply load</strong> during real ones. Five layers each retrying
        three times means 3⁵ = 243 attempts at the bottom of the stack.
      </p>
      <ReliabilityRetryStormDemo />
      <CodeBlock lang="ts" title="retry with capped exponential backoff + full jitter" code={`
async function withRetry<T>(fn: () => Promise<T>, { attempts = 3, baseMs = 100, capMs = 2_000 } = {}) {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i + 1 >= attempts || !isRetryable(err)) throw err // 4xx, validation: never retry
      const ceiling = Math.min(capMs, baseMs * 2 ** i)
      await sleep(Math.random() * ceiling)                     // full jitter de-synchronizes clients
    }
  }
}`} />
      <ul>
        <li>Retry only <strong>idempotent</strong> operations, or make them idempotent with a key.</li>
        <li>Retry at <strong>one layer</strong>, usually the one closest to the user. Use a <strong>retry budget</strong> (for example, retries ≤ 10% of requests) so retries cannot turn into a storm.</li>
        <li>Honor <code>Retry-After</code>, and treat 429/503 as a signal to back off, not to try harder.</li>
      </ul>

      <H2 id="circuit-breakers">Circuit breakers, bulkheads and load shedding</H2>
      <ReliabilityCircuitBreakerDemo />
      <CompareTable
        columns={['Protects against', 'Mechanism']}
        rows={[
          { label: 'Circuit breaker', cells: ['Wasting time and threads on a dependency that is down', 'Fail fast while open, then probe with trial calls'] },
          { label: 'Bulkhead', cells: ['One slow dependency exhausting a shared pool', 'Separate thread or connection pools per dependency'] },
          { label: 'Load shedding', cells: ['Overload turning into collapse', 'Reject early (503) by priority when queues or latency exceed limits'] },
          { label: 'Graceful degradation', cells: ['Total failure when an optional feature breaks', 'Serve stale or cached data, or hide the widget'] },
          { label: 'Deadline propagation', cells: ['Work that nobody is waiting for any more', 'Pass the remaining time budget downstream and drop expired work'] },
        ]}
      />
      <Callout kind="info">
        Queues are where latency hides. A server with a 10K-deep request queue and a 1 s client timeout processes
        requests that have already been abandoned. Bound queues and shed at admission. LIFO or CoDel-style
        policies keep the requests that can still succeed.
      </Callout>

      <H2 id="observability">Observability: metrics, logs, traces</H2>
      <Tabs items={[
        { label: 'Signals', content: <CompareTable
          columns={['Best at', 'Cost / pitfall']}
          rows={[
            { label: 'Metrics', cells: ['Cheap aggregates, alerting, dashboards', 'High-cardinality labels such as user_id explode storage'] },
            { label: 'Logs', cells: ['Rich detail for one event', 'Volume and cost. Make them structured (JSON) and sample debug logs'] },
            { label: 'Traces', cells: ['Latency breakdown across services', 'Needs context propagation everywhere, and sampling'] },
          ]} /> },
        { label: 'RED & USE', content: <>
          <p><strong>RED</strong> for request-driven services: <em>Rate</em>, <em>Errors</em>, <em>Duration</em> (as percentiles, never averages).</p>
          <p><strong>USE</strong> for resources: <em>Utilization</em>, <em>Saturation</em> (queue length), <em>Errors</em>. Saturation is the early warning that utilization hides.</p>
        </> },
        { label: 'OpenTelemetry', content: <CodeBlock lang="ts" title="one span per unit of work" code={`
const tracer = trace.getTracer('checkout')

await tracer.startActiveSpan('charge-card', async (span) => {
  span.setAttributes({ 'order.id': orderId, 'payment.provider': 'stripe' })
  try {
    await payments.charge(orderId)            // trace context propagates via headers
  } catch (e) {
    span.recordException(e as Error)
    span.setStatus({ code: SpanStatusCode.ERROR })
    throw e
  } finally {
    span.end()
  }
})`} /> },
      ]} />

      <H2 id="change-safety">Most outages are changes</H2>
      <p>Most incidents are triggered by a deploy or config change rather than hardware, so reliability is largely about <strong>shipping safely</strong>.</p>
      <FlowDiagram steps={[
        { label: 'Feature flag', sub: 'decouple deploy from release' },
        { label: 'Canary', sub: '1% → 10%, compare SLIs' },
        { label: 'Progressive', sub: 'zone by zone, region by region' },
        { label: 'Auto-rollback', sub: 'on SLO burn' },
      ]} />
      <ul>
        <li><strong>Blue-green</strong> gives instant rollback at double the capacity cost. A <strong>canary</strong> limits the blast radius and needs good automated comparison.</li>
        <li>Treat <strong>config as code</strong>: review it, roll it out in stages, and make it reversible. Several well-known large-scale outages were global config pushes.</li>
        <li><strong>Chaos engineering</strong>: inject failures (kill instances, add latency, black-hole a dependency) in controlled experiments to confirm the fallbacks actually work.</li>
      </ul>

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Reliability is a product decision.</strong> Ask what each extra nine costs and who pays. 99.99% for an internal dashboard wastes a team.</li>
          <li><strong>Design for metastable failures.</strong> Name the positive feedback loops in your design (retries, cache-miss storms, reconnect storms) and the mechanism that breaks each one.</li>
          <li><strong>Cell-based architecture.</strong> Shard the whole stack into independent cells, so a bad deploy or poison tenant takes out 1/N of customers instead of all of them.</li>
          <li><strong>Operational readiness</strong> is part of the design: runbooks, dashboards per SLO, on-call ownership and game days, before launch.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Your service depends on a recommendations API that sometimes gets slow. How do you protect your checkout page?"
        senior={<p>Set an aggressive timeout on the recommendations call, wrap it in a circuit breaker, and fall back to cached or default recommendations when it is open. Use a separate connection pool so it can't exhaust the checkout threads.</p>}
        staff={<>
          <p>First, reclassify it: recommendations are a <strong>soft dependency</strong> of checkout, so they must never block it. Concretely:</p>
          <ul>
            <li>Fetch them async or in parallel, with a timeout taken from the page's latency budget (e.g. 150 ms).</li>
            <li>Isolate them with a bulkhead, add a circuit breaker, and fall back to a precomputed popular-items list.</li>
            <li>Keep retries at zero on this path.</li>
            <li>Make “degraded mode served” an SLI, so we see how often we fall back, and agree with the recommendations team on an SLO so the fallback doesn't hide a chronic problem.</li>
          </ul>
        </>}
        followUps={['How do you pick the timeout value?', 'How would you test that the fallback works?', 'What if checkout itself is overloaded?']}
      />
      <InterviewQuestion
        q="Leadership wants 99.99% availability for our API. What do you say?"
        senior={<p>99.99% is about 52 minutes of downtime a year. We'd need multi-AZ redundancy, automated failover, canary deploys and fast rollback.</p>}
        staff={<>
          <p>I'd start with what users actually need, and whether a customer can tell 99.9% from 99.99%. Then the math: our critical path includes a DB at ~99.95% and a third-party provider at 99.9%, so 99.99% is impossible without removing or decoupling those dependencies.</p>
          <p>I would propose SLOs per user journey (read paths at 99.99%, which is achievable with caching and multi-region reads; writes at 99.9%), an error-budget policy that leadership signs, and a costed roadmap: multi-region cost, the dependency changes, and the on-call load.</p>
        </>}
      />

      <KeyTakeaways items={[
        'Pick SLOs per user journey. Spend the error budget deliberately and alert on burn rate.',
        'Hard dependencies multiply. Make dependencies soft, cached or async to raise the ceiling.',
        'Retries need backoff, jitter and a budget. Retry at one layer, and only idempotent operations.',
        'Circuit breakers, bulkheads, load shedding and deadlines keep a local failure local.',
        'Most outages are changes: use flags, canaries, staged config and automated rollback.',
      ]} />
    </>
  )
}
