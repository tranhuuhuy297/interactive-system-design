import {
  ApiSpec, Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, MentalModel, References, SideBySide, Tabs, TLDR, Term,
} from '../components/ui'
import { ArrowDownUp, Braces, Cable, Gauge, KeyRound, Layers, Lock, Monitor, Network, Radar, Route, Server, Zap } from 'lucide-react'
import type { Reference } from '../components/ui'
import { NetworkHandshakeTimeline } from './demos/network-handshake-timeline'
import { NetworkRealtimeTransportSimulator } from './demos/network-realtime-transport-simulator'

const REFS: Reference[] = [
  { title: "RFC 9110: HTTP Semantics", source: "IETF", year: 2022, url: "https://www.rfc-editor.org/rfc/rfc9110", kind: "rfc" },
  { title: "RFC 9113: HTTP/2", source: "IETF", year: 2022, url: "https://www.rfc-editor.org/rfc/rfc9113", kind: "rfc" },
  { title: "RFC 9114: HTTP/3", source: "IETF", year: 2022, url: "https://www.rfc-editor.org/rfc/rfc9114", kind: "rfc" },
  { title: "RFC 9000: QUIC", source: "IETF", year: 2021, url: "https://www.rfc-editor.org/rfc/rfc9000", kind: "rfc" },
  { title: "RFC 8446: TLS 1.3", source: "IETF", year: 2018, url: "https://www.rfc-editor.org/rfc/rfc8446", kind: "rfc" },
  { title: "RFC 6455: The WebSocket Protocol", source: "IETF", year: 2011, url: "https://www.rfc-editor.org/rfc/rfc6455", kind: "rfc" },
  { title: "Server-sent events (HTML Living Standard)", source: "WHATWG", url: "https://html.spec.whatwg.org/multipage/server-sent-events.html", kind: "docs" },
  { title: "Introduction to gRPC", source: "gRPC Authors", url: "https://grpc.io/docs/what-is-grpc/introduction/", kind: "docs" },
  { title: "Learn GraphQL", source: "GraphQL Foundation", url: "https://graphql.org/learn/", kind: "docs" },
  { title: "The Idempotency-Key HTTP Header Field (Internet-Draft)", source: "IETF HTTPAPI WG", url: "https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/", kind: "rfc" },
]

