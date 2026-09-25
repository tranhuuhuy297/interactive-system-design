import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode } from '../components/ui'
import { LboardShardingDemo } from './demos/lboard-sharding-demo'
import { LboardSortedSetDemo } from './demos/lboard-sorted-set-demo'

const NODES: ArchNode[] = [
  { id: 'client', label: 'Game client', kind: 'client', x: 10, y: 50 },
  { id: 'game', label: 'Game server', sub: 'authoritative', kind: 'service', x: 28, y: 25,
    detail: 'Decides match outcomes. Clients never report their own scores, which is the first line of anti-cheat.' },
  { id: 'lb', label: 'API gateway', kind: 'lb', x: 28, y: 75 },
  { id: 'svc', label: 'Leaderboard service', kind: 'service', x: 51, y: 50,
    detail: 'Stateless. Translates API calls to sorted-set commands and hydrates user IDs with profile data (name, avatar) from a cache.' },
  { id: 'redis', label: 'Redis sorted set', sub: 'lb:{yyyy-mm}', kind: 'cache', x: 75, y: 25,
    detail: 'A skiplist plus hash table: ZINCRBY, ZREVRANK and ZREVRANGE are O(log N). Run it with replicas and AOF. It is the serving store, not the source of truth.' },
  { id: 'db', label: 'Score history DB', sub: 'durable', kind: 'db', x: 75, y: 78,
    detail: 'An append-only record of match results (who, when, points). Rebuild Redis from it if the cache is lost, and use it for audits and cheat investigations.' },
  { id: 'q', label: 'Score events', sub: 'Kafka', kind: 'queue', x: 51, y: 85,
    detail: 'Decouples match results from leaderboard writes. It absorbs tournament-end spikes and lets several consumers (leaderboard, analytics, anti-cheat) share one event.' },
  { id: 'profile', label: 'Profile cache', kind: 'cache', x: 90, y: 50 },
]

const EDGES: ArchEdge[] = [
  { from: 'client', to: 'game' }, { from: 'client', to: 'lb' }, { from: 'lb', to: 'svc' },
  { from: 'game', to: 'q', async: true, label: 'match result' }, { from: 'q', to: 'svc', async: true },
  { from: 'svc', to: 'redis' }, { from: 'q', to: 'db', async: true }, { from: 'svc', to: 'profile' },
]

