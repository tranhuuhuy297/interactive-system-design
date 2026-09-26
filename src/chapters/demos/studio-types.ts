// Shared types for the Design Studio whiteboard and its analyzer.

export type CompKind =
  | 'client' | 'cdn' | 'lb' | 'ratelimit' | 'service' | 'ws' | 'cache'
  | 'sql' | 'kv' | 'blob' | 'queue' | 'worker' | 'search'

export interface StudioNode {
  id: string
  kind: CompKind
  /** Top-left position in canvas units (canvas is 960 × 560). */
  x: number
  y: number
  label?: string
  /** Replicas, nodes, partitions or shards depending on the kind. */
  units: number
  /** Cache / CDN share of reads served without going downstream (0–1). */
  hitRatio?: number
}

export interface StudioEdge {
  from: string
  to: string
}

export interface Design {
  nodes: StudioNode[]
  edges: StudioEdge[]
}

export interface PromptFlags {
  readHeavy?: boolean
  needsAsync?: boolean
  money?: boolean
  global?: boolean
  largeBlobs?: boolean
  realtime?: boolean
  search?: boolean
  rateLimited?: boolean
}

export interface Requirements {
  /** Peak read requests per second at the edge. */
  readQps: number
  /** Peak write requests per second at the edge. */
  writeQps: number
  /** Structured data growth, TB per year. */
  storageTbPerYear: number
  /** Blob (media) growth, TB per year. */
  blobTbPerYear?: number
  p99Ms: number
  availability: string
  flags: PromptFlags
}

export type CheckMode = 'present' | 'fromClient' | 'consumed' | 'before'

export interface RubricCheck {
  id: string
  label: string
  /** Satisfied if any node of these kinds meets the mode. */
  kinds: CompKind[]
  mode: CheckMode
  /** For mode 'before': the kind that must come after. */
  target?: CompKind
  fix: string
  chapter: string
}

export interface StudioPrompt {
  id: string
  title: string
  brief: string
  req: Requirements
  checks: RubricCheck[]
  staffMoves: string[]
  reference: Design
  chapters: { id: string; label: string }[]
}

export type Severity = 'critical' | 'warning' | 'info'

export interface Finding {
  id: string
  severity: Severity
  title: string
  detail: string
  fix: string
  chapter?: string
  nodeIds?: string[]
}

export interface NodeLoad {
  id: string
  kind: CompKind
  reads: number
  writes: number
  /** Requests per second the node can take (toy model). */
  capacity: number
  /** 0–1+; Infinity-safe (managed components report 0). */
  util: number
  onPath: boolean
}

export interface StudioReport {
  score: number
  findings: Finding[]
  loads: NodeLoad[]
  passed: string[]
  staffMoves: string[]
  readLatencyMs: number
}
