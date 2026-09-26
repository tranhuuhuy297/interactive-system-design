import { Cpu, HardDrive, Sparkles, Upload } from 'lucide-react'
import type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS_EPISODES_3: MentalModelData[] = [
  {
    id: 'ep-youtube',
    idea: 'Store each upload once, encode it many ways, and serve popular video from caches near viewers.',
    picture: [
      { icon: Upload, label: 'Upload once' },
      { icon: Cpu, label: 'Encode many renditions' },
      { icon: HardDrive, label: 'Serve from nearby caches' },
      { icon: Sparkles, label: 'Recommend in two passes' },
    ],
    analogy: 'a publisher that prints every book in several sizes, stocks local shops, and has a clerk suggest the next read.',
    hook: 'Encode once per format, serve from next door, recommend in two passes.',
  },
]
