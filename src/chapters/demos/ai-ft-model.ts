// LoRA parameter/memory math and the fine-tuning decision rules.

export interface ModelShape { name: string; layers: number; dModel: number; dFf: number; heads: number; kvHeads: number; totalParams: number }

/** Shapes from the Llama 3 paper (Table 3); total parameter counts are approximate. */
export const PRESETS: ModelShape[] = [
  { name: 'Llama 3 8B', layers: 32, dModel: 4096, dFf: 14336, heads: 32, kvHeads: 8, totalParams: 8.0e9 },
  { name: 'Llama 3 70B', layers: 80, dModel: 8192, dFf: 28672, heads: 64, kvHeads: 8, totalParams: 70.6e9 },
  { name: 'Llama 3 405B', layers: 126, dModel: 16384, dFf: 53248, heads: 128, kvHeads: 8, totalParams: 405e9 },
]

export type Target = 'q' | 'k' | 'v' | 'o' | 'gate' | 'up' | 'down'
export const TARGETS: Target[] = ['q', 'k', 'v', 'o', 'gate', 'up', 'down']

/** (d_in, d_out) of each adapted projection. k/v are narrower under grouped-query attention. */
export function projShape(m: ModelShape, t: Target): [number, number] {
  const dKv = m.kvHeads * (m.dModel / m.heads)
  switch (t) {
    case 'q': case 'o': return [m.dModel, m.dModel]
    case 'k': case 'v': return [m.dModel, dKv]
    case 'gate': case 'up': return [m.dModel, m.dFf]
    case 'down': return [m.dFf, m.dModel]
  }
}

/** LoRA replaces ΔW (d_in × d_out) with B·A where A is r × d_in and B is d_out × r: r·(d_in + d_out) params. */
export function loraParams(m: ModelShape, rank: number, targets: Target[]): number {
  const perLayer = targets.reduce((s, t) => { const [i, o] = projShape(m, t); return s + rank * (i + o) }, 0)
  return perLayer * m.layers
}

// Bytes per parameter, excluding activations and framework overhead (rough planning numbers).
const FULL_FT_BYTES = 16 // bf16 weights + bf16 grads + fp32 master weights + Adam m and v (fp32)
const TRAINABLE_BYTES = 16
const FROZEN_BF16 = 2
const FROZEN_4BIT = 0.5

export function memoryGB(m: ModelShape, trainable: number) {
  return {
    full: (m.totalParams * FULL_FT_BYTES) / 1e9,
    lora: (m.totalParams * FROZEN_BF16 + trainable * TRAINABLE_BYTES) / 1e9,
    qlora: (m.totalParams * FROZEN_4BIT + trainable * TRAINABLE_BYTES) / 1e9,
  }
}

// ── Decision wizard ──
export type QId = 'knowledge' | 'prompted' | 'data' | 'cost' | 'behavior' | 'prefs'
export const QUESTIONS: { id: QId; text: string }[] = [
  { id: 'knowledge', text: 'Is the gap mostly facts the model doesn’t know, or facts that change often?' },
  { id: 'prompted', text: 'Have you tried a strong prompt (clear instructions, examples, structured output) and measured it on an eval set?' },
  { id: 'data', text: 'Do you have several hundred or more high-quality examples (or can you generate and review them) plus a held-out eval set?' },
  { id: 'cost', text: 'Does a large model already do the task well, but it is too slow or too expensive?' },
  { id: 'behavior', text: 'Is the gap about format, tone, style, or consistently following a narrow task?' },
  { id: 'prefs', text: 'Is it easier to say which of two outputs is better than to write the ideal output?' },
]

export type Answers = Partial<Record<QId, boolean>>
export type Verdict = { pending: QId } | { title: string; why: string }

/** Ordered rules: cheapest effective fix first. */
export function recommend(a: Answers): Verdict {
  const need = (id: QId) => a[id] === undefined
  if (need('knowledge')) return { pending: 'knowledge' }
  if (a.knowledge) return { title: 'Use retrieval (RAG), not fine-tuning', why: 'Weights are a poor place for facts: they go stale, can’t be cited, and can’t be permission-filtered. Retrieve at query time; fine-tune later only if behavior is also off.' }
  if (need('prompted')) return { pending: 'prompted' }
  if (!a.prompted) return { title: 'Prompt engineering first', why: 'It is the cheapest lever and gives you the eval set you will need anyway. Many “we need fine-tuning” projects end here.' }
  if (need('data')) return { pending: 'data' }
  if (!a.data) return { title: 'Build the dataset and evals before training', why: 'Fine-tuning amplifies whatever is in the data. Without a held-out eval you cannot tell improvement from regression.' }
  if (need('cost')) return { pending: 'cost' }
  if (a.cost) return { title: 'Distill into a smaller model', why: 'Use the large model’s outputs (reviewed) as training data for a smaller model. Latency and cost drop, and quality is kept on this narrow task.' }
  if (need('behavior')) return { pending: 'behavior' }
  if (!a.behavior) return { title: 'Fine-tuning is unlikely to help', why: 'The gap isn’t knowledge, cost, or behavior. Revisit the task definition, decomposition, or model choice.' }
  if (need('prefs')) return { pending: 'prefs' }
  return a.prefs
    ? { title: 'SFT, then preference tuning (e.g. DPO)', why: 'Supervised fine-tuning teaches the format; pairwise preferences then push toward outputs people judge better, without writing perfect targets.' }
    : { title: 'Supervised fine-tuning with LoRA', why: 'Train small adapters on input→ideal-output pairs. It is cheap to train, cheap to serve (many adapters per base model), and easy to roll back.' }
}
