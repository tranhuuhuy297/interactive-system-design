import { P99_FACTOR } from './studio-analyzer'
import { CATALOG } from './studio-catalog'
import type { Design, StudioPrompt, StudioReport } from './studio-types'

const fmt = (v: number) => v.toLocaleString('en-US')

/** Interview-notes summary of a design and its review. */
export function designMarkdown(p: StudioPrompt, d: Design, r: StudioReport): string {
  const label = (id: string) => {
    const n = d.nodes.find((x) => x.id === id)
    return n ? n.label || CATALOG[n.kind].short : id
  }
  const lines = [
    `# Design Studio: ${p.title}`,
    '',
    `> ${p.brief}`,
    '',
    `**Targets:** ${fmt(p.req.readQps)} reads/s · ${fmt(p.req.writeQps)} writes/s · ${p.req.storageTbPerYear} TB/yr data${p.req.blobTbPerYear ? ` · ${p.req.blobTbPerYear} TB/yr media` : ''} · p99 < ${p.req.p99Ms} ms · ${p.req.availability}`,
    '',
    '## Components',
    ...d.nodes.map((n) => {
      const item = CATALOG[n.kind]
      const hit = n.hitRatio !== undefined && (n.kind === 'cache' || n.kind === 'cdn') ? `, ${Math.round(n.hitRatio * 100)}% hit` : ''
      return `- **${label(n.id)}** (${item.name}): ${n.units} ${item.unitLabel.toLowerCase()}${hit}`
    }),
    '',
    '## Connections',
    ...(d.edges.length ? d.edges.map((e) => `- ${label(e.from)} → ${label(e.to)}`) : ['- (none yet)']),
    '',
    `## Review: ${r.score}/100`,
    `Estimated read p99 ≈ ${Math.round(r.readLatencyMs * P99_FACTOR)} ms (toy model).`,
    '',
    ...(r.findings.length ? r.findings.map((f) => `- **${f.severity}**: ${f.title}. Fix: ${f.fix}`) : ['- No issues found.']),
    ...(r.passed.length ? ['', '**Covered:**', ...r.passed.map((x) => `- ${x}`)] : []),
    ...(r.staffMoves.length ? ['', '**Staff moves to mention:**', ...r.staffMoves.map((x) => `- ${x}`)] : []),
    '',
    '_Capacities in Design Studio are toy numbers for teaching, not benchmarks._',
  ]
  return lines.join('\n')
}
