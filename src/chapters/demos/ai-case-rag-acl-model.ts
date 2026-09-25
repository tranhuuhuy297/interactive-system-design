/** Deterministic model of permissions-aware retrieval: where the ACL filter runs changes leaks and recall. */

export type FilterMode = 'pre' | 'post' | 'none'

export interface AclDoc {
  id: string
  title: string
  /** Groups allowed to read the source document. */
  acl: string[]
  /** Similarity to each query (0–1); ≥ RELEVANT counts as relevant. */
  score: Record<string, number>
}

export interface AclUser { id: string; name: string; groups: string[] }
export interface AclQuery { id: string; text: string }

export const RELEVANT = 0.5

export const USERS: AclUser[] = [
  { id: 'eng', name: 'Priya · Engineering', groups: ['all', 'eng'] },
  { id: 'sales', name: 'Marco · Sales', groups: ['all', 'sales'] },
  { id: 'fin', name: 'Dana · Finance', groups: ['all', 'finance'] },
  { id: 'exec', name: 'Lee · Executive', groups: ['all', 'eng', 'sales', 'finance', 'exec'] },
]

export const QUERIES: AclQuery[] = [
  { id: 'rev', text: 'What is our revenue forecast for next quarter?' },
  { id: 'oncall', text: 'How do I restart the payments service during an incident?' },
]

export const DOCS: AclDoc[] = [
  { id: 'd1', title: 'Board deck: next-quarter forecast', acl: ['exec'], score: { rev: 0.93, oncall: 0.05 } },
  { id: 'd2', title: 'Finance model FY plan (sheet)', acl: ['finance', 'exec'], score: { rev: 0.9, oncall: 0.04 } },
  { id: 'd3', title: 'Sales pipeline review', acl: ['sales', 'exec'], score: { rev: 0.82, oncall: 0.03 } },
  { id: 'd4', title: 'All-hands recap: company goals', acl: ['all'], score: { rev: 0.71, oncall: 0.1 } },
  { id: 'd5', title: 'Public investor FAQ', acl: ['all'], score: { rev: 0.64, oncall: 0.02 } },
  { id: 'd6', title: 'Payments runbook: restart & failover', acl: ['eng'], score: { rev: 0.06, oncall: 0.95 } },
  { id: 'd7', title: 'Incident postmortem: payments outage', acl: ['eng', 'exec'], score: { rev: 0.12, oncall: 0.88 } },
  { id: 'd8', title: 'On-call handbook (all staff)', acl: ['all'], score: { rev: 0.04, oncall: 0.77 } },
  { id: 'd9', title: 'Support macro: payment failures', acl: ['sales', 'all'], score: { rev: 0.08, oncall: 0.6 } },
  { id: 'd10', title: 'Security keys rotation (restricted)', acl: ['exec'], score: { rev: 0.02, oncall: 0.58 } },
]

export const canRead = (u: AclUser, d: AclDoc) => d.acl.some((g) => u.groups.includes(g))

export interface RetrievalResult {
  shown: { doc: AclDoc; allowed: boolean }[]
  leaked: number
  /** Relevant docs the user may read, shown / the best achievable within k. */
  recall: number
  /** Candidates dropped by a post-filter after the top-k cut. */
  dropped: number
}

export function retrieve(user: AclUser, queryId: string, k: number, mode: FilterMode): RetrievalResult {
  const ranked = [...DOCS].sort((a, b) => b.score[queryId] - a.score[queryId])
  let shown: AclDoc[]
  let dropped = 0
  if (mode === 'pre') {
    shown = ranked.filter((d) => canRead(user, d)).slice(0, k)
  } else if (mode === 'post') {
    const top = ranked.slice(0, k)
    shown = top.filter((d) => canRead(user, d))
    dropped = top.length - shown.length
  } else {
    shown = ranked.slice(0, k)
  }
  const permittedRelevant = ranked.filter((d) => canRead(user, d) && d.score[queryId] >= RELEVANT)
  const best = Math.min(k, permittedRelevant.length)
  const got = shown.filter((d) => canRead(user, d) && d.score[queryId] >= RELEVANT).length
  return {
    shown: shown.map((doc) => ({ doc, allowed: canRead(user, doc) })),
    leaked: shown.filter((d) => !canRead(user, d)).length,
    recall: best === 0 ? 1 : got / best,
    dropped,
  }
}
