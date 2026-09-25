import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { bytes, compact, duration, feedCost, fromLog, toLog, type FeedStrategy } from './feed-fanout-model'
import './feed-fanout-simulator-demo.css'

const DOTS = 120

export function FeedFanoutSimulatorDemo() {
  const [strategy, setStrategy] = useState<FeedStrategy>('hybrid')
  const [followersLog, setFollowersLog] = useState(toLog(50_000_000))
  const [followees, setFollowees] = useState(300)
  const [celebs, setCelebs] = useState(8)
  const [thresholdLog, setThresholdLog] = useState(toLog(10_000))
  const [runId, setRunId] = useState(0)
  const [lit, setLit] = useState(false)

  const followers = fromLog(followersLog)
  const threshold = fromLog(thresholdLog)
  const c = feedCost(strategy, { followers, followees, celebsFollowed: Math.min(celebs, followees), threshold })

  // Animation length tracks real delivery time, clamped so it stays watchable.
  const animSec = c.authorIsPulled ? 0 : Math.min(3, Math.max(0.4, c.deliverySeconds))
  // Remount unlit, then light on the next frames so the staggered transition actually plays.
  const publish = () => {
    setLit(false)
    setRunId((r) => r + 1)
    requestAnimationFrame(() => requestAnimationFrame(() => setLit(true)))
  }
  const reset = () => {
    setStrategy('hybrid'); setFollowersLog(toLog(50_000_000)); setFollowees(300); setCelebs(8); setThresholdLog(toLog(10_000))
  }

  return (
    <DemoFrame title="Fan-out simulator: who pays, the writer or the reader?" onReset={reset}
      hint="Drag the author's follower count up to celebrity scale and watch push fan-out fall over. Model constants are illustrative.">
      <div className="feedsim">
        <div className="demo-controls">
          <Segmented label="Strategy" value={strategy} onChange={setStrategy}
            options={[{ value: 'push', label: 'Push (on write)' }, { value: 'pull', label: 'Pull (on read)' }, { value: 'hybrid', label: 'Hybrid' }]} />
          <Slider label="Author's followers" min={0} max={100} step={0.5} value={followersLog} onChange={setFollowersLog} format={() => compact(followers)} />
          <Slider label="Reader follows (accounts)" min={10} max={2000} step={10} value={followees} onChange={setFollowees} />
          {strategy === 'hybrid' && <>
            <Slider label="Hybrid threshold (followers)" min={0} max={100} step={0.5} value={thresholdLog} onChange={setThresholdLog} format={() => compact(threshold)} />
            <Slider label="Celebrities the reader follows" min={0} max={50} value={celebs} onChange={setCelebs} />
          </>}
          <button className="btn btn--primary btn--md" onClick={publish}>Publish a post</button>
        </div>

        <div className="feedsim__stage">
          <div className="feedsim__dots" key={runId} aria-label="Follower feeds receiving the post">
            {Array.from({ length: DOTS }, (_, i) => (
              <span key={i} className={lit && !c.authorIsPulled ? 'is-lit' : ''}
                style={{ transitionDelay: `${(i / DOTS) * animSec}s` }} />
            ))}
          </div>
          <p className="feedsim__note">
            {c.authorIsPulled
              ? 'Author is pulled: the post is written once, and readers merge it in when they load their feed.'
              : `Each dot ≈ ${compact(Math.max(1, followers / DOTS))} follower feeds getting an insert.`}
          </p>
          <dl className="feedsim__stats">
            <div className={c.writesPerPost > 1e6 ? 'is-bad' : ''}><dt>Writes per post</dt><dd>{compact(c.writesPerPost)}</dd></div>
            <div className={c.deliverySeconds > 10 ? 'is-bad' : ''}><dt>Time to reach last follower</dt><dd>{duration(c.deliverySeconds)}</dd></div>
            <div><dt>Feed-cache bytes added</dt><dd>{bytes(c.storageBytes)}</dd></div>
            <div className={c.readMs > 100 ? 'is-bad' : ''}><dt>Reader feed load</dt><dd>{c.readMs.toFixed(0)} ms</dd></div>
          </dl>
        </div>
      </div>
    </DemoFrame>
  )
}
