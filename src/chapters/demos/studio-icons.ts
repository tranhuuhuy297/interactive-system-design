import { Database, FileSearch, Gauge, Globe, HardDrive, Inbox, Monitor, Plug, Server, Split, Table2, Workflow, Zap, type LucideIcon } from 'lucide-react'
import type { CompKind } from './studio-types'

export const STUDIO_ICONS: Record<CompKind, LucideIcon> = {
  client: Monitor, cdn: Globe, lb: Split, ratelimit: Gauge, service: Server, ws: Plug, cache: Zap,
  sql: Database, kv: Table2, blob: HardDrive, queue: Inbox, worker: Workflow, search: FileSearch,
}
