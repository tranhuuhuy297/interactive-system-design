// Toy constrained decoding: a scripted "language model" proposes token scores, and a
// grammar derived from a JSON schema masks tokens that would make the output invalid.

export const VOCAB = [
  'Sure!', '```', '\n', '{', '}', '"status"', '"count"', ':', ',', '"ok"', '"error"', '"maybe"', '7', '42', '<eos>',
] as const
export type Tok = (typeof VOCAB)[number]

/** Target schema: {"status": "ok" | "error", "count": integer}, both keys required, any order. */
const KEYS = ['"status"', '"count"'] as const
type Key = (typeof KEYS)[number]
const VALUES: Record<Key, Tok[]> = { '"status"': ['"ok"', '"error"'], '"count"': ['7', '42'] }

type Phase = 'start' | 'key' | 'colon' | 'value' | 'sep' | 'done' | 'end'
export interface GrammarState { phase: Phase; used: Key[]; current?: Key }

export const initialState = (): GrammarState => ({ phase: 'start', used: [] })

/** Tokens the grammar permits next. Empty set means the output is complete. */
export function allowedTokens(s: GrammarState): Set<Tok> {
  switch (s.phase) {
    case 'start': return new Set<Tok>(['{'])
    case 'key': return new Set<Tok>(KEYS.filter((k) => !s.used.includes(k)))
    case 'colon': return new Set<Tok>([':'])
    case 'value': return new Set<Tok>(VALUES[s.current!])
    case 'sep': return new Set<Tok>(s.used.length === KEYS.length ? ['}'] : [','])
    case 'done': return new Set<Tok>(['<eos>'])
    case 'end': return new Set<Tok>()
  }
}

/** Advance the grammar by one token (only call with an allowed token). */
export function advance(s: GrammarState, t: Tok): GrammarState {
  switch (s.phase) {
    case 'start': return { ...s, phase: 'key' }
    case 'key': return { phase: 'colon', used: [...s.used, t as Key], current: t as Key }
    case 'colon': return { ...s, phase: 'value' }
    case 'value': return { phase: 'sep', used: s.used }
    case 'sep': return { ...s, phase: t === '}' ? 'done' : 'key' }
    default: return { ...s, phase: 'end' }
  }
}

/** Scripted next-token scores: a chatty model that likes preambles and a made-up enum value. */
export function modelScores(history: Tok[]): Map<Tok, number> {
  const prev = history[history.length - 1]
  const lastKey = [...history].reverse().find((t) => t === '"status"' || t === '"count"')
  const table: Partial<Record<Tok, number>> = (() => {
    switch (prev) {
      case undefined: return { 'Sure!': 0.5, '{': 0.3, '```': 0.2 }
      case 'Sure!': return { '\n': 0.6, '{': 0.4 }
      case '\n': return { '{': 0.7, '\n': 0.2, 'Sure!': 0.1 }
      case '```': return history.includes('}') ? { '<eos>': 0.8, '\n': 0.2 } : { '{': 0.7, '\n': 0.3 }
      case '{': return { '"status"': 0.6, '"count"': 0.4 }
      case '"status"': case '"count"': return { ':': 0.9, ',': 0.1 }
      case ':': return lastKey === '"status"'
        ? { '"maybe"': 0.45, '"ok"': 0.35, '"error"': 0.2 }
        : { '42': 0.5, '7': 0.3, '"ok"': 0.2 }
      case ',': return { '"count"': 0.55, '"status"': 0.45 }
      case '}': return { '```': 0.5, '<eos>': 0.5 }
      default: {
        // After a value: close once both keys have appeared, otherwise keep going.
        const seen = new Set(history.filter((t) => t === '"status"' || t === '"count"'))
        return seen.size === 2 ? { '}': 0.6, ',': 0.3, '<eos>': 0.1 } : { ',': 0.6, '}': 0.3, '<eos>': 0.1 }
      }
    }
  })()
  return new Map(VOCAB.map((t) => [t, table[t] ?? 0.01]))
}

export interface Step { candidates: { tok: Tok; score: number; masked: boolean }[]; chosen: Tok }

/** Greedy decode up to maxSteps; in constrained mode masked tokens can never win. */
export function decode(constrained: boolean, maxSteps = 14): Step[] {
  const steps: Step[] = []
  const history: Tok[] = []
  let g = initialState()
  let grammarBroken = false
  for (let i = 0; i < maxSteps; i++) {
    const scores = modelScores(history)
    const allowed = constrained ? allowedTokens(g) : null
    if (allowed && allowed.size === 0) break
    const candidates = [...scores.entries()]
      .map(([tok, score]) => ({ tok, score, masked: allowed ? !allowed.has(tok) : false }))
      .sort((a, b) => b.score - a.score)
    const chosen = candidates.find((c) => !c.masked)!.tok
    steps.push({ candidates, chosen })
    history.push(chosen)
    if (chosen === '<eos>') break
    // Track grammar in free mode too, so we can report where it went off the rails.
    if (!grammarBroken && allowedTokens(g).has(chosen)) g = advance(g, chosen)
    else grammarBroken = true
  }
  return steps
}

export function render(tokens: Tok[]): string {
  return tokens.filter((t) => t !== '<eos>').join(' ').replace(/ ?\n ?/g, '\n')
}

/** Validate the produced text against the schema. */
export function validate(text: string): { ok: boolean; reason: string } {
  const problems: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // Salvage the object between the outermost braces, as a naive parser-repair step would.
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    try { parsed = JSON.parse(text.slice(start, end + 1)) } catch { return { ok: false, reason: 'Not parseable JSON' } }
    problems.push('extra text around the JSON')
  }
  const o = parsed as Record<string, unknown>
  if (o.status !== 'ok' && o.status !== 'error') problems.push(`status must be "ok" | "error", got ${JSON.stringify(o.status)}`)
  if (!Number.isInteger(o.count)) problems.push('count must be an integer')
  return problems.length ? { ok: false, reason: problems.join('; ') } : { ok: true, reason: 'Valid against the schema' }
}
