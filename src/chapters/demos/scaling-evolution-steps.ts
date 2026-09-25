import type { ArchEdge, ArchFlow, ArchNode } from '../../components/ui'

export interface EvolutionStep {
  title: string
  users: string
  bottleneck: string
  change: string
  tradeoff: string
  nodes: ArchNode[]
  edges: ArchEdge[]
  flow: ArchFlow
}

const n = (id: string, label: string, kind: ArchNode['kind'], x: number, y: number, sub?: string): ArchNode => ({ id, label, kind, x, y, sub })
const e = (from: string, to: string, label?: string, async?: boolean): ArchEdge => ({ from, to, label, async })

export const EVOLUTION: EvolutionStep[] = [
  {
    title: 'Single server', users: '~1K users',
    bottleneck: 'None yet. Ship the product.',
    change: 'Web app, database, and static files all live on one machine. DNS points straight at it.',
    tradeoff: 'Cheapest and simplest, but a single point of failure. Web and DB fight over the same CPU and RAM.',
    nodes: [n('c', 'Client', 'client', 10, 55), n('dns', 'DNS', 'external', 38, 18), n('s', 'Server', 'service', 62, 55, 'web + DB + files')],
    edges: [e('c', 'dns', 'resolve'), e('c', 's', 'HTTP')],
    flow: { name: 'Request', path: ['c', 'dns', 'c', 's'] },
  },
  {
    title: 'Separate the database', users: '~10K users',
    bottleneck: 'App and DB compete for resources. You cannot scale one without the other.',
    change: 'Move the database to its own machine. The web tier and data tier now scale independently.',
    tradeoff: 'Adds a network hop (~0.5 ms in-DC) in exchange for independent sizing and tuning.',
    nodes: [n('c', 'Client', 'client', 8, 55), n('w', 'Web server', 'service', 45, 55), n('db', 'Database', 'db', 82, 55, 'SQL')],
    edges: [e('c', 'w'), e('w', 'db')],
    flow: { name: 'Request', path: ['c', 'w', 'db'] },
  },
  {
    title: 'Load balancer + horizontal web tier', users: '~100K users',
    bottleneck: 'One web server maxes out its CPU, and a deploy or crash means downtime.',
    change: 'Put a load balancer in front of N identical web servers. Clients only ever see the LB address.',
    tradeoff: 'The LB is new infrastructure (use a managed or HA pair). Servers must not keep local state.',
    nodes: [n('c', 'Client', 'client', 6, 50), n('lb', 'Load balancer', 'lb', 28, 50), n('w1', 'Web 1', 'service', 54, 25), n('w2', 'Web 2', 'service', 54, 75), n('db', 'Database', 'db', 84, 50)],
    edges: [e('c', 'lb'), e('lb', 'w1'), e('lb', 'w2'), e('w1', 'db'), e('w2', 'db')],
    flow: { name: 'Request', path: ['c', 'lb', 'w2', 'db'] },
  },
  {
    title: 'Database replication', users: '~500K users',
    bottleneck: 'Reads overwhelm the single database, and its failure takes everything down.',
    change: 'Use a primary for writes and read replicas for reads, with async replication. Promote a replica on failure.',
    tradeoff: 'Replica lag means reads can be stale. Read-your-writes needs routing tricks (e.g. read your own data from the primary).',
    nodes: [n('c', 'Client', 'client', 6, 50), n('lb', 'Load balancer', 'lb', 26, 50), n('w1', 'Web 1', 'service', 50, 25), n('w2', 'Web 2', 'service', 50, 75), n('p', 'Primary', 'db', 84, 22, 'writes'), n('r', 'Replica', 'db', 84, 78, 'reads')],
    edges: [e('c', 'lb'), e('lb', 'w1'), e('lb', 'w2'), e('w1', 'p', 'write'), e('w2', 'r', 'read'), e('w1', 'r'), e('p', 'r', 'replicate', true)],
    flow: { name: 'Read', path: ['c', 'lb', 'w2', 'r'] },
  },
  {
    title: 'Cache tier', users: '~1M users',
    bottleneck: 'The same hot data is read from disk over and over, so DB latency and cost climb.',
    change: 'Add an in-memory cache (Redis/Memcached) using cache-aside. Hot reads never touch the DB.',
    tradeoff: 'Invalidation and staleness become your problem, and a cold cache after restart can stampede the DB.',
    nodes: [n('c', 'Client', 'client', 6, 50), n('lb', 'Load balancer', 'lb', 24, 50), n('w1', 'Web 1', 'service', 46, 28), n('w2', 'Web 2', 'service', 46, 72), n('ca', 'Cache', 'cache', 72, 12, 'Redis'), n('p', 'Primary', 'db', 86, 45), n('r', 'Replica', 'db', 86, 85)],
    edges: [e('c', 'lb'), e('lb', 'w1'), e('lb', 'w2'), e('w1', 'ca'), e('w2', 'ca'), e('w1', 'p'), e('w2', 'r'), e('p', 'r', undefined, true)],
    flow: { name: 'Cache hit', path: ['c', 'lb', 'w1', 'ca'] },
  },
  {
    title: 'CDN for static & media', users: '~2M users',
    bottleneck: 'Images, JS, and video eat bandwidth, and distant users see slow page loads.',
    change: 'Serve static assets from a CDN edge close to users. The origin only serves misses.',
    tradeoff: 'Costs money per GB, needs cache-busting (versioned URLs), and gives less control over invalidation timing.',
    nodes: [n('c', 'Client', 'client', 6, 50), n('cdn', 'CDN edge', 'cdn', 28, 14), n('lb', 'Load balancer', 'lb', 28, 66), n('w', 'Web tier', 'service', 52, 66), n('ca', 'Cache', 'cache', 76, 30), n('db', 'DB cluster', 'db', 84, 76), n('obj', 'Object store', 'storage', 62, 14, 'origin')],
    edges: [e('c', 'cdn', 'assets'), e('cdn', 'obj', 'miss'), e('c', 'lb', 'API'), e('lb', 'w'), e('w', 'ca'), e('w', 'db')],
    flow: { name: 'Asset', path: ['c', 'cdn', 'obj'] },
  },
  {
    title: 'Stateless web tier', users: '~5M users',
    bottleneck: 'Sessions stored in server memory tie users to one box. Autoscaling and deploys log people out.',
    change: 'Move session and user state to a shared store (Redis/DB). Any server can handle any request, so you can autoscale freely.',
    tradeoff: 'Every request reads shared state (one more hop), and the session store must be highly available.',
    nodes: [n('c', 'Client', 'client', 6, 50), n('lb', 'Load balancer', 'lb', 26, 50), n('w1', 'Web', 'service', 50, 22), n('w2', 'Web', 'service', 50, 50), n('w3', 'Web', 'service', 50, 78, 'autoscaled'), n('ss', 'Session store', 'cache', 80, 22), n('db', 'DB cluster', 'db', 82, 72)],
    edges: [e('c', 'lb'), e('lb', 'w1'), e('lb', 'w2'), e('lb', 'w3'), e('w1', 'ss'), e('w3', 'ss'), e('w2', 'db'), e('w3', 'db')],
    flow: { name: 'Request', path: ['c', 'lb', 'w3', 'ss'] },
  },
  {
    title: 'Multiple data centers / regions', users: '~10M users, global',
    bottleneck: 'A whole-region outage means total downtime, and users on other continents pay 150 ms+ per round trip.',
    change: 'Use GeoDNS or anycast to route users to the nearest region. Replicate data across regions and fail over when one dies.',
    tradeoff: 'Cross-region replication means lag or conflicts. You must choose active-passive or active-active and accept the consistency cost.',
    nodes: [n('c', 'Client', 'client', 6, 50), n('g', 'GeoDNS', 'external', 24, 50), n('le', 'LB · east', 'lb', 46, 22), n('we', 'Web · east', 'service', 66, 22), n('de', 'DB · east', 'db', 88, 22), n('lw', 'LB · west', 'lb', 46, 78), n('ww', 'Web · west', 'service', 66, 78), n('dw', 'DB · west', 'db', 88, 78)],
    edges: [e('c', 'g'), e('g', 'le'), e('g', 'lw'), e('le', 'we'), e('we', 'de'), e('lw', 'ww'), e('ww', 'dw'), e('de', 'dw', 'async repl', true)],
    flow: { name: 'West user', path: ['c', 'g', 'lw', 'ww', 'dw'] },
  },
  {
    title: 'Message queue & async workers', users: '~20M users',
    bottleneck: 'Slow work (emails, thumbnails, fan-out) blocks requests, and traffic spikes cascade into failures.',
    change: 'Web servers enqueue jobs and return immediately. Worker fleets consume and scale on queue depth.',
    tradeoff: 'Eventual completion: you need retries, idempotent consumers, dead-letter queues, and lag monitoring.',
    nodes: [n('c', 'Client', 'client', 6, 50), n('w', 'Web tier', 'service', 30, 50), n('q', 'Queue', 'queue', 56, 50, 'Kafka / SQS'), n('k', 'Workers', 'worker', 80, 25), n('obj', 'Object store', 'storage', 84, 78), n('db', 'DB', 'db', 30, 85)],
    edges: [e('c', 'w'), e('w', 'db'), e('w', 'q', 'enqueue', true), e('q', 'k', 'consume', true), e('k', 'obj')],
    flow: { name: 'Upload', path: ['c', 'w', 'q', 'k', 'obj'] },
  },
  {
    title: 'Shard the database', users: '~50M+ users',
    bottleneck: 'Write volume or data size exceeds one primary. Vertical scaling hits its ceiling.',
    change: 'Partition data by a shard key (e.g. user_id) across many primaries. A routing layer maps keys to shards.',
    tradeoff: 'Cross-shard joins and transactions get hard, celebrities cause hot shards, and resharding is a project.',
    nodes: [n('c', 'Client', 'client', 6, 50), n('w', 'Web tier', 'service', 28, 50), n('rt', 'Shard router', 'service', 52, 50, 'hash(user_id)'), n('s1', 'Shard 0', 'db', 84, 15), n('s2', 'Shard 1', 'db', 84, 50), n('s3', 'Shard 2', 'db', 84, 85)],
    edges: [e('c', 'w'), e('w', 'rt'), e('rt', 's1'), e('rt', 's2'), e('rt', 's3')],
    flow: { name: 'user 42', path: ['c', 'w', 'rt', 's3'] },
  },
  {
    title: 'Observability & automation', users: 'any scale',
    bottleneck: 'With hundreds of machines you cannot SSH your way to the root cause, and deploys are scary.',
    change: 'Add metrics, logs, and distributed traces with SLO-based alerts, plus CI/CD with canaries and automated rollback.',
    tradeoff: 'Telemetry costs real money (cardinality!) and needs ownership, but you cannot operate at scale without it.',
    nodes: [n('svc', 'Services', 'service', 16, 50), n('m', 'Metrics', 'db', 46, 18, 'Prometheus-style'), n('l', 'Logs', 'storage', 46, 50), n('t', 'Traces', 'search', 46, 82, 'OpenTelemetry'), n('a', 'Alerting', 'external', 80, 30, 'SLO burn'), n('d', 'Dashboards', 'client', 80, 72)],
    edges: [e('svc', 'm', undefined, true), e('svc', 'l', undefined, true), e('svc', 't', undefined, true), e('m', 'a'), e('m', 'd'), e('t', 'd'), e('l', 'd')],
    flow: { name: 'Signal', path: ['svc', 'm', 'a'] },
  },
]
