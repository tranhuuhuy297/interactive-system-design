import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, EstimationTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways,
  LayerStack, MentalModel, References, Requirements, SideBySide, StatRow, TLDR, Term,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import {
  AlarmClock, Ban, CalendarClock, CheckCheck, Clock, Copy, Database, GitBranch, Hourglass, Inbox, KeyRound, Layers,
  Lock, Repeat, RotateCcw, Scale, Timer, Users, Workflow,
} from 'lucide-react'
import { SchedLeaseDemo } from './demos/sched-lease-demo'

const REFS: Reference[] = [
  { title: 'Distributed Periodic Scheduling with Cron', source: 'Google, Site Reliability Engineering (ch. 24)', year: 2016, url: 'https://sre.google/sre-book/distributed-periodic-scheduling/', kind: 'book', note: 'Paxos-replicated launch state; prefers skipping a launch over launching twice; “?” to spread load' },
  { title: 'Amazon SQS visibility timeout', source: 'AWS documentation', url: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html', kind: 'docs', note: 'lease semantics: a claimed message reappears if not deleted in time' },
  { title: 'Timeouts, retries, and backoff with jitter', source: 'Amazon Builders’ Library', url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/', kind: 'blog' },
  { title: 'Making retries safe with idempotent APIs', source: 'Amazon Builders’ Library', url: 'https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/', kind: 'blog' },
  { title: 'CronJob', source: 'Kubernetes documentation', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/', kind: 'docs', note: 'concurrencyPolicy (Allow / Forbid / Replace) and startingDeadlineSeconds' },
  { title: 'DAG Runs (catchup)', source: 'Apache Airflow documentation', url: 'https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dag-run.html', kind: 'docs', note: 'backfilling missed intervals' },
  { title: 'Workflows', source: 'Temporal documentation', url: 'https://docs.temporal.io/workflows', kind: 'docs', note: 'durable execution for multi-step jobs' },
]

const NODES: ArchNode[] = [
  { id: 'client', label: 'Tenants', sub: 'API · console', kind: 'client', x: 10, y: 20 },
  { id: 'api', label: 'Scheduler API', sub: 'validate cron + tz', kind: 'service', x: 28, y: 20,
    detail: 'Parses the cron expression in the job’s time zone, rejects impossible schedules, enforces per-tenant quotas, and stores the definition.' },
  { id: 'jobs', label: 'Job store', sub: 'definitions', kind: 'db', x: 46, y: 20,
    detail: 'The source of truth for what should run: schedule, time zone, target, payload, retry and concurrency policy. Small, read-mostly.' },
  { id: 'dlq', label: 'Dead-letter queue', sub: 'needs a human', kind: 'queue', x: 10, y: 50,
    detail: 'Runs that failed every allowed attempt land here with their error history, and page the owning team instead of retrying forever.' },
  { id: 'planner', label: 'Planner', sub: 'next fire times', kind: 'worker', x: 46, y: 50,
    detail: 'Computes the next few fire times for each job and writes them into time buckets. Re-plans whenever a definition changes.' },
  { id: 'due', label: 'Due index', sub: 'one bucket per minute', kind: 'db', x: 64, y: 50,
    detail: 'Rows keyed by (minute bucket, shard). Finding due work is a read of the current bucket, never a scan over all 10M jobs.' },
  { id: 'dispatcher', label: 'Dispatchers', sub: 'one per shard', kind: 'service', x: 82, y: 50,
    detail: 'Each shard of the due index has exactly one active dispatcher, elected with a lease. It turns due rows into run records and enqueues them.' },
  { id: 'history', label: 'Run history', sub: 'attempts, outcomes', kind: 'db', x: 46, y: 86,
    detail: 'One row per run and attempt: who ran it, when, how it ended. It powers the UI, alerting, and the idempotency check.' },
  { id: 'workers', label: 'Workers', sub: 'claim with a lease', kind: 'worker', x: 64, y: 80,
    detail: 'Claim a run with a lease, heartbeat while running, and complete or fail it. A lease that expires makes the run claimable again.' },
  { id: 'queue', label: 'Run queue', sub: 'per priority / tenant', kind: 'queue', x: 82, y: 80,
    detail: 'Holds runs ready to execute. Separate queues per priority class let urgent jobs skip past a backlog of bulk ones.' },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'api' }, { from: 'api', to: 'jobs' }, { from: 'jobs', to: 'planner' }, { from: 'planner', to: 'due' },
  { from: 'due', to: 'dispatcher' }, { from: 'dispatcher', to: 'queue' }, { from: 'queue', to: 'workers' },
  { from: 'workers', to: 'history' }, { from: 'workers', to: 'dlq', async: true },
]

export default function JobSchedulerChapter() {
  return (
    <>
      <TLDR items={[
        'Run millions of recurring and one-off jobs on time, across many tenants, without losing or silently doubling runs.',
        'Key decision: precompute fire times into per-minute buckets, so finding due work never scans every job.',
        'Workers claim runs with leases. A crashed worker’s lease expires and someone else retries.',
        'That means at-least-once execution. Idempotency keys turn it into exactly-once effects.',
        'Staff insight: missed runs, overlapping runs, and daylight-saving jumps are policy choices each job must make explicitly.',
      ]} />
      <MentalModel id="job-scheduler" />

      <p>
        A scheduler looks like a loop that checks the clock. At scale it becomes a distributed system with a nasty
        property: its failures are silent. A job that did not run produces no error, and a job that ran twice often
        looks like success.
      </p>
      <p>
        So the design has two goals. Make finding due work cheap, and make every run safe to repeat.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>Timing precision and the duplicate-versus-miss policy matter more than raw throughput here.</p>
      <Requirements
        functional={['Create, update, pause, delete jobs (cron or one-off)', 'Per-job time zone', 'Retries with backoff, then a dead-letter queue', 'Run history and manual “run now”', 'Concurrency policy per job']}
        nonFunctional={['10M scheduled jobs across many tenants (illustrative)', 'Start within a few seconds of the due time', 'No run silently skipped', 'Survive the loss of any single node or zone', 'Fair share between tenants']}
        outOfScope={['Executing arbitrary user code (workers call the tenant’s endpoint)', 'Cross-job data lineage']}
      />
      <Callout kind="tip">
        Ask what the jobs <em>do</em>. Sending an invoice and cleaning up temp files need opposite policies when
        something goes wrong: one must never run twice, the other must eventually run.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>The average rate is modest. The danger is that humans love round numbers like midnight.</p>
      <EstimationTable
        assumptions={['10M jobs; average interval 10 minutes (illustrative)', '10% of jobs are scheduled at exactly 00:00 in their time zone', 'Run history row ~500 bytes']}
        rows={[
          { label: 'Average run rate', math: '10M ÷ 600 s', result: '≈ 17K/s' },
          { label: 'Midnight spike', math: '10% × 10M at the same second', result: '≈ 1M runs' },
          { label: 'Job definitions', math: '10M × 1 KB', result: '≈ 10 GB' },
          { label: 'Run history per day', math: '17K/s × 500 B × 86,400', result: '≈ 730 GB' },
        ]}
      />
      <StatRow stats={[
        { value: '10M', label: 'scheduled jobs' },
        { value: '17K/s', label: 'average runs' },
        { value: '1M', label: 'runs due at midnight', note: 'if nobody spreads them' },
        { value: '730 GB', label: 'run history per day' },
      ]} />
      <p>
        The spike is the real design driver. Google’s distributed cron added a “?” field to crontab so the system can
        pick the exact minute and spread load. Offering that, or adding{' '}
        <Term def="A small random delay added to a start time so that many clients don’t all act at the same instant.">jitter</Term>,
        is cheaper than building for a 60× peak.
      </p>

      <H2 id="api">3 · API</H2>
      <p>Tenants manage jobs. Workers use a small internal API to claim, extend, and finish runs.</p>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/jobs', desc: 'Create a job.', body: '{ schedule: "0 9 * * MON", timeZone: "Europe/Paris", target, payload, retry, concurrency: "forbid", missedRuns: "latest" }', returns: '201 { jobId, nextRuns[] }' },
        { method: 'PATCH', path: '/v1/jobs/{id}', desc: 'Pause, resume, or change the schedule; the planner re-plans.', returns: '200' },
        { method: 'POST', path: '/v1/jobs/{id}/runs', desc: 'Run now, outside the schedule.', returns: '202 { runId }' },
        { method: 'POST', path: '/internal/runs:claim', desc: 'Worker claims up to N runs with a lease.', body: '{ workerId, max, leaseSeconds }', returns: '{ runs[{ runId, attempt, payload }] }' },
        { method: 'POST', path: '/internal/runs/{runId}:heartbeat', desc: 'Extend the lease while still working.', returns: '200 or 409 if the lease was lost' },
        { method: 'POST', path: '/internal/runs/{runId}:complete', desc: 'Finish, succeeded or failed; failures are rescheduled with backoff.', body: '{ attempt, outcome, error? }', returns: '200' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>
        The design separates <strong>deciding</strong> when something runs from <strong>doing</strong> it. The planner and
        due index answer “what is due now?”. The queue and workers answer “who runs it, and what if they die?”.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={440}
        caption="Planning is cheap and precomputed; execution is leased, retried, and recorded"
        flows={[
          { name: 'Register', path: ['client', 'api', 'jobs', 'planner', 'due'],
            steps: ['Tenant creates a cron job', 'API validates the schedule in the job’s time zone and stores it', 'Planner picks up the new definition', 'Planner writes the next fire time into its minute bucket'] },
          { name: 'Fire', path: ['due', 'dispatcher', 'queue', 'workers', 'history'],
            steps: ['At 09:00 the shard’s dispatcher reads the current bucket', 'It creates a run record and enqueues it', 'A worker claims the run with a lease', 'The worker records the attempt and its outcome'] },
          { name: 'Failure', path: ['workers', 'queue', 'workers', 'dlq'],
            steps: ['Worker dies mid-run; its lease expires and the run is claimable again', 'Another worker claims it as attempt 2', 'After the last allowed attempt, the run moves to the dead-letter queue'] },
        ]} />

      <H2 id="due-work">5 · Deep dive: finding due work</H2>
      <p>
        With 10M jobs, “select everything where next_run ≤ now” every second is too much work. Three structures make it
        cheap, and they suit different sizes.
      </p>
      <SideBySide caption="Buckets turn “what is due?” into reading one small partition" panels={[
        { title: 'Index on next_run', icon: Database, points: ['+ Simple, one table', '+ Fine up to a few million rows', '- Hot index at the head', '- Hard to shard fairly'], verdict: 'Small and medium systems' },
        { title: 'Minute buckets', icon: CalendarClock, tone: 'good', points: ['+ Read exactly one bucket per minute', '+ Shard buckets by hash of job id', '+ Easy to add jitter within a bucket'], verdict: 'The default at scale' },
        { title: 'Timing wheel', icon: Clock, points: ['+ O(1) insert and expiry in memory', '- Needs persistence and recovery', '- Harder to rebalance'], verdict: 'Inside one node, for timers' },
      ]} />
      <CodeBlock lang="ts" title="bucket key" code={`
// Due rows are partitioned by (minute, shard) so each dispatcher reads one small slice.
const bucketKey = (fireAt: Date, jobId: string, shards = 256) =>
  \`\${Math.floor(fireAt.getTime() / 60_000)}:\${hash(jobId) % shards}\`

// Spread "flexible" jobs across the minute instead of firing all at :00.
const fireAtWithJitter = (base: Date, jobId: string, flexibleSeconds: number) =>
  new Date(base.getTime() + (hash(jobId) % (flexibleSeconds * 1000)))`} />
      <p>
        Each shard has one active dispatcher, chosen with a{' '}
        <Term def="A lock that expires unless its holder renews it, so a crashed holder cannot block others forever.">lease</Term>{' '}
        in a strongly consistent store. If the dispatcher dies, another takes over the shard when the lease lapses.
      </p>

      <H2 id="leases">6 · Deep dive: leases and the exactly-once illusion</H2>
      <p>
        A worker that claims a run might crash, stall in garbage collection, or lose its network. The scheduler cannot
        tell these apart. It only knows the lease stopped being renewed.
      </p>
      <FlowDiagram steps={[
        { label: 'Claim', sub: 'lease for N seconds', icon: Lock },
        { label: 'Heartbeat', sub: 'extend while running', icon: Timer },
        { label: 'Do the work', sub: 'with idempotency key', icon: KeyRound },
        { label: 'Complete', sub: 'release the lease', icon: CheckCheck },
        { label: 'Or expire', sub: 'someone else retries', icon: Hourglass },
      ]} caption="A lost lease must stop the worker from committing, or a stale worker and a new one both finish the run" />
      <SchedLeaseDemo />
      <Callout kind="pitfall">
        Promising “exactly once”. No scheduler can guarantee a job ran exactly once when workers can pause for longer
        than their lease. What you can guarantee is at-least-once execution plus idempotent effects, keyed by run id.
      </Callout>

      <H2 id="retries">7 · Deep dive: retries, backoff, and the dead-letter queue</H2>
      <p>
        Failures are normal: the tenant’s endpoint is down, a dependency throttles, a deploy is in progress. Retries must
        help recovery rather than pile on.
      </p>
      <FlowDiagram steps={[
        { label: 'Attempt 1 fails', sub: 'record the error', icon: Ban },
        { label: 'Back off', sub: 'exponential + jitter', icon: Hourglass },
        { label: 'Retry', sub: 'same run id', icon: RotateCcw },
        { label: 'Give up', sub: 'after max attempts', icon: Inbox },
        { label: 'Alert owner', sub: 'dead-letter queue', icon: AlarmClock },
      ]} caption="Separate transient failures (retry) from permanent ones (fail fast to the dead-letter queue)" />
      <p>
        Reuse the same run id on every attempt. That is what lets the tenant’s side detect a repeat and skip it.
      </p>

      <H2 id="policies">8 · Deep dive: missed runs, overlaps, and time zones</H2>
      <p>
        Two questions come up for every job. What if a run is still going when the next one is due? And what if the
        scheduler was down when runs were due?
      </p>
      <SideBySide caption="Kubernetes CronJob exposes the same three choices as concurrencyPolicy" panels={[
        { title: 'Allow', icon: Copy, points: ['+ Never delays a run', '- Overlapping runs can collide'], verdict: 'Independent, idempotent jobs' },
        { title: 'Forbid', icon: Ban, tone: 'good', points: ['+ One run at a time', '- A slow run causes skipped ones'], verdict: 'Reports, exports, billing' },
        { title: 'Replace', icon: Repeat, points: ['+ Latest run always wins', '- Kills work in progress'], verdict: 'Refresh jobs where only “now” matters' },
      ]} />
      <p>
        For missed runs, pick between <strong>catch-up</strong> (run every missed interval, as Airflow’s backfill does)
        and <strong>latest only</strong> (run once, now). A starting deadline, such as “skip if more than 8 hours late”,
        stops stale runs from firing.
      </p>
      <CodeBlock lang="text" title="daylight-saving traps (example: a zone that jumps 02:00 → 03:00 in spring)" code={`
"30 2 * * *"  spring-forward day:  02:30 local never happens   → skip it or run at 03:00?
"30 1 * * *"  fall-back day:       01:30 local happens twice   → run once or twice?

Store schedules in the tenant's time zone, compute fire times in UTC,
and make the DST policy an explicit, documented choice.`} />

      <H2 id="fairness">9 · Deep dive: fairness between tenants</H2>
      <p>
        One tenant scheduling a million jobs at midnight must not delay everyone else. Isolation is layered, from coarse to
        fine.
      </p>
      <LayerStack legend="Each layer limits a different kind of noisy neighbour"
        caption="Quotas cap what a tenant can create; weighted queues decide who runs first under contention"
        layers={[
          { label: 'Creation quotas', sub: 'jobs and runs per tenant per hour', icon: Scale, size: 1 },
          { label: 'Priority classes', sub: 'critical, standard, bulk queues', icon: Layers, size: 0.8 },
          { label: 'Weighted fair dequeue', sub: 'share workers by tenant weight', icon: Users, size: 0.6, highlight: true },
          { label: 'Per-target concurrency', sub: 'protect each tenant’s endpoint', icon: Timer, size: 0.4 },
        ]} />

      <H2 id="workflows">10 · Deep dive: from jobs to workflows</H2>
      <p>
        Real jobs are often multi-step: export, transform, load, notify. Chaining them with separate cron entries is
        fragile. A workflow engine records each step’s result, so a crash resumes at the failed step instead of starting
        over.
      </p>
      <FlowDiagram steps={[
        { label: 'Trigger', sub: 'nightly at 02:00', icon: CalendarClock },
        { label: 'Extract', sub: 'step 1, checkpointed', icon: Database },
        { label: 'Transform', sub: 'step 2, retried alone', icon: Workflow },
        { label: 'Load', sub: 'idempotent upsert', icon: GitBranch },
        { label: 'Notify', sub: 'once, keyed by run', icon: CheckCheck },
      ]} caption="Durable execution, as in engines like Temporal, persists each step so retries are per step" />

      <H2 id="data-model">11 · Data model</H2>
      <p>Four tables: definitions, due rows, runs with attempts, and dispatcher leases.</p>
      <CodeBlock lang="ts" title="storage layout" code={`
type Job = { jobId: string; tenantId: string; schedule: string; timeZone: string
             target: string; payload: unknown; maxAttempts: number
             concurrency: 'allow' | 'forbid' | 'replace'; missedRuns: 'catch_up' | 'latest'; paused: boolean }

// Due index, partitioned by (minuteBucket, shard)
type DueRow = { minuteBucket: number; shard: number; jobId: string; fireAt: number }

// One run per (jobId, fireAt); the runId doubles as the idempotency key
type Run = { runId: string; jobId: string; fireAt: number; attempt: number
             state: 'queued' | 'leased' | 'succeeded' | 'failed' | 'dead'
             leaseOwner?: string; leaseUntil?: number; lastError?: string }

// Shard ownership for dispatchers (strongly consistent store)
type ShardLease = { shard: number; owner: string; leaseUntil: number; fencingToken: number }`} />

      <H2 id="staff">12 · Going beyond: staff-level extensions</H2>
      <p>The mechanics are settled. Staff answers focus on the guarantees you promise tenants and how you prove them.</p>
      <Callout kind="staff">
        <ul>
          <li><strong>Skip or double?</strong> Google’s cron chooses to skip a launch rather than risk launching twice, because a missed cleanup is easier to fix than a newsletter sent twice. Make this a per-job setting with a documented default.</li>
          <li><strong>Fencing tokens.</strong> A dispatcher or worker that lost its lease but doesn’t know it yet can still write. Attach a monotonically increasing token and have stores reject older ones.</li>
          <li><strong>Observability of absence.</strong> Alert on “job X has not succeeded in 2 intervals”, not just on failures. Silent misses are the dangerous ones.</li>
          <li><strong>Clock trust.</strong> Compute due times from one trusted clock source, and treat each host’s local clock as a hint.</li>
          <li><strong>Blast radius.</strong> Shard dispatchers by tenant groups so one tenant’s bad schedule cannot starve the whole platform.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="A worker runs a billing job, then pauses for 60 seconds in garbage collection. Its lease was 30 seconds. What happens?"
        senior={<p>The lease expires, so another worker picks up the job and runs it again. We should use heartbeats to extend the lease while the job is running.</p>}
        staff={<>
          <p>Heartbeats help, but a paused process cannot heartbeat, so the second worker will run the job. Now two executions exist, and the first wakes up believing it still owns the run. So I would do three things.</p>
          <ul>
            <li>Every side effect carries the run id as an idempotency key, so the second charge is rejected downstream.</li>
            <li>Completion is conditional on a fencing token, so the stale worker cannot mark the run finished or overwrite results.</li>
            <li>The worker checks its lease before each irreversible step and aborts if it has lost it.</li>
          </ul>
          <p>With that, execution is at-least-once, but the billing effect happens exactly once.</p>
        </>}
        followUps={['How long should the lease be?', 'What if the downstream API does not support idempotency keys?', 'How do you detect duplicates after the fact?']}
      />
      <InterviewQuestion
        q="Your scheduler was down for 2 hours. What happens when it comes back?"
        senior={<p>It finds all the runs it missed and executes them, maybe with rate limiting so it doesn’t overload workers.</p>}
        staff={<>
          <p>It depends on each job’s missed-run policy, and the default matters. Catch-up jobs such as hourly aggregations run every missed interval, oldest first. Latest-only jobs such as “refresh cache” run once. Jobs past their starting deadline are skipped and reported.</p>
          <p>Then I would throttle the replay: dispatch missed runs through the same fair queues with a lower priority than on-time runs, so recovery doesn’t cause a second outage. Finally, alert tenants about what was skipped, because a silent skip is worse than a late run.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Precompute fire times into minute buckets so finding due work never scans every job.',
        'Leases plus heartbeats handle crashes, but a paused worker can still run twice: design for at-least-once.',
        'Idempotency keys and fencing tokens turn duplicate executions into single effects.',
        'Missed-run, overlap, and daylight-saving behaviour are explicit per-job policies, not accidents.',
        'Spread midnight spikes with jitter, and isolate tenants with quotas and weighted queues.',
      ]} />
    </>
  )
}
