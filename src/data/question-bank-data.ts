import { FUNDAMENTALS_QUESTIONS } from './question-bank-data-fundamentals'
import { STORAGE_QUESTIONS } from './question-bank-data-storage'
import { OPERATIONS_QUESTIONS } from './question-bank-data-operations'
import { CASE_STUDY_QUESTIONS } from './question-bank-data-case-studies'

export type QCategory =
  | 'Estimation' | 'Networking & APIs' | 'Load balancing' | 'Caching' | 'Databases'
  | 'Consistency & Consensus' | 'Messaging' | 'Rate limiting & IDs' | 'Reliability & Observability'
  | 'Case follow-ups' | 'Trade-offs'

export type QLevel = 'senior' | 'staff'

export interface BankQuestion {
  id: string
  category: QCategory
  level: QLevel
  q: string
  /** One-paragraph solid answer. */
  senior: string
  /** Bullet points a staff engineer adds. */
  staff: string[]
  followUps: string[]
}

export const Q_CATEGORIES: QCategory[] = [
  'Estimation', 'Networking & APIs', 'Load balancing', 'Caching', 'Databases',
  'Consistency & Consensus', 'Messaging', 'Rate limiting & IDs', 'Reliability & Observability',
  'Case follow-ups', 'Trade-offs',
]

export const QUESTION_BANK: BankQuestion[] = [
  ...FUNDAMENTALS_QUESTIONS,
  ...STORAGE_QUESTIONS,
  ...OPERATIONS_QUESTIONS,
  ...CASE_STUDY_QUESTIONS,
]
