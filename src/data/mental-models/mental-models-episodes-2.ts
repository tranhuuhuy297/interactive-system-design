import { Cpu, Layers, Lock, PenTool, Send, Server, Split, Trash2 } from 'lucide-react'
import type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS_EPISODES_2: MentalModelData[] = [
  {
    id: 'ep-whatsapp',
    idea: 'Servers relay encrypted messages and forget them; phones hold the keys and the history.',
    picture: [
      { icon: Lock, label: 'Encrypt on phone' },
      { icon: Server, label: 'Relay ciphertext' },
      { icon: Send, label: 'Deliver or queue' },
      { icon: Trash2, label: 'Delete on ack' },
    ],
    analogy: 'a post office that forwards sealed envelopes and keeps no copies.',
    hook: 'Relay, don’t archive; encrypt at the edge.',
  },
  {
    id: 'ep-figma',
    idea: 'One process per file orders edits; the last write to each property wins.',
    picture: [
      { icon: PenTool, label: 'Edit locally' },
      { icon: Cpu, label: 'File process orders' },
      { icon: Layers, label: 'Last write per property' },
      { icon: Split, label: 'Metadata sharded apart' },
    ],
    analogy: 'a meeting chair who takes one change at a time and announces each decision.',
    hook: 'One owner per file, one winner per property.',
  },
]

