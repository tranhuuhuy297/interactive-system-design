/** Context-window budgeting: which conversation turns survive under each strategy. Token counts are illustrative. */
export type Strategy = 'truncate' | 'summarize' | 'retrieve'
export type TurnFate = 'kept' | 'summarized' | 'retrieved' | 'dropped'

export interface BudgetInputs {
  windowTokens: number
  systemTokens: number
  toolTokens: number
  docChunks: number
  chunkTokens: number
  turns: number
  tokensPerTurn: number
  reservedOutput: number
  strategy: Strategy
}

export interface BudgetResult {
  segments: { id: 'system' | 'tools' | 'docs' | 'summary' | 'history' | 'output' | 'free'; tokens: number }[]
  fates: TurnFate[]
  promptTokens: number
  overflow: number
}

const RECENT_TURNS_FOR_RETRIEVE = 4
const RETRIEVE_TOP_K = 3
const SUMMARY_RATIO = 0.1

export function planContext(i: BudgetInputs): BudgetResult {
  const docs = i.docChunks * i.chunkTokens
  const fixed = i.systemTokens + i.toolTokens + docs + i.reservedOutput
  const available = i.windowTokens - fixed
  const fates: TurnFate[] = Array.from({ length: i.turns }, () => 'dropped')
  const per = Math.max(1, i.tokensPerTurn)
  const fitCount = Math.max(0, Math.floor(Math.max(0, available) / per))
  let summary = 0

  if (available > 0) {
    if (i.strategy === 'truncate') {
      keepNewest(fates, Math.min(i.turns, fitCount))
    } else if (i.strategy === 'summarize') {
      if (fitCount >= i.turns) keepNewest(fates, i.turns)
      else {
        // Reserve a slice for the running summary, fill the rest with the newest turns.
        const kept = Math.max(0, Math.floor((available * 0.8) / per))
        const keptN = Math.min(i.turns, kept)
        keepNewest(fates, keptN)
        const older = i.turns - keptN
        summary = Math.min(Math.ceil(older * per * SUMMARY_RATIO), Math.max(0, available - keptN * per))
        for (let t = 0; t < older; t++) fates[t] = summary > 0 ? 'summarized' : 'dropped'
      }
    } else {
      const recent = Math.min(i.turns, RECENT_TURNS_FOR_RETRIEVE, fitCount)
      keepNewest(fates, recent)
      const room = Math.min(RETRIEVE_TOP_K, fitCount - recent)
      // Deterministic stand-in for "most relevant" older turns: spread picks across history.
      const older = i.turns - recent
      for (let k = 0; k < room && older > 0; k++) {
        const idx = Math.floor(((k + 0.5) / room) * older)
        fates[Math.min(older - 1, idx)] = 'retrieved'
      }
    }
  }

  const historyTurns = fates.filter((f) => f === 'kept' || f === 'retrieved').length
  const history = historyTurns * per
  const used = fixed + summary + history
  const overflow = Math.max(0, used - i.windowTokens)
  return {
    segments: [
      { id: 'system', tokens: i.systemTokens },
      { id: 'tools', tokens: i.toolTokens },
      { id: 'docs', tokens: docs },
      { id: 'summary', tokens: summary },
      { id: 'history', tokens: history },
      { id: 'output', tokens: i.reservedOutput },
      { id: 'free', tokens: Math.max(0, i.windowTokens - used) },
    ],
    fates,
    promptTokens: used - i.reservedOutput,
    overflow,
  }
}

function keepNewest(fates: TurnFate[], n: number) {
  for (let t = fates.length - n; t < fates.length; t++) if (t >= 0) fates[t] = 'kept'
}
