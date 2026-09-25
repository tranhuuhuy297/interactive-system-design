import type { LucideIcon } from 'lucide-react'

/** The one picture a reader should keep from a chapter. */
export interface MentalModelData {
  /** Chapter id from the registry. */
  id: string
  /** The core idea in one short sentence. */
  idea: string
  /** 3–4 icon steps that draw the idea left to right. */
  picture: { icon: LucideIcon; label: string }[]
  /** Everyday analogy (optional). */
  analogy?: string
  /** A memorable phrase to recall under interview pressure. */
  hook: string
}
