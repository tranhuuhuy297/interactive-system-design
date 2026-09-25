import { useMemo, useState } from 'react'
import { ArchitectureDiagram, Slider } from '../ui'
import type { ArchEdge, ArchFlow, ArchNode } from '../ui'

// Toy capacity model: numbers are illustrative, chosen to make each bottleneck appear in turn.
const APP_RPS_PER_NODE = 2_000
const DB_SAFE_QPS = 5_000

interface Stage { nodes: ArchNode[]; edges: ArchEdge[]; flow: ArchFlow; note: string }

function stageFor(rps: number): Stage {
  const apps = Math.max(1, Math.ceil(rps / APP_RPS_PER_NODE))
  if (rps < 1_000) {
    return {
      note: 'One box runs everything. Fine until it isn’t.',
      nodes: [
        { id: 'c', label: 'Users', kind: 'client', x: 10, y: 50 },
        { id: 'a', label: 'Web + app', sub: '1 server', kind: 'service', x: 50, y: 50 },
        { id: 'd', label: 'Database', sub: 'same host', kind: 'db', x: 86, y: 50 },
      ],
      edges: [{ from: 'c', to: 'a' }, { from: 'a', to: 'd' }],
      flow: { name: 'read', path: ['c', 'a', 'd'] },
    }
  }
  if (rps < 20_000) {
    return {
      note: 'Stateless app tier behind a load balancer; DB split out.',
      nodes: [
        { id: 'c', label: 'Users', kind: 'client', x: 10, y: 50 },
        { id: 'lb', label: 'LB', kind: 'lb', x: 32, y: 50 },
        { id: 'a', label: 'App', sub: `${apps} nodes`, kind: 'service', x: 55, y: 50 },
        { id: 'd', label: 'Primary', kind: 'db', x: 86, y: 25 },
        { id: 'r', label: 'Replica', kind: 'db', x: 86, y: 75 },
      ],
      edges: [{ from: 'c', to: 'lb' }, { from: 'lb', to: 'a' }, { from: 'a', to: 'd' }, { from: 'a', to: 'r' }, { from: 'd', to: 'r', async: true }],
      flow: { name: 'read', path: ['c', 'lb', 'a', 'r'] },
    }
  }
  if (rps < 200_000) {
    return {
      note: 'Cache absorbs hot reads; CDN serves static assets.',
      nodes: [
        { id: 'c', label: 'Users', kind: 'client', x: 10, y: 55 },
        { id: 'cdn', label: 'CDN', kind: 'cdn', x: 30, y: 14 },
        { id: 'lb', label: 'LB', kind: 'lb', x: 30, y: 55 },
        { id: 'a', label: 'App', sub: `${apps} nodes`, kind: 'service', x: 52, y: 55 },
        { id: 'k', label: 'Redis', kind: 'cache', x: 74, y: 14 },
        { id: 'd', label: 'Primary', kind: 'db', x: 88, y: 50 },
        { id: 'r', label: 'Replicas', sub: '×3', kind: 'db', x: 80, y: 86 },
      ],
      edges: [{ from: 'c', to: 'cdn' }, { from: 'c', to: 'lb' }, { from: 'lb', to: 'a' }, { from: 'a', to: 'k' }, { from: 'a', to: 'd' }, { from: 'a', to: 'r' }, { from: 'd', to: 'r', async: true }],
      flow: { name: 'read', path: ['c', 'lb', 'a', 'k'] },
    }
  }
  return {
    note: 'Sharded storage, async work via queues, multi-region edge.',
    nodes: [
      { id: 'c', label: 'Users', kind: 'client', x: 10, y: 50 },
      { id: 'cdn', label: 'CDN', kind: 'cdn', x: 30, y: 14 },
      { id: 'lb', label: 'GeoLB', kind: 'lb', x: 30, y: 50 },
      { id: 'a', label: 'App', sub: `${apps} nodes`, kind: 'service', x: 52, y: 50 },
      { id: 'k', label: 'Cache', kind: 'cache', x: 74, y: 14 },
      { id: 'q', label: 'Kafka', kind: 'queue', x: 52, y: 86 },
      { id: 'w', label: 'Workers', kind: 'worker', x: 80, y: 86 },
      { id: 'd', label: 'Shards', sub: '×16', kind: 'db', x: 88, y: 50 },
    ],
    edges: [{ from: 'c', to: 'cdn' }, { from: 'c', to: 'lb' }, { from: 'lb', to: 'a' }, { from: 'a', to: 'k' }, { from: 'a', to: 'd' }, { from: 'a', to: 'q', async: true }, { from: 'q', to: 'w' }, { from: 'w', to: 'd' }],
    flow: { name: 'read', path: ['c', 'lb', 'a', 'k'] },
  }
}

export function HeroTrafficSimulator() {
  const [exp, setExp] = useState(2.3) // log10(rps)
  const rps = Math.round(10 ** exp)
  const stage = useMemo(() => stageFor(rps), [rps])
  const cacheHit = rps < 20_000 ? 0 : 0.9
  const shards = rps >= 200_000 ? 16 : 1
  const dbQps = Math.round((rps * (1 - cacheHit) * 0.3) / shards) // ~30% of misses reach a primary
  const dbLoad = Math.min(1, dbQps / DB_SAFE_QPS)

  return (
    <div className="traffic">
      <Slider label="Traffic" min={2} max={6} step={0.05} value={exp} onChange={setExp}
        format={() => `${rps.toLocaleString('en-US')} req/s`} />
      <ArchitectureDiagram key={stage.note} nodes={stage.nodes} edges={stage.edges} flows={[stage.flow]} height={260} />
      <div className="traffic__stats">
        <div><span>App nodes</span><strong>{Math.max(1, Math.ceil(rps / APP_RPS_PER_NODE))}</strong></div>
        <div><span>Cache hit</span><strong>{Math.round(cacheHit * 100)}%</strong></div>
        <div><span>{shards > 1 ? 'Per DB shard' : 'Primary DB'}</span>
          <strong className={dbLoad > 0.8 ? 'is-hot' : ''}>{dbQps.toLocaleString('en-US')} qps</strong>
          <i style={{ ['--load' as string]: dbLoad }} />
        </div>
      </div>
      <p className="traffic__note">{stage.note} <em>Toy model, illustrative numbers.</em></p>
    </div>
  )
}