export default function LeaderboardChapter() {
  return (
    <>
      <p>
        A leaderboard is the rare prompt where one data structure <strong>is</strong> most of the answer. The
        interview tests whether you know <em>why</em> a sorted set fits, where it stops scaling, and what happens to
        rank queries once you are forced to shard.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Show the global top 10', "Show a player's own rank and the players around them", 'Scores update in real time after each match', 'Monthly leaderboard that resets']}
        nonFunctional={['Rank visible within ~1 s of a match ending', 'Handles tournament-end spikes', 'Scores are tamper-proof']}
        outOfScope={['Matchmaking', 'Friends-only boards (discussed as an extension)']}
      />

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['25M monthly players, 5M daily active (illustrative)', '10 matches per DAU per day', 'Peak = 5× average']}
        rows={[
          { label: 'Score writes', math: '5M × 10 / 86,400', result: '≈ 580/s' },
          { label: 'Peak writes', math: '580 × 5', result: '≈ 3K/s' },
          { label: 'Entries in set', math: '25M members', result: '25M' },
          { label: 'Memory', math: '25M × ~100 B (member, score, skiplist + hash overhead)', result: '≈ 2.5 GB' },
        ]}
      />
      <p>A single Redis primary handles tens of thousands of simple operations per second and 2.5 GB of memory comfortably. <strong>Don't shard until the numbers force you to.</strong> Say that, then show you know how to shard anyway.</p>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/internal/v1/scores', desc: 'Called by the game server only, never the client. Idempotent per matchId.', body: '{ matchId, userId, points }' },
        { method: 'GET', path: '/v1/leaderboard/top?limit=10', desc: 'Top N with profile data.', returns: '[{ rank, userId, name, score }]' },
        { method: 'GET', path: '/v1/leaderboard/users/{id}?around=2', desc: 'Rank plus neighbours.', returns: '{ rank, score, around: [...] }' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={380}
        caption="Redis serves reads. Match history is the durable source of truth."
        flows={[
          { name: 'Score update', path: ['game', 'q', 'svc', 'redis'], steps: ['Game server emits a match result', 'Consumer receives it (deduped by matchId)', 'ZINCRBY lb:2026-09 points user'] },
          { name: 'Top 10', path: ['client', 'lb', 'svc', 'redis'], steps: ['Client requests the board', 'Gateway → leaderboard service', 'ZREVRANGE lb:2026-09 0 9 WITHSCORES, then hydrate profiles'] },
        ]} />

      <H2 id="sorted-set">5 · Deep dive: why a sorted set</H2>
      <p>
        A relational <code>ORDER BY score DESC</code> handles top-10 fine with an index. The trouble is
        <strong> “what is my rank?”</strong>: <code>SELECT COUNT(*) WHERE score &gt; mine</code> is O(N) per request and
        does not survive millions of players checking their rank after every match. A skiplist keeps span counts,
        which makes rank O(log N).
      </p>
      <LboardSortedSetDemo />
      <CodeBlock lang="bash" title="the whole data path" code={`
ZINCRBY  lb:2026-09 25 user:8812          # after a match
ZREVRANGE lb:2026-09 0 9 WITHSCORES       # top 10
ZREVRANK lb:2026-09 user:8812             # my rank (0-based)
ZREVRANGE lb:2026-09 140 144 WITHSCORES   # around me (rank 142 ± 2)
EXPIREAT lb:2026-09 <end of Oct>          # old boards age out`} />
      <Callout kind="tip">
        <strong>Ties</strong>: Redis breaks ties lexicographically by member, which feels arbitrary to players. To
        rank “first to reach the score” higher, encode time into the score:
        <code> score = points × 2³² + (MAX_TS − achievedAt)</code>. Keep it within 2⁵³ so the double stays exact, which caps points at about 2²¹. A plain ZINCRBY no longer works on this encoding: read, re-encode the new total with the new timestamp, and write it back in a small Lua script so the update stays atomic.
      </Callout>

      <H2 id="sharding">6 · Deep dive: when one node is not enough</H2>
      <LboardShardingDemo />
      <CompareTable
        columns={['Hash by user', 'Range by score', 'Approximate (buckets)']}
        rows={[
          { label: 'Write balance', cells: ['Even', 'Skewed toward active and top players', 'Even'] },
          { label: 'Top-K', cells: ['Scatter-gather K from each shard', 'Read the top shard', 'Exact top-K kept separately'] },
          { label: 'My rank', cells: ['Sum of counts across all shards (ZCOUNT)', 'Higher shards count + local rank', 'Percentile from a histogram'] },
          { label: 'Rebalancing', cells: ['Rare', 'Players migrate as scores grow', 'None'] },
          { label: 'Fits', cells: ['Huge member counts', 'Well-known score distribution', '“You are in the top 3%” is good enough'] },
        ]}
      />
      <p>
        At very large N, most players don't need an exact rank. <strong>Exact top-K + approximate percentile for
        everyone else</strong> is often the pragmatic, cheap answer. Offer it as a product trade-off.
      </p>

      <H2 id="data-model">7 · Data model & durability</H2>
      <CodeBlock lang="ts" title="durable record (source of truth)" code={`
// match_results(match_id, user_id, points, created_at, PRIMARY KEY (match_id, user_id))
// Redis rebuild: for each month, SUM(points) GROUP BY user_id → ZADD in batches
// Monthly board key: lb:{yyyy-mm} — reset is just "start writing a new key"`} />

      <H2 id="staff">8 · Staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Anti-cheat is architecture</strong>: scores only come from the authoritative game server over an internal API. Keep match history so outliers can be audited and removed (ZREM plus a history flag).</li>
          <li><strong>Friends leaderboards</strong>: a global structure doesn't help. Read friends' scores with ZMSCORE on the global set and sort client-side. Friend lists are small, so that is O(F).</li>
          <li><strong>Regional vs global</strong>: separate keys per region, plus a global board updated from the same event stream.</li>
          <li><strong>Blast radius</strong>: Redis is a cache of truth, so recovery means replaying events or rebuilding from history. State the rebuild time as an RTO.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Why not just use a SQL table with an index on score?"
        senior={<p>Top-10 works with an index, but computing a user's rank needs COUNT(*) of higher scores, which is a scan per request. Redis sorted sets give O(log N) rank.</p>}
        staff={<>
          <p>A B-tree index gives ordered access but no <strong>order statistics</strong>. Rank still means counting index entries above you, which is O(N − rank). A skiplist with span counts, like Redis ZSET, answers rank in O(log N).</p>
          <p>SQL still earns its place as the durable history. I'd keep both: Redis as the serving index, SQL or a log as the truth, plus a documented rebuild path. At small scale (100K players), SQL alone is fine, and I'd say so.</p>
        </>}
        followUps={['How do you handle ties fairly?', 'What if Redis loses data?', 'How do you reset monthly without downtime?']}
      />
      <InterviewQuestion
        q="You have 500M players and a single Redis node can't hold them. How do you answer 'what's my rank'?"
        senior={<p>Shard by user hash. For a user's rank, ask each shard how many users have a higher score (ZCOUNT) and sum the counts.</p>}
        staff={<>
          <p>Hash sharding with a ZCOUNT fan-out works and is exact, but every rank query hits every shard. I'd push back on the requirement: <strong>exact ranks matter for the top ~10K; everyone else needs a percentile.</strong></p>
          <p>So: an exact top-K set fed by the event stream, plus a score histogram (fixed buckets, updated incrementally) to answer “top 4%” in O(buckets). That cuts cost by orders of magnitude and keeps the UX. If product insists on exact ranks, range-shard by score with a routing table and accept the migrations.</p>
        </>}
      />

      <KeyTakeaways items={[
        'Sorted sets give O(log N) updates, ranks and ranges, which is exactly what leaderboards need.',
        'The numbers usually fit one Redis node. Say so before sharding.',
        'Scores come from the authoritative server, and history is kept durably for audits and rebuilds.',
        'Hash sharding balances writes but fans out reads. Range sharding makes top-K cheap but causes migrations and hot shards.',
        'At huge scale, pair an exact top-K with approximate percentiles and frame it as a product trade-off.',
      ]} />
    </>
  )
}