export default function NetworkingApisProtocolsChapter() {
  return (
    <>
      <p>
        Every box on a system design diagram is connected by a network. The network is where latency, failures,
        and most surprises live.
      </p>
      <TLDR items={[
        'A fresh HTTPS request pays for DNS, a connection handshake, and TLS before any data flows. Reuse connections.',
        'HTTP/3 runs on QUIC over UDP, which avoids TCP’s head-of-line blocking and survives network switches.',
        'A common split: REST or GraphQL for clients, gRPC between internal services.',
        'Pick a real-time transport by direction: SSE for server push, WebSockets for two-way traffic.',
        'Cursor pagination, idempotency keys, and additive versioning keep APIs scalable.',
      ]} />
      <MentalModel id="networking" />
      <p>
        You don't need to recite RFCs. You do need to know what a request costs, which protocol fits which traffic
        pattern, and how API choices ripple into scalability.
      </p>

      <H2 id="lifecycle">The life of a request</H2>
      <p>
        Before your server sees a single byte, the client pays several{' '}
        <Term def="Round-trip time: how long a message takes to go to the other side and come back.">round trips (RTTs)</Term>{' '}
        to find the server and set up a secure connection.
      </p>
      <FlowDiagram steps={[
        { label: 'DNS', sub: 'name → IP (cached at many layers)' },
        { label: 'TCP / QUIC', sub: 'connection handshake' },
        { label: 'TLS', sub: 'keys, certificate check' },
        { label: 'HTTP', sub: 'request → response' },
        { label: 'Edge → origin', sub: 'CDN, LB, gateway, service' },
      ]} caption="Handshake round trips are paid before the first byte of your API response." />
      <NetworkHandshakeTimeline />
      <Callout kind="tip">
        This is why <strong>connection reuse</strong> (keep-alive, HTTP/2 multiplexing, gRPC channels, connection
        pools between services) matters so much. Handshakes are paid once and amortized over thousands of requests.
      </Callout>

      <H2 id="http-versions">HTTP/1.1 vs HTTP/2 vs HTTP/3</H2>
      <p>
        Each HTTP version mainly fixes how many requests can share one connection, and what happens when a packet
        is lost. The key problem is{' '}
        <Term def="When one slow or lost item at the front of a queue stalls everything behind it.">head-of-line blocking</Term>.
      </p>
      <SideBySide caption="Each version moves or removes head-of-line blocking" panels={[
        { title: 'HTTP/1.1', icon: Cable, points: [
          'TCP; one request at a time per connection',
          '- Browsers open ~6 connections to compensate',
          '- Head-of-line blocking at the HTTP layer',
          'Handshake: TCP + TLS',
        ] },
        { title: 'HTTP/2', icon: Layers, points: [
          '+ Many multiplexed streams on one TCP connection',
          '- One lost packet stalls all streams (TCP-level blocking)',
          'Handshake: TCP + TLS (1.3: 2 RTT total)',
        ] },
        { title: 'HTTP/3', icon: Zap, tone: 'good', points: [
          '+ QUIC over UDP; streams independent in transport',
          '+ Loss stalls only the affected stream',
          '+ 1 RTT handshake, 0-RTT on resumption',
          '+ Survives Wi-Fi ↔ cellular switches',
        ] },
      ]} />

      <H2 id="api-styles">REST vs gRPC vs GraphQL</H2>
      <p>These three styles solve different problems. Pick by who the client is and how it fetches data.</p>
      <SideBySide panels={[
        { title: 'REST (JSON/HTTP)', icon: Route, points: [
          '+ Human-readable JSON; OpenAPI optional',
          '+ Excellent HTTP caching (GET + CDN)',
          '- Over/under-fetching, chatty clients',
        ], verdict: 'Public APIs, resource CRUD' },
        { title: 'gRPC (Protobuf/HTTP/2)', icon: ArrowDownUp, points: [
          '+ Strict .proto schema with codegen',
          '+ Compact binary, streaming, low latency',
          '- Poor HTTP caching; browsers need gRPC-Web',
        ], verdict: 'Internal service-to-service' },
        { title: 'GraphQL', icon: Braces, points: [
          '+ Client picks exactly the fields it needs',
          '+ Strongly typed schema',
          '- Hard to cache; N+1 resolvers, unbounded queries',
        ], verdict: 'Client-driven aggregation' },
      ]} />
      <p>
        A common production shape uses <strong>REST or GraphQL at the edge</strong> for clients and <strong>gRPC
        internally</strong> between services. An API gateway or{' '}
        <Term def="Backend-for-frontend: a thin API layer built for one client type (web, iOS, TV) that aggregates internal services for it.">BFF</Term>{' '}
        translates between them.
      </p>

      <H2 id="realtime">Real-time: polling, long polling, SSE, WebSockets</H2>
      <p>
        When the server has news, how does the client find out? The options range from asking repeatedly to holding
        a connection open. <Term def="Server-Sent Events: a standard way for a server to stream messages to a browser over one long HTTP response.">SSE</Term>{' '}
        and WebSockets keep a connection open; polling does not.
      </p>
      <NetworkRealtimeTransportSimulator />
      <CompareTable columns={['Direction', 'Good for', 'Scaling concern']} rows={[
        { label: 'Short polling', cells: ['Client pull', 'Rare updates, simple infra', 'Wasted requests grow with client count'] },
        { label: 'Long polling', cells: ['Client pull (held)', 'Fallback when streaming is blocked', 'Many held HTTP requests; reconnect storms'] },
        { label: 'SSE', cells: ['Server → client', 'Feeds, notifications, LLM token streams', 'Long-lived connections through proxies'] },
        { label: 'WebSocket', cells: ['Bidirectional', 'Chat, collaboration, games', 'Stateful connections: sticky routing, graceful drain on deploy'] },
        { label: 'WebTransport', cells: ['Bidirectional over HTTP/3', 'Low-latency media and games (emerging)', 'Newer, with less mature ecosystem support'] },
      ]} />

      <H2 id="api-design">API design that scales</H2>
      <p>Three API choices are hard to change once clients depend on them: pagination, retries, and versioning.</p>
      <Tabs items={[
        { label: 'Pagination', content: (
          <>
            <SideBySide panels={[
              { title: 'Offset', icon: Gauge, tone: 'bad', points: [
                '+ Simple: ?offset=10000&limit=20',
                '- Deep pages slow: the DB walks past skipped rows',
                '- Results shift when items are inserted',
              ] },
              { title: 'Cursor', icon: KeyRound, tone: 'good', points: [
                '+ Encodes the last-seen sort key',
                '+ Fast at any depth',
                '+ Stable under concurrent writes',
              ] },
            ]} />
            <ApiSpec endpoints={[
              { method: 'GET', path: '/v1/posts?limit=20&cursor=eyJpZCI6OTg3fQ', desc: 'Cursor = opaque, base64-encoded last (created_at, id).', returns: '{ items: [...], nextCursor }' },
            ]} />
          </>
        ) },
        { label: 'Idempotency', content: (
          <>
            <p>
              Networks retry, so your API will see duplicates. GET, PUT, and DELETE are idempotent by definition. For POSTs
              with side effects (payments, orders), accept an <code>Idempotency-Key</code> header, store the first
              result keyed by it, and replay that result on retries.
            </p>
            <CodeBlock lang="bash" title="safe retry" code={`
curl -X POST https://api.example.com/v1/payments \\
  -H "Idempotency-Key: 7c1f0e8a-5b2d-4a51-9a0e-3d7b2c1a9f44" \\
  -d '{"amount": 4200, "currency": "USD"}'
# Same key again → same response, charge executed exactly once`} />
          </>
        ) },
        { label: 'Versioning', content: (
          <ul>
            <li><strong>URL versioning</strong> (<code>/v1/</code>): explicit and cache-friendly. The most common choice for public APIs.</li>
            <li><strong>Header versioning</strong>: cleaner URLs, but harder to test and to cache correctly.</li>
            <li><strong>Additive evolution</strong>: add optional fields, never repurpose or remove them without a deprecation window. Protobuf field numbers make this explicit.</li>
          </ul>
        ) },
      ]} />

      <H2 id="gateway">API gateways and the edge</H2>
      <p>
        An API gateway handles concerns every service needs, so services don't each reimplement them:
      </p>
      <FlowDiagram caption="Cross-cutting concerns at the edge, business logic behind it" steps={[
        { label: 'Client', icon: Monitor },
        { label: 'TLS + auth', sub: 'terminate, verify', icon: Lock },
        { label: 'Rate limit', sub: 'per key / tenant', icon: Gauge },
        { label: 'Route', sub: 'to the right service', icon: Network },
        { label: 'Observe', sub: 'logs, metrics, traces', icon: Radar },
        { label: 'Services', icon: Server },
      ]} />
      <p>
        The costs are an extra hop and a shared component that must be highly available. Keep business logic out of
        it, or it becomes the bottleneck of a{' '}
        <Term def="Services that are deployed separately but so tightly coupled that they must change together.">distributed monolith</Term>.
      </p>

      <H2 id="staff">Staff lens</H2>
      <p>At staff level, protocol and API choices are judged by what they cost to operate for years.</p>
      <Callout kind="staff">
        <ul>
          <li><strong>Protocol choice is an operational choice.</strong> WebSockets turn a stateless fleet into a stateful one. Plan connection draining on deploy, per-node connection limits, and reconnect jitter to avoid thundering herds.</li>
          <li><strong>API contracts outlive implementations.</strong> Pagination style, ID formats, and error semantics are close to irreversible once external clients depend on them.</li>
          <li><strong>Timeouts and retries are part of the API.</strong> Every client needs a deadline, retries with jittered backoff, and idempotency, or one slow dependency amplifies into an outage.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="For a live sports score app, would you use polling, SSE, or WebSockets?"
        senior={<p>WebSockets give real-time updates with low latency. Polling wastes requests, and SSE is also an option since updates flow one way.</p>}
        staff={<>
          <p>Traffic is <strong>one-directional and fan-out heavy</strong>, with millions of viewers of the same match. So I'd pick <strong>SSE</strong>: plain HTTP, it works through proxies and CDNs that support streaming, reconnects automatically, and needs no bidirectional protocol handling. WebSockets add stateful complexity for no benefit here.</p>
          <p>The harder part is fan-out: a pub/sub layer (for example Redis or Kafka feeding edge connection servers) that sends each score change to every connection holder.</p>
          <p>I'd also keep a short-poll fallback against a CDN-cached JSON endpoint with a 1–2s TTL for clients that can't stream. That is often a cheaper way to reach millions of passive viewers.</p>
        </>}
        followUps={['How do you handle 5M concurrent connections?', 'What happens to connections during a deploy?']}
      />
      <InterviewQuestion
        q="Why might gRPC be a poor choice for a public API?"
        senior={<p>Browsers don't natively support gRPC, and binary payloads are harder to debug. REST with JSON is more universally accessible.</p>}
        staff={<>
          <p>Beyond browser support (gRPC-Web needs a proxy), a public API's value is in <strong>reach and tooling</strong>: curl-ability, familiar HTTP caching semantics, and easy SDK generation in every language. gRPC gives up CDN caching and makes third-party onboarding harder.</p>
          <p>gRPC shines internally, where you control both sides: strict schemas, streaming, efficient binary encoding, and deadline propagation. I'd often use both, with REST at the edge and gRPC behind the gateway.</p>
        </>}
        followUps={['How do you evolve a protobuf schema without breaking clients?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'A cold HTTPS request pays DNS, transport, and TLS round trips first. Reuse connections everywhere.',
        'HTTP/2 multiplexes over TCP. HTTP/3 (QUIC) avoids TCP head-of-line blocking and handles network switches.',
        'REST or GraphQL at the edge, gRPC between services is a common and defensible split.',
        'Pick real-time transports by direction and fan-out: SSE for server push, WebSockets for bidirectional.',
        'Cursor pagination, idempotency keys, and additive versioning are what make an API scale.',
      ]} />
    </>
  )
}
