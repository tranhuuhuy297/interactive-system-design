import { Camera, Cpu, FileText, ListOrdered, RotateCcw, ScrollText, Scissors, Trophy } from 'lucide-react'
import type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS_CASES_D: MentalModelData[] = [
  {
    id: 'digital-wallet',
    idea: 'Log every transfer command, apply it deterministically, and rebuild balances by replay.',
    picture: [
      { icon: ScrollText, label: 'Command logged' },
      { icon: Cpu, label: 'Validate → event' },
      { icon: Camera, label: 'Snapshot state' },
      { icon: RotateCcw, label: 'Replay to recover' },
    ],
    analogy: 'a bank passbook: the balance is just the sum of every stamped line, so you can always recompute it.',
    hook: 'Events are truth, balances are a cache, replay proves it.',
  },
  {
    id: 'search-engine',
    idea: 'Map each term to the documents containing it, then rank only those.',
    picture: [
      { icon: FileText, label: 'Documents in' },
      { icon: Scissors, label: 'Analyze into terms' },
      { icon: ListOrdered, label: 'Posting lists per term' },
      { icon: Trophy, label: 'Intersect, then rank' },
    ],
    analogy: 'the index at the back of a book: look up the word, get the pages, never read the whole book.',
    hook: 'Look up terms, intersect lists, rank the few, fan out to shards.',
  },
]
