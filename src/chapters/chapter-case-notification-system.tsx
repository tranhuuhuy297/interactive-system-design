import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, References, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { NotifPipelineSimulatorDemo } from './demos/notif-pipeline-simulator-demo'

const REFS: Reference[] = [
  { title: 'Sending notification requests to APNs', source: 'Apple Developer Documentation', url: 'https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns', kind: 'docs', note: 'headers incl. apns-collapse-id' },
  { title: 'Handling notification responses from APNs', source: 'Apple Developer Documentation', url: 'https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns', kind: 'docs', note: 'error codes such as 410 Unregistered' },
  { title: 'Firebase Cloud Messaging', source: 'Firebase documentation', url: 'https://firebase.google.com/docs/cloud-messaging', kind: 'docs' },
  { title: 'Designing robust and predictable APIs with idempotency', source: 'Brandur Leach, Stripe', year: 2017, url: 'https://stripe.com/blog/idempotency', kind: 'blog', note: 'idempotency keys, retries with jitter' },
  { title: 'Pattern: Transactional outbox', source: 'Chris Richardson, microservices.io', url: 'https://microservices.io/patterns/data/transactional-outbox.html', kind: 'docs' },
  { title: 'Using dead-letter queues in Amazon SQS', source: 'AWS documentation', url: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html', kind: 'docs' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 1 (ch. “Design a Notification System”)', source: 'Alex Xu', year: 2020, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'svc', label: 'Product services', sub: 'orders, auth, social', kind: 'client', x: 7, y: 30,
    detail: 'Producers publish intents ("order shipped for user 42") and never call providers directly. The notification platform owns channels, preferences, and retries.' },
  { id: 'camp', label: 'Campaign scheduler', sub: 'bulk / cron', kind: 'worker', x: 7, y: 75,
    detail: 'Expands an audience segment into per-user requests in paged batches, throttled so it can\'t swamp transactional traffic.' },
  { id: 'api', label: 'Notification API', sub: 'validate · dedupe', kind: 'service', x: 26, y: 52,
    detail: 'Validates the payload, rejects repeated idempotency keys (Redis SETNX with TTL), assigns a notificationId, and writes a PENDING row before enqueueing.' },
  { id: 'prefs', label: 'Prefs + limits', sub: 'opt-outs, quiet hours', kind: 'cache', x: 44, y: 18,
    detail: 'Per-user channel opt-ins, quiet hours, and frequency caps, cached aggressively. It\'s read on every notification and changes rarely.' },
  { id: 'tpl', label: 'Templates', sub: 'i18n rendering', kind: 'service', x: 44, y: 86,
    detail: 'Renders a template ID + params into per-channel, per-locale content. Keep this out of producers so copy changes don\'t need deploys.' },
  { id: 'q', label: 'Channel queues', sub: 'Kafka topic per channel × priority', kind: 'queue', x: 60, y: 52,
    detail: 'Separate topics for push/sms/email, each with high and low priority. An OTP never waits behind a 20M-email campaign.' },
  { id: 'w', label: 'Channel workers', sub: 'retry w/ backoff', kind: 'worker', x: 76, y: 52,
    detail: 'Call the provider, record the outcome, and retry transient failures with exponential backoff and jitter. Permanent failures (invalid token) are not retried.' },
  { id: 'prov', label: 'Providers', sub: 'APNs · FCM · SMS · email', kind: 'external', x: 93, y: 30,
    detail: 'External and rate-limited, and they fail in their own ways. Keep a secondary provider for SMS/email and route on health.' },
  { id: 'dlq', label: 'DLQ', sub: 'inspect & replay', kind: 'queue', x: 93, y: 75,
    detail: 'Where messages go after retries are exhausted. Alert on its growth rate and support a bulk replay once the provider recovers.' },
  { id: 'log', label: 'Notification log', sub: 'status per attempt', kind: 'db', x: 76, y: 88,
    detail: 'The source of truth for "did user X get notification Y": PENDING → SENT → DELIVERED/OPENED, or FAILED. Powers support tools and analytics.' },
]

const EDGES: ArchEdge[] = [
  { from: 'svc', to: 'api' }, { from: 'camp', to: 'api' }, { from: 'api', to: 'prefs' }, { from: 'api', to: 'tpl' },
  { from: 'api', to: 'q', async: true }, { from: 'q', to: 'w', async: true }, { from: 'w', to: 'prov' },
  { from: 'w', to: 'dlq', async: true }, { from: 'w', to: 'log' },
]

