import { AlertTriangle, Calculator, ClipboardCheck, Compass, Mic, Scale, Timer, Zap } from 'lucide-react'
import type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS_INTERVIEW: MentalModelData[] = [
  {
    id: 'staff-signals',
    idea: 'Same boxes, different level: staff drives scope, numbers, failure and trade-offs.',
    picture: [
      { icon: Compass, label: 'Frame the problem' },
      { icon: Calculator, label: 'Put numbers on it' },
      { icon: AlertTriangle, label: 'Name what breaks first' },
      { icon: Scale, label: 'Tie trade-offs to needs' },
    ],
    analogy: 'two drivers on the same road: one follows directions, the other reads the map and plans around traffic.',
    hook: 'Raise the hard part before the interviewer does.',
  },
  {
    id: 'mock',
    idea: 'Practice out loud against a clock, and adapt to curveballs with the smallest change.',
    picture: [
      { icon: Timer, label: 'Start the clock' },
      { icon: Mic, label: 'Think out loud' },
      { icon: Zap, label: 'Take the curveball' },
      { icon: ClipboardCheck, label: 'Score yourself' },
    ],
    analogy: 'a fire drill: rehearse under time pressure so the real thing feels familiar.',
    hook: 'Restate, find what breaks, change the least, keep the rest.',
  },
]
