export interface MockPhase {
  id: string
  title: string
  minutes: number
  /** Coach hints, rotated while the phase is active. */
  hints: string[]
}

export const MOCK_PHASES: MockPhase[] = [
  { id: 'clarify', title: 'Clarify & scope', minutes: 5, hints: [
    'Ask who the users are and which 2–3 features matter most. Write them down.',
    'Pin non-functional needs: scale, latency, availability, consistency.',
    'Say what is out of scope out loud, so the interviewer can object now rather than later.',
  ] },
  { id: 'estimate', title: 'Estimate', minutes: 4, hints: [
    'Only estimate what changes a decision: QPS, storage, bandwidth, working set.',
    'Round aggressively (1 day ≈ 10⁵ s) and show the arithmetic.',
    'End with a conclusion: "so a single primary handles writes; reads need caching."',
  ] },
  { id: 'api', title: 'API & data model', minutes: 5, hints: [
    'List 2–4 core endpoints with request and response shapes.',
    'Choose storage per entity from its access pattern, not by habit.',
    'Name the partition key now; it drives the rest of the design.',
  ] },
  { id: 'hld', title: 'High-level design', minutes: 10, hints: [
    'Draw the happy path end to end before optimizing anything.',
    'Walk one read and one write request through the boxes.',
    'Check back with the interviewer: "does this cover the core flows before I go deeper?"',
  ] },
  { id: 'deep', title: 'Deep dives', minutes: 15, hints: [
    'Pick the hardest or riskiest component; offer the interviewer a choice of 2.',
    'Say what breaks first at 10× and how you would detect it.',
    'Compare two real alternatives with one decisive trade-off each.',
    'Cover failure handling: retries, idempotency, degraded modes.',
  ] },
  { id: 'wrap', title: 'Wrap-up', minutes: 6, hints: [
    'Summarize the design in 30 seconds.',
    'List the top risks and what you would monitor (SLIs and alerts).',
    'Mention the evolution path: what you would build in v2 and why not now.',
  ] },
]

export const MOCK_TOTAL_SECONDS = MOCK_PHASES.reduce((s, p) => s + p.minutes * 60, 0)

/** Phase boundaries in seconds from start. */
export const PHASE_ENDS = MOCK_PHASES.reduce<number[]>((acc, p) => [...acc, (acc.at(-1) ?? 0) + p.minutes * 60], [])

export const RUBRIC_DIMENSIONS = [
  { id: 'scope', label: 'Requirements & scoping', staff: 'Drove scope, named non-goals, surfaced hidden constraints' },
  { id: 'estimate', label: 'Estimation', staff: 'Numbers drove concrete decisions' },
  { id: 'hld', label: 'High-level design', staff: 'Clean, complete happy path with clear data flow' },
  { id: 'depth', label: 'Deep-dive depth', staff: 'Went two levels deep on the riskiest component' },
  { id: 'tradeoffs', label: 'Trade-offs', staff: 'Compared real alternatives, stated reversal conditions' },
  { id: 'ops', label: 'Failure modes & operability', staff: 'Failure handling, monitoring, rollout, cost' },
  { id: 'comms', label: 'Communication & time', staff: 'Led the conversation, checked in, finished on time' },
] as const

export type RubricId = (typeof RUBRIC_DIMENSIONS)[number]['id']

export interface MockHistoryEntry {
  at: number
  promptId: string
  title: string
  minutes: number
  scores: Record<RubricId, number>
  pct: number
}
