import { useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import {
  LOGICAL_SHARDS, SEQ_MOD, burstDuplicates, decodeId, hostForShard, makeId, shardForUser, toBits,
} from './episode-instagram-id-model'
import './episode-instagram-demos.css'

type Hosts = '2' | '4' | '8' | '16'
interface Post { id: bigint; userId: number }

export function EpisodeInstagramIdDemo() {
  const [userId, setUserId] = useState(31337)
  const [hosts, setHosts] = useState<Hosts>('4')
  const [posts, setPosts] = useState<Post[]>([])
  const [seqs, setSeqs] = useState<Record<number, number>>({})
  const [burst, setBurst] = useState<number | null>(null)

  const shard = shardForUser(userId)
  const host = hostForShard(shard, Number(hosts))
  const latest = posts[0]
  const bits = latest ? toBits(latest.id) : null
  const decoded = latest ? decodeId(latest.id) : null

  const create = () => {
    const seq = seqs[shard] ?? 0
    setSeqs({ ...seqs, [shard]: (seq + 1) % SEQ_MOD })
    setPosts([{ id: makeId(Date.now(), shard, seq), userId }, ...posts].slice(0, 6))
  }
  const reset = () => { setUserId(31337); setHosts('4'); setPosts([]); setSeqs({}); setBurst(null) }

  return (
    <DemoFrame title="Generate IDs inside the database: time | shard | sequence" onReset={reset}
      hint="Each post gets its ID on the author's logical shard. The ID alone tells you when it was made and where it lives.">
      <div className="ig-id">
        <div className="demo-controls">
          <label className="ig-id__field">
            <span className="demo-label">Author user ID</span>
            <input type="number" min={0} value={userId} onChange={(e) => setUserId(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <div>
            <div className="demo-label">Physical Postgres hosts</div>
            <Segmented label="Physical hosts" value={hosts} onChange={setHosts} options={['2', '4', '8', '16'] as const} />
          </div>
          <div className="ig-id__route">
            <span>user {userId} % {LOGICAL_SHARDS}</span>
            <strong>logical shard {shard}</strong>
            <span>→ host {host + 1} of {hosts}</span>
          </div>
          <div className="ig-id__actions">
            <button className="btn btn--primary btn--sm" onClick={create}>Create post</button>
            <button className="btn btn--secondary btn--sm" onClick={() => setBurst(burstDuplicates(Date.now(), shard, 0, 1100))}>
              1,100 posts in 1 ms
            </button>
          </div>
          {burst !== null && (
            <p className={`ig-id__burst ${burst ? 'is-bad' : ''}`} role="status">
              The 10-bit sequence wraps after {SEQ_MOD.toLocaleString('en-US')} per ms per shard, which produced {burst} duplicate IDs. Real systems wait for the next millisecond instead.
            </p>
          )}
        </div>

        <div className="ig-id__out">
          {bits && decoded ? (
            <>
              <div className="ig-id__bits mono" aria-label="ID bits">
                <span className="ig-id__seg ig-id__seg--time" title="41 bits: ms since epoch">{bits.time}</span>
                <span className="ig-id__seg ig-id__seg--shard" title="13 bits: logical shard">{bits.shard}</span>
                <span className="ig-id__seg ig-id__seg--seq" title="10 bits: sequence">{bits.seq}</span>
              </div>
              <dl className="ig-id__decode">
                <div><dt>Time (41 bits)</dt><dd>{new Date(decoded.ms).toISOString().replace('T', ' ').slice(0, 23)}</dd></div>
                <div><dt>Shard (13 bits)</dt><dd>{decoded.shard}</dd></div>
                <div><dt>Sequence (10 bits)</dt><dd>{decoded.seq}</dd></div>
              </dl>
            </>
          ) : <p className="ig-id__empty">Create a post to see its ID broken into fields.</p>}
          <ol className="ig-id__list">
            {posts.map((p) => {
              const d = decodeId(p.id)
              return (
                <li key={p.id.toString()}>
                  <code>{p.id.toString()}</code>
                  <span>user {p.userId} · shard {d.shard} · host {hostForShard(d.shard, Number(hosts)) + 1}</span>
                </li>
              )
            })}
          </ol>
          {posts.length > 1 && <p className="ig-id__note">Newest first: larger ID = later post, so an index on ID is also an index on time.</p>}
        </div>
      </div>
    </DemoFrame>
  )
}
