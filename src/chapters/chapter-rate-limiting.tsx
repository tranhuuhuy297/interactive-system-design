import {
  ArchitectureDiagram, Callout, CodeBlock, CompareTable, H2, InterviewQuestion, KeyTakeaways, LayerStack, MentalModel, References, Requirements, SideBySide, TLDR, Tabs, Term,
} from '../components/ui'
import { Atom, CalendarDays, DoorClosed, DoorOpen, FileSignature, Gauge, Server, Shield, Shuffle, Timer } from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { RateLimitRaceDemo } from './demos/ratelimit-race-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Clients', sub: 'apps, partners, bots', kind: 'client', x: 8, y: 50 },
  { id: 'edge', label: 'Edge / WAF', sub: 'coarse IP limits', kind: 'cdn', x: 27, y: 50,
    detail: 'Cheap, coarse protection against volumetric abuse, keyed by IP or ASN. It cannot see user identity, so it cannot enforce plan quotas.' },
  { id: 'gw', label: 'API gateway', sub: 'per key / per plan', kind: 'lb', x: 48, y: 50,
    detail: 'The usual home for business rate limits. It knows the API key and tenant, so it can apply plan-based quotas before any backend work happens.' },
  { id: 'redis', label: 'Counter store', sub: 'Redis cluster', kind: 'cache', x: 48, y: 15,
    detail: 'Shared state so all gateway replicas see the same counters. Use atomic Lua scripts, and shard by the limit key.' },
  { id: 'rules', label: 'Rules config', sub: 'plans, overrides', kind: 'storage', x: 27, y: 15,
    detail: 'Limits live in config, not code. Gateways cache rules locally and reload them on change.' },
  { id: 'svc', label: 'Service', sub: 'concurrency limit', kind: 'service', x: 70, y: 50,
    detail: 'The service protects itself too: it caps in-flight requests and sheds load when its own latency rises. This is not about fairness, it is about survival.' },
  { id: 'db', label: 'Database', kind: 'db', x: 90, y: 50 },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'edge' }, { from: 'edge', to: 'gw' }, { from: 'gw', to: 'redis', label: 'INCR / EVALSHA' },
  { from: 'rules', to: 'gw', async: true }, { from: 'gw', to: 'svc' }, { from: 'svc', to: 'db' },
]

const REFS: Reference[] = [
  { title: "Scaling your API with rate limiters", source: "Stripe blog", year: 2017, url: "https://stripe.com/blog/rate-limiters", kind: "blog" },
  { title: "Counting things, a lot of different things…", source: "Cloudflare blog", year: 2017, url: "https://blog.cloudflare.com/counting-things-a-lot-of-different-things/", kind: "blog", note: "Sliding-window counter approximation at scale" },
  { title: "RateLimit header fields for HTTP (Internet-Draft)", source: "IETF HTTPAPI WG", url: "https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/", kind: "rfc" },
  { title: "RFC 6585: Additional HTTP Status Codes (429 Too Many Requests)", source: "IETF", year: 2012, url: "https://www.rfc-editor.org/rfc/rfc6585", kind: "rfc" },
  { title: "RFC 9110: HTTP Semantics", source: "IETF", year: 2022, url: "https://www.rfc-editor.org/rfc/rfc9110", kind: "rfc", note: "Retry-After" },
  { title: "Scripting with Lua", source: "Redis documentation", url: "https://redis.io/docs/latest/develop/interact/programmability/eval-intro/", kind: "docs", note: "Atomic check-and-update" },
  { title: "System Design Interview – An Insider’s Guide (Vol. 1)", source: "Alex Xu", year: 2020, kind: "book", note: "Has a rate-limiter chapter; the simulations and code here are original" },
]

