import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import { fmtBytes, fmtNum } from './estimation-format'
import './estimation-demos.css'

interface Inputs {
  dauExp: number; writesPerUser: number; readRatioExp: number; payloadExp: number
  retention: number; replication: number; peak: number; perServerExp: number
}

const PRESETS = {
  'Twitter-like': { dauExp: 8.5, writesPerUser: 2, readRatioExp: 2, payloadExp: 3, retention: 5, replication: 3, peak: 3, perServerExp: 3.5 },
  'URL shortener': { dauExp: 8, writesPerUser: 1, readRatioExp: 1, payloadExp: 2.7, retention: 10, replication: 3, peak: 2, perServerExp: 4 },
  'Photo sharing': { dauExp: 8.7, writesPerUser: 0.5, readRatioExp: 2, payloadExp: 6.3, retention: 10, replication: 3, peak: 2.5, perServerExp: 3 },
  'Chat': { dauExp: 9, writesPerUser: 40, readRatioExp: 0.3, payloadExp: 2, retention: 3, replication: 3, peak: 2, perServerExp: 4 },
} satisfies Record<string, Inputs>
type PresetName = keyof typeof PRESETS
const DAY = 86_400

export function EstimationCapacityCalculator() {
  const [preset, setPreset] = useState<PresetName>('Twitter-like')
  const [v, setV] = useState<Inputs>(PRESETS['Twitter-like'])
  const set = (k: keyof Inputs) => (x: number) => setV((p) => ({ ...p, [k]: x }))
  const pick = (p: PresetName) => { setPreset(p); setV(PRESETS[p]) }

  const dau = 10 ** v.dauExp
  const ratio = 10 ** v.readRatioExp
  const payload = 10 ** v.payloadExp
  const perServer = 10 ** v.perServerExp
  const writesDay = dau * v.writesPerUser
  const wQps = writesDay / DAY
  const rQps = wQps * ratio
  const peakQps = (wQps + rQps) * v.peak
  const storeYr = writesDay * 365 * payload * v.replication
  const storeTotal = storeYr * v.retention
  const ingress = wQps * payload
  const egress = rQps * payload
  const cache = rQps * DAY * 0.2 * payload
  const servers = Math.ceil(peakQps / perServer)

  const rows = [
    { k: 'Writes / day', m: `${fmtNum(dau)} DAU × ${v.writesPerUser}`, r: fmtNum(writesDay) },
    { k: 'Write QPS', m: `${fmtNum(writesDay)} ÷ 86,400`, r: `${fmtNum(wQps)}/s` },
    { k: 'Read QPS', m: `${fmtNum(wQps)} × ${fmtNum(ratio)} (read:write)`, r: `${fmtNum(rQps)}/s` },
    { k: 'Peak QPS', m: `(${fmtNum(wQps)} + ${fmtNum(rQps)}) × ${v.peak}`, r: `${fmtNum(peakQps)}/s` },
    { k: 'Storage / year', m: `${fmtNum(writesDay)} × 365 × ${fmtBytes(payload)} × ${v.replication} replicas`, r: fmtBytes(storeYr) },
    { k: `Storage (${v.retention} yr)`, m: `${fmtBytes(storeYr)} × ${v.retention}`, r: fmtBytes(storeTotal) },
    { k: 'Ingress', m: `${fmtNum(wQps)}/s × ${fmtBytes(payload)}`, r: `${fmtBytes(ingress)}/s` },
    { k: 'Egress', m: `${fmtNum(rQps)}/s × ${fmtBytes(payload)}`, r: `${fmtBytes(egress)}/s` },
    { k: 'Cache (80/20)', m: `20% of daily reads × ${fmtBytes(payload)}`, r: fmtBytes(cache) },
    { k: 'App servers', m: `${fmtNum(peakQps)} ÷ ${fmtNum(perServer)} per server`, r: `${fmtNum(servers)}` },
  ]

  return (
    <DemoFrame title="Capacity calculator: show your arithmetic" onReset={() => pick(preset)}
      hint="Start from a preset, then move the sliders. Every result shows the math so you can say it out loud.">
      <Segmented label="Preset" value={preset} onChange={pick} options={Object.keys(PRESETS) as PresetName[]} />
      <div className="est-calc">
        <div className="demo-controls">
          <Slider label="Daily active users" min={5} max={9.5} step={0.1} value={v.dauExp} onChange={set('dauExp')} format={(x) => fmtNum(10 ** x)} />
          <Slider label="Writes per user / day" min={0.1} max={50} step={0.1} value={v.writesPerUser} onChange={set('writesPerUser')} />
          <Slider label="Read : write ratio" min={0} max={3} step={0.1} value={v.readRatioExp} onChange={set('readRatioExp')} format={(x) => `${fmtNum(10 ** x)} : 1`} />
          <Slider label="Payload per write" min={1} max={8} step={0.1} value={v.payloadExp} onChange={set('payloadExp')} format={(x) => fmtBytes(10 ** x)} />
          <Slider label="Retention (years)" min={1} max={10} value={v.retention} onChange={set('retention')} />
          <Slider label="Replication factor" min={1} max={5} value={v.replication} onChange={set('replication')} />
          <Slider label="Peak / average" min={1} max={10} step={0.5} value={v.peak} onChange={set('peak')} format={(x) => `${x}×`} />
          <Slider label="QPS per app server" min={2} max={5} step={0.1} value={v.perServerExp} onChange={set('perServerExp')} format={(x) => fmtNum(10 ** x)} />
        </div>
        <table className="est-calc__out">
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <th scope="row">{r.k}</th>
                <td className="mono est-calc__math">{r.m}</td>
                <td className="mono est-calc__res">{r.r}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DemoFrame>
  )
}
