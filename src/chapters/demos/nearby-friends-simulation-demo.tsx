import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, DemoFrame, Slider } from '../../components/ui'
import { WORLD_H, WORLD_W, createWorld, distKm, mulberry32, step, tickStats } from './nearby-sim-model'
import type { World } from './nearby-sim-model'
import './nearby-demos.css'

const USERS = 48
const ME = 0

export function NearbyFriendsSimulationDemo() {
  const [avgFriends, setAvgFriends] = useState(6)
  const [radius, setRadius] = useState(8)
  const [playing, setPlaying] = useState(true)
  const [world, setWorld] = useState<World>(() => createWorld(USERS, 6))
  const rnd = useRef(mulberry32(42))

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setWorld((w) => step(w, rnd.current)), 450)
    return () => clearInterval(t)
  }, [playing])

  const rebuild = (f: number) => { setAvgFriends(f); setWorld(createWorld(USERS, f)) }
  const stats = useMemo(() => tickStats(world, radius), [world, radius])
  const me = world.users[ME]
  const myFriends = [...world.friends[ME]].map((id) => ({ u: world.users[id], d: distKm(me, world.users[id]) }))
    .sort((a, b) => a.d - b.d)
  const filteredPct = stats.delivered ? Math.round((stats.filtered / stats.delivered) * 100) : 0

  return (
    <DemoFrame title="Live location fan-out: who needs to hear about whom?"
      onReset={() => { rnd.current = mulberry32(42); rebuild(6); setRadius(8) }}
      hint="Every user publishes a location each tick to their own channel; every friend's connection is subscribed. Most deliveries are filtered because the friend is too far away.">
      <div className="nb">
        <svg className="nb__map" viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} role="img"
          aria-label={`Map of ${USERS} users; you have ${myFriends.filter((f) => f.d <= radius).length} friends within ${radius} km`}>
          <circle cx={me.x} cy={me.y} r={radius} className="nb__radius" />
          {myFriends.map(({ u, d }) => (
            <line key={u.id} x1={me.x} y1={me.y} x2={u.x} y2={u.y} className={d <= radius ? 'nb__link is-near' : 'nb__link'} />
          ))}
          {world.users.map((u) => {
            const friend = world.friends[ME].has(u.id)
            const near = friend && distKm(me, u) <= radius
            const cls = u.id === ME ? 'is-me' : near ? 'is-near' : friend ? 'is-friend' : ''
            return <circle key={u.id} cx={u.x} cy={u.y} r={u.id === ME ? 1.6 : 1} className={`nb__user ${cls}`} />
          })}
        </svg>

        <div className="demo-controls">
          <Slider label="Search radius" min={1} max={30} value={radius} onChange={setRadius} format={(v) => `${v} km`} />
          <Slider label="Avg friends per user" min={2} max={20} value={avgFriends} onChange={rebuild} />
          <div className="nb__counters">
            <div><span>Published</span><b className="mono">{stats.published}</b></div>
            <div><span>Pub/sub deliveries</span><b className="mono">{stats.delivered}</b></div>
            <div><span>Pushed to phones</span><b className="mono nb__ok">{stats.forwarded}</b></div>
            <div><span>Filtered (too far)</span><b className="mono">{stats.filtered} <small>({filteredPct}%)</small></b></div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</Button>
          <ul className="nb__list" aria-label="Your friends by distance">
            {myFriends.slice(0, 6).map(({ u, d }) => (
              <li key={u.id} className={d <= radius ? 'is-near' : ''}>
                <span>Friend #{u.id}</span><span className="mono">{d.toFixed(1)} km</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="nb__note">
        Per tick (one update interval, ~30 s in production): deliveries = Σ friends of each publisher. Fan-out grows
        with friend count, not with how many friends are nearby. That's why the pub/sub tier, not the WebSocket
        tier, is the scaling bottleneck. Toy model with {USERS} users.
      </p>
    </DemoFrame>
  )
}
