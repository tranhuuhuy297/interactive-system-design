import { useMemo, useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { LADDER, LADDER_LABEL, bandwidthAt, simulateAbr } from './video-models'
import type { AbrAlgo, NetProfile } from './video-models'
import './video-demos.css'

const W = 640
const H = 170
const BH = 70

export function VideoAbrSim() {
  const [profile, setProfile] = useState<NetProfile>('drop')
  const [algo, setAlgo] = useState<AbrAlgo>('throughput')
  const [scale, setScale] = useState(1)
  const [safety, setSafety] = useState(0.8)

  const sim = useMemo(() => simulateAbr(profile, scale, algo, safety), [profile, scale, algo, safety])
  const tMax = Math.max(1, sim.pts[sim.pts.length - 1]?.t ?? 1)
  const yMax = 10
  const x = (t: number) => (t / tMax) * W
  const y = (mbps: number) => H - (Math.min(mbps, yMax) / yMax) * H

  const bwPath = Array.from({ length: 121 }, (_, i) => {
    const t = (i / 120) * tMax
    return `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(bandwidthAt(t, profile, scale)).toFixed(1)}`
  }).join(' ')
  // Step line: segment i's bitrate holds from the end of segment i-1 until its own download completes.
  let ratePath = ''
  sim.pts.forEach((p, i) => {
    const from = i ? sim.pts[i - 1].t : 0
    ratePath += `${i ? 'L' : 'M'}${x(from).toFixed(1)},${y(p.rate)} L${x(p.t).toFixed(1)},${y(p.rate)} `
  })
  const bufPath = sim.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${(BH - (p.buffer / 30) * BH).toFixed(1)}`).join(' ')

  const reset = () => { setProfile('drop'); setAlgo('throughput'); setScale(1); setSafety(0.8) }

  return (
    <DemoFrame title="Adaptive bitrate: the player picks a rendition every segment" onReset={reset}
      hint="The player fetches 4-second segments and chooses a rendition before each one. Try the “drop” network: throughput-based switching reacts late, and buffer-based switching trades quality for fewer stalls.">
      <div className="vid__controls">
        <div>
          <div className="demo-label">Network</div>
          <Segmented label="Network profile" options={['stable', 'drop', 'jittery'] as const} value={profile} onChange={setProfile} />
        </div>
        <div>
          <div className="demo-label">Algorithm</div>
          <Segmented label="ABR algorithm" value={algo} onChange={setAlgo}
            options={[{ value: 'throughput', label: 'Throughput' }, { value: 'buffer', label: 'Buffer-based' }]} />
        </div>
        <Slider label="Bandwidth scale" min={0.3} max={2} step={0.1} value={scale} onChange={setScale} format={(v) => `${v.toFixed(1)}×`} />
        {algo === 'throughput' && <Slider label="Safety factor" min={0.5} max={1.2} step={0.05} value={safety} onChange={setSafety} format={(v) => v.toFixed(2)} />}
      </div>

      <div className="vid__charts">
        <svg viewBox={`0 0 ${W} ${H}`} className="vid__svg" role="img" aria-label="Bandwidth and chosen bitrate over time">
          {LADDER.map((r, i) => (
            <g key={r}>
              <line x1="0" x2={W} y1={y(r)} y2={y(r)} className="vid__grid" />
              <text x={W - 4} y={y(r) - 3} textAnchor="end" className="vid__tick">{LADDER_LABEL[i]} · {r} Mbps</text>
            </g>
          ))}
          <path d={bwPath} className="vid__bw" />
          <path d={ratePath} className="vid__rate" />
          {/* Skip segment 0: its download time is startup delay, not rebuffering. */}
          {sim.pts.slice(1).filter((p) => p.stall > 0.05).map((p, i) => <circle key={i} cx={x(p.t)} cy={H - 6} r="4" className="vid__stall" />)}
        </svg>
        <div className="vid__legend"><span className="l-bw">available bandwidth</span><span className="l-rate">chosen bitrate</span><span className="l-stall">stall</span></div>
        <svg viewBox={`0 0 ${W} ${BH}`} className="vid__svg vid__svg--buf" role="img" aria-label="Buffer level over time">
          <line x1="0" x2={W} y1={BH - (5 / 30) * BH} y2={BH - (5 / 30) * BH} className="vid__grid vid__grid--warn" />
          <path d={`${bufPath} L${x(tMax)},${BH} L0,${BH} Z`} className="vid__buf" />
        </svg>
        <div className="vid__legend"><span>buffer (0–30 s) · dashed line = 5 s reservoir</span></div>
      </div>

      <div className="vid__stats">
        <div><span>Avg bitrate</span><strong>{sim.avgRate.toFixed(2)} Mbps</strong></div>
        <div><span>Startup delay</span><strong>{sim.startup.toFixed(1)} s</strong></div>
        <div><span>Rebuffering</span><strong className={sim.stallTotal - sim.startup > 0.5 ? 'is-bad' : ''}>{Math.max(0, sim.stallTotal - sim.startup).toFixed(1)} s</strong></div>
        <div><span>Quality switches</span><strong>{sim.switches}</strong></div>
      </div>
    </DemoFrame>
  )
}