export default function RateLimitingChapter() {
  return (
    <>
      <p>
        A rate limiter answers one question for every request: <strong>“may this caller do this now?”</strong> It
        protects capacity, enforces paid quotas, keeps one noisy customer from starving the rest, and blunts abuse
        such as{' '}
        <Term def="Attackers trying leaked username/password pairs against many accounts at high speed.">credential stuffing</Term>.
      </p>
      <TLDR items={[
        'Token bucket is the default: it allows short bursts and enforces an average rate.',
        'Across many gateway nodes, the check and the update must be one atomic step, usually a Redis Lua script.',
        'Always return 429 with Retry-After so well-behaved clients back off.',
        'Decide up front whether a broken limiter lets traffic through (fail open) or blocks it (fail closed).',
      ]} />
      <MentalModel id="rate-limiting" />
      <p>
        The algorithm is the easy part. The hard parts are <strong>where</strong> to enforce the limit,{' '}
        <strong>shared state</strong> across many gateway nodes, and <strong>what to do</strong> when the limiter
        itself is slow or down.
      </p>

      <H2 id="requirements">Clarify what you are limiting</H2>
      <Requirements
        functional={['Limit by key: user, API key, IP, tenant, or endpoint', 'Several rules per request (per-second and per-day)', 'Return 429 with retry guidance', 'Change limits without a deploy']}
        nonFunctional={['Adds < 1–2 ms to p99', 'Works across N stateless gateway replicas', 'Fails open or closed by explicit choice', 'Accurate enough, not perfectly exact']}
        outOfScope={['DDoS scrubbing at the network layer', 'Billing and metering']}
      />
      <p>Then ask what the limit is <em>for</em>. The answer changes where it lives and how exact it must be.</p>
      <SideBySide panels={[
        { title: 'Protection limit', icon: Shield, points: [
          '“Don’t melt the database”',
          '+ Lives close to the resource',
          '+ Approximate is fine',
        ] },
        { title: 'Contractual limit', icon: FileSignature, points: [
          '“Your plan includes 10K calls/day”',
          '- Needs durable, auditable counters',
          '- Needs a clear story at window edges',
        ] },
      ]} />

      <H2 id="algorithms">The five algorithms, raced live</H2>
      <p>
        All five algorithms see the same request stream below. Watch how they differ on bursts and at window
        boundaries. The{' '}
        <Term def="A bucket fills with tokens at a steady rate up to a cap; each request spends one token or is rejected.">token bucket</Term>{' '}
        is the most common choice.
      </p>
      <RateLimitRaceDemo />
      <CompareTable
        columns={['Memory / key', 'Allows bursts?', 'Accuracy', 'Notes']}
        rows={[
          { label: 'Token bucket', cells: ['2 numbers', 'Yes, up to capacity', 'Exact for average rate', 'The default choice. Capacity and refill rate are separate knobs'] },
          { label: 'Leaky bucket', cells: ['Queue or 2 numbers', 'No, output is smoothed', 'Exact', 'Adds queueing delay. Good for shaping calls to a fragile downstream'] },
          { label: 'Fixed window', cells: ['1 counter', 'Up to 2× at a boundary', 'Coarse', 'Simplest. Also resets everyone at once, which causes thundering herds'] },
          { label: 'Sliding log', cells: ['1 timestamp per request', 'No', 'Exact', 'Memory grows with the limit. Fine for low limits such as login attempts'] },
          { label: 'Sliding counter', cells: ['2 counters', 'Slightly', 'Approximate (assumes even spread)', 'Good accuracy/cost balance at high scale'] },
        ]}
      />
      <Callout kind="info">
        In the demo, the <strong>token bucket</strong> can also show a peak above the limit. That is expected:
        it enforces an <em>average</em> rate while allowing a burst up to its capacity. If a contract says
        “never more than N in any window”, the token bucket is the wrong tool.
      </Callout>

      <H2 id="placement">Where the limiter lives</H2>
      <p>Most systems limit in layers: a coarse check at the edge, business rules at the gateway, and self-protection in each service.</p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={300}
        caption="Defense in depth: coarse limits at the edge, business limits at the gateway, self-protection in each service"
        flows={[
          { name: 'Allowed', path: ['client', 'edge', 'gw', 'redis'], steps: ['Request arrives', 'Edge IP limit passes', 'Gateway runs an atomic check-and-decrement in Redis → allowed, forwarded'] },
          { name: 'Forwarded', path: ['client', 'edge', 'gw', 'svc', 'db'], steps: ['Request arrives', 'Edge passes', 'Gateway allows', 'Service has spare concurrency, so it queries the DB'] },
        ]} />

      <H2 id="distributed">Distributed counters without races</H2>
      <p>
        With 50 gateway replicas, a naive <code>GET</code> → compare → <code>SET</code> is a race. Two nodes both read
        “4 of 5”, and both allow the request.
      </p>
      <SideBySide panels={[
        { title: 'Naive: read, compare, write', icon: Shuffle, tone: 'bad', points: [
          '- Node A reads “4 of 5”',
          '- Node B reads “4 of 5”',
          '- Both allow: 6 requests pass a limit of 5',
        ] },
        { title: 'Atomic check-and-update', icon: Atom, tone: 'good', points: [
          '+ One operation on the counter store',
          '+ Lua script in Redis, or INCR + EXPIRE',
          '+ No other command can interleave',
        ] },
      ]} />
      <Tabs items={[
        { label: 'Token bucket (Lua)', content: <CodeBlock lang="text" title="token_bucket.lua — KEYS[1]=bucket, ARGV: capacity, refill_per_ms, now_ms" code={`
-- Runs atomically inside Redis: no other command interleaves.
local capacity = tonumber(ARGV[1])
local rate     = tonumber(ARGV[2])
local now      = tonumber(ARGV[3])

local state  = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(state[1]) or capacity
local ts     = tonumber(state[2]) or now

tokens = math.min(capacity, tokens + (now - ts) * rate)
local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / rate))
return { allowed, tokens }`} /> },
        { label: 'Fixed window (INCR)', content: <CodeBlock lang="ts" title="fixed window in two commands" code={`
const key = \`rl:\${userId}:\${Math.floor(Date.now() / 60_000)}\`
// ioredis: exec() resolves to [err, value] pairs, one per queued command
const [[, count]] = (await redis.multi().incr(key).expire(key, 61).exec())!
if ((count as number) > LIMIT) throw new TooManyRequests({ retryAfterSec: secondsUntilNextMinute() })`} /> },
        { label: 'Response headers', content: <CodeBlock lang="text" title="HTTP 429" code={`
HTTP/1.1 429 Too Many Requests
Retry-After: 12
RateLimit-Policy: "burst";q=100;w=60
RateLimit: "burst";r=0;t=12
Content-Type: application/problem+json`} /> },
      ]} />
      <p>
        Use the server's clock, or Redis <code>TIME</code>, rather than each gateway's local clock. Shard counters by
        limit key so one hot tenant lands on one shard.
      </p>
      <p>
        For extreme QPS, a <strong>local-then-sync</strong> hybrid works. Each node spends a small local allowance and
        reconciles with the central store every few hundred milliseconds. You accept a small, bounded overshoot in
        exchange for much lower latency and load.
      </p>
      <Callout kind="tip">
        The <code>RateLimit</code> / <code>RateLimit-Policy</code> header fields come from an IETF HTTPAPI working-group
        draft. Many APIs still send the older <code>X-RateLimit-Limit / -Remaining / -Reset</code> trio. Whichever
        you pick, always send <code>Retry-After</code> on a 429 so well-behaved clients back off.
      </Callout>

      <H2 id="failure">When the limiter fails</H2>
      <p>The limiter depends on a counter store. When that store is down, you need a decision made in advance.</p>
      <SideBySide caption="Decide this before the outage, per limit" panels={[
        { title: 'Fail open', icon: DoorOpen, points: [
          'Counter store down → allow all',
          '- Backend unprotected during the outage',
        ], verdict: 'Protection and fairness limits' },
        { title: 'Fail closed', icon: DoorClosed, points: [
          'Counter store down → reject all',
          '- Your limiter becomes the outage',
        ], verdict: 'Login, OTP, paid quotas' },
        { title: 'Local fallback', icon: Server, tone: 'good', points: [
          '+ Short timeout on the store call',
          '+ Fall back to global limit ÷ node count',
          '+ “Approximately right” instead of open or down',
        ], verdict: 'A good middle ground' },
      ]} />


      <H2 id="fairness">Multi-tier limits and fairness</H2>
      <p>Real APIs combine several limits, so no single customer or request type can crowd out the rest.</p>
      <LayerStack legend="Stacked rules: a request must pass every layer"
        caption="Evaluate all layers in one Lua call to avoid several round trips"
        layers={[
          { label: 'Burst', sub: 'short spikes', icon: Timer, size: 0.4, value: '20 / s' },
          { label: 'Sustained', sub: 'steady rate', icon: Gauge, size: 0.7, value: '1,000 / min' },
          { label: 'Quota', sub: 'plan allowance', icon: CalendarDays, size: 1, value: '100K / day', highlight: true },
        ]} />
      <ul>
        <li><strong>Per-tenant and global</strong>: a global concurrency cap protects the service, and per-tenant limits share the capacity fairly. A weighted fair queue lets paying tiers win under contention.</li>
        <li><strong>Cost-based limits</strong>: weight requests by cost (a search costs 10 units, a GET costs 1), as GitHub's GraphQL API does with point budgets.</li>
        <li><strong>Adaptive limits</strong>: let the service lower limits automatically when its latency or queue depth rises, using TCP-style <Term def="Additive increase, multiplicative decrease: raise the limit slowly while healthy, cut it sharply on trouble.">AIMD</Term> concurrency limits.</li>
      </ul>

      <H2 id="staff">Staff-level lens</H2>
      <p>A limit affects three groups at once, and a good design serves all of them.</p>
      <Callout kind="staff">
        <p>Strong candidates ask what problem the limit solves, then design for three stakeholders at once:</p>
        <ul>
          <li><strong>The platform</strong>, which needs survival under overload. That calls for concurrency limits and load shedding in each service, not only request-rate limits at the gateway.</li>
          <li><strong>The customer</strong>, who needs predictability: documented limits, headers, a dashboard of their usage, and a grace path such as soft limits that alert before they block.</li>
          <li><strong>The business</strong>, which needs limits in config per plan, overrides for key accounts, and an audit trail when a big customer is throttled.</li>
        </ul>
        <p>They also say what they would <em>not</em> build: exact global counters for protection limits, because the latency and cost are not worth it.</p>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Design a rate limiter for a public API: 100 requests/minute per API key, 50 gateway nodes."
        senior={<p>Put a token bucket in the API gateway with state in Redis, keyed by API key. Use a Lua script so check-and-decrement is atomic. Return 429 with Retry-After when the bucket is empty. Load rules from a config service.</p>}
        staff={<>
          <p>Same core, plus the parts that fail in production:</p>
          <ul>
            <li>Shard Redis by key and keep an in-process cache of <em>rejected</em> keys for a second, so a key that is being hammered doesn't hammer Redis too.</li>
            <li>Put a 5 ms timeout on the Redis call and fall back to local per-node limits (100/50 per node) instead of failing open.</li>
            <li>Stack a burst limit with the per-minute limit so a client can't spend all 100 in 50 ms.</li>
            <li>Emit metrics per key (throttle rate) and alert the account team when a big customer is heavily throttled. That is usually a sales conversation, not an incident.</li>
          </ul>
        </>}
        followUps={['How do you handle a limit change for a key mid-window?', 'What if one API key is 30% of all traffic?', 'How would you rate limit across two regions?']}
      />
      <InterviewQuestion
        q="Why not just use a fixed window counter everywhere? It's one INCR."
        senior={<p>It allows up to twice the limit around window boundaries, because the counter resets at the boundary.</p>}
        staff={<>
          <p>The boundary burst is one problem. The other is <strong>synchronized resets</strong>: every client that was throttled retries at the start of the minute, so the backend sees a spike at :00 across all keys. If it's a protection limit, that spike is exactly what you were trying to prevent.</p>
          <p>A fixed window is still fine for coarse daily quotas, where a 2× burst in one second doesn't matter and one INCR per request is attractive. I would pick per limit, not use one algorithm everywhere.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Ask whether the limit protects capacity, enforces a contract, or stops abuse. The answer drives placement and accuracy.',
        'Token bucket is the default. Leaky bucket shapes output. Sliding counter is the scalable approximation.',
        'Make check-and-update atomic (Lua in Redis). Read-then-write across replicas is a race.',
        'Decide explicitly what happens when the limiter store fails. Local fallback limits beat both fail-open and fail-closed.',
        'Always return 429 + Retry-After. Protect services with concurrency limits and load shedding too.',
      ]} />
    </>
  )
}