export default function NotificationSystemChapter() {
  return (
    <>
      <p>
        A notification system is a <strong>reliability and fairness</strong> problem dressed up as a messaging
        problem. Sending one push is trivial. The hard parts are guaranteeing that a password-reset code arrives in
        seconds while a 20-million-recipient campaign is draining, never sending the same “your order shipped”
        twice, and never messaging someone who opted out.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Push (iOS/Android), SMS, email', 'Triggered by events and by scheduled campaigns', 'Per-user preferences, opt-out, quiet hours', 'Templates with localization', 'Delivery status tracking']}
        nonFunctional={['~50M push, 2M SMS, 20M email per day', 'Transactional: delivered within seconds', 'No user-visible duplicates', 'At-least-once; nothing silently lost']}
        outOfScope={['In-app inbox UI', 'Campaign authoring tools']}
      />
      <Callout kind="tip">
        Ask which notifications are <strong>transactional</strong> (OTP, receipts) and which are
        <strong> marketing</strong>. They need different priority, rate limits, and legal treatment, and that split
        shapes the whole queue topology.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['Daily volumes above; a campaign may target 10M users in a 10-minute window', 'SMS priced at roughly $0.005–0.01 per message (varies by country and provider)']}
        rows={[
          { label: 'Average push', math: '50M / 86,400', result: '≈ 600/s' },
          { label: 'Campaign burst', math: '10M / 600 s', result: '≈ 17K/s' },
          { label: 'Email average', math: '20M / 86,400', result: '≈ 230/s' },
          { label: 'SMS spend / day', math: '2M × ~$0.0075', result: '≈ $15K' },
          { label: 'Log rows / day', math: '72M × ~1.5 attempts', result: '≈ 110M' },
        ]}
      />
      <p>
        The average load is small. <strong>Bursts</strong> and <strong>money</strong> dominate: a
        duplicated SMS campaign is a five-figure mistake. That's why dedup and rate limiting are first-class
        components rather than afterthoughts.
      </p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/notifications', desc: 'Request a notification. The idempotency key is required; the platform picks channels from preferences unless overridden.', body: '{ userId, templateId, params, priority, idempotencyKey, channels? }', returns: '202 { notificationId }' },
        { method: 'PUT', path: '/v1/users/{id}/preferences', desc: 'Channel opt-ins, categories, quiet hours.', body: '{ channels, categories, quietHours, tz }', returns: '204' },
        { method: 'POST', path: '/v1/devices', desc: 'Register or refresh a push token for a device.', body: '{ userId, platform, token, appVersion }', returns: '201' },
        { method: 'GET', path: '/v1/notifications/{id}', desc: 'Status for support and debugging.', returns: '{ status, attempts[], channel }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={420}
        caption="Producers express intent; the platform owns delivery"
        flows={[
          { name: 'Transactional push', path: ['svc', 'api', 'prefs', 'q', 'w', 'prov'],
            steps: ['Order service POSTs with idempotencyKey = order:123:shipped', 'API dedupes and writes a PENDING row', 'Prefs allow push; no frequency cap for transactional', 'Enqueued on push.high', 'Worker renders the payload and calls APNs/FCM'] },
          { name: 'Campaign', path: ['camp', 'api', 'q', 'w', 'prov'],
            steps: ['Scheduler pages through the segment, 1K users per batch', 'Each request passes dedupe, prefs, and marketing caps', 'Enqueued on email.low, so it never blocks high priority', 'Workers drain at the provider\'s allowed rate'] },
          { name: 'Provider outage', path: ['q', 'w', 'dlq'],
            steps: ['Worker pulls a message', 'Provider returns 5xx; retries with backoff; exhausted → DLQ, replayed once the provider recovers'] },
        ]} />

      <H2 id="reliability">5 · Deep dive: reliability without duplicates</H2>
      <NotifPipelineSimulatorDemo />
      <p>
        True exactly-once delivery across an external provider is impossible. If APNs times out, you can't know
        whether the phone buzzed. What you <em>can</em> build is:
      </p>
      <ul>
        <li><strong>Idempotency at ingress</strong>: the producer supplies a deterministic key (<code>order:123:shipped</code>), and <code>SETNX</code> with a TTL rejects replays from retries or double-published events.</li>
        <li><strong>At-least-once to the provider</strong>: retry transient errors with exponential backoff plus jitter, and never retry permanent ones (invalid token, unsubscribed).</li>
        <li><strong>Provider-side dedup where available</strong>: pass a stable message ID or collapse key so repeated pushes replace rather than stack.</li>
        <li><strong>Transactional outbox</strong> in producers, so "order committed" and "notification requested" can't diverge.</li>
      </ul>
      <CodeBlock lang="ts" title="worker send loop (sketch)" code={`
async function deliver(msg: QueuedNotification) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await provider[msg.channel].send(msg.payload, { messageId: msg.notificationId })
    if (res.ok) return log.update(msg.notificationId, 'SENT', res.providerId)
    if (res.permanent) {                        // e.g. APNs 410 Unregistered
      if (res.invalidToken) await devices.remove(msg.token)
      return log.update(msg.notificationId, 'FAILED', res.reason)
    }
    await sleep(backoffWithJitter(attempt))     // base * 2^attempt, randomized
  }
  await dlq.publish(msg)                        // alert on DLQ growth; replay later
}`} />

      <H2 id="isolation">6 · Deep dive: priority, isolation, and user fatigue</H2>
      <CompareTable
        columns={['One shared queue', 'Queue per channel', 'Queue per channel × priority']}
        rows={[
          { label: 'OTP during a campaign', cells: ['Stuck behind millions', 'Stuck behind campaign on same channel', 'Unaffected'] },
          { label: 'Provider outage', cells: ['Blocks everything', 'Isolated to that channel', 'Isolated'] },
          { label: 'Scaling knobs', cells: ['One', 'Per channel', 'Per channel and class'] },
          { label: 'Ops complexity', cells: ['Lowest', 'Medium', 'Higher, and worth it'] },
        ]}
      />
      <p>
        Fatigue controls protect users <em>and</em> the business, since over-notifying drives uninstalls:
        per-category frequency caps, quiet hours in the user's time zone, and <strong>digesting</strong> (collapse
        “5 people liked your post” into one notification over a short window).
      </p>

      <H2 id="data-model">7 · Data model</H2>
      <CodeBlock lang="ts" title="core tables" code={`
type NotificationLog = {
  notificationId: string       // PK
  userId: string               // secondary index for support lookups
  idempotencyKey: string       // unique per producer scope
  channel: 'push' | 'sms' | 'email'
  priority: 'high' | 'low'
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'FAILED'
  attempts: { at: number; result: string }[]
  providerMessageId?: string
}

type DeviceToken = { userId: string; deviceId: string; platform: 'ios' | 'android'; token: string; lastSeen: number }
type Preferences = { userId: string; channels: Record<string, boolean>; categories: Record<string, boolean>; quietHours?: [string, string]; tz: string }`} />

      <H2 id="staff">8 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Multi-provider failover</strong> for SMS and email: route on health and cost per country, with circuit breakers per provider.</li>
          <li><strong>Compliance</strong>: marketing email needs one-click unsubscribe, and SMS generally needs explicit consent (rules differ by jurisdiction). Encode consent as data, not as code paths.</li>
          <li><strong>Cost guardrails</strong>: per-campaign budgets and a kill switch. A runaway loop sending SMS is a financial incident.</li>
          <li><strong>Observability as a funnel</strong>: requested → deduped → suppressed → sent → delivered → opened, per template. Most "notifications are broken" tickets are answered by the funnel.</li>
          <li><strong>Token hygiene</strong>: prune tokens on provider feedback and app uninstall signals. Stale tokens waste throughput and skew metrics.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="How do you make sure a user never receives the same notification twice?"
        senior={<p>Put an idempotency key on each request and store processed keys in Redis with a TTL. If the key exists, skip it.</p>}
        staff={<>
          <p>Layered, because duplicates come from several places. <strong>Producer retries</strong> are handled by a deterministic idempotency key checked atomically at ingress. <strong>Queue redelivery</strong> is handled by workers checking the log status before sending. <strong>Provider ambiguity</strong> (a timeout after the send) is handled by passing a stable message ID or collapse key so the device replaces rather than duplicates.</p>
          <p>I'd be explicit that the provider boundary makes exactly-once impossible, so the goal is "no user-visible duplicates" plus a measurable duplicate rate we alert on.</p>
        </>}
        followUps={['How long should the dedup TTL be?', 'Where does the idempotency key come from for campaigns?']}
      />
      <InterviewQuestion
        q="Marketing launches a 20M-user email campaign and password-reset emails start arriving 15 minutes late. Fix it."
        senior={<p>Give password resets a higher priority, maybe with a separate queue and dedicated workers.</p>}
        staff={<>
          <p>Root cause: shared capacity. Transactional and bulk traffic compete for the same queue <em>and</em> the same provider rate limit. Fix both layers:</p>
          <ul>
            <li>Separate topics and worker pools per priority.</li>
            <li>Reserve provider throughput for transactional mail (separate sending domain or IP pool, or a separate provider account).</li>
            <li>Make campaigns self-throttle to leave headroom.</li>
          </ul>
          <p>Then add an SLO on transactional delivery latency so this is caught by an alert rather than by users.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Producers send intents. The platform owns channels, preferences, templates, and retries.',
        'Exactly-once to external providers is impossible. Layer idempotency so duplicates are not user-visible.',
        'Isolate by channel and priority. OTPs must never wait behind campaigns.',
        'Retry transient errors with backoff and jitter; don\'t retry permanent ones; DLQ plus replay for the rest.',
        'Staff depth: provider failover, consent and compliance, cost guardrails, funnel observability.',
      ]} />
    </>
  )
}
