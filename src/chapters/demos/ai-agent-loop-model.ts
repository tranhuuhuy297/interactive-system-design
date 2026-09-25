// Deterministic agent-loop script: no real LLM, just the control flow and guardrails around one.

export type FailureMode = 'none' | 'transient' | 'persistent'
export type Approval = 'pending' | 'approved' | 'rejected'

export interface AgentOptions {
  maxSteps: number
  failure: FailureMode
  confirmWrites: boolean
  approval: Approval
}

export type EventKind = 'thought' | 'call' | 'obs' | 'error' | 'guard' | 'final'

export interface TraceEvent {
  step: number
  kind: EventKind
  text: string
}

export type RunStatus = 'done' | 'budget' | 'loop' | 'awaiting' | 'rejected'

export interface AgentRun {
  events: TraceEvent[]
  /** Context size (tokens) sent to the model at each turn. */
  contextPerTurn: number[]
  /** Sum of input tokens across all turns — every turn re-sends the whole history. */
  totalInputTokens: number
  status: RunStatus
}

const BASE_CONTEXT = 1_250 // system prompt + tool schemas + user request
const LOOP_LIMIT = 3 // identical failing calls before the loop detector trips

interface Planned { thought: string; call: string; ok: string; okTokens: number; write?: boolean }

const PLAN: Planned[] = [
  { thought: 'I need last month’s revenue per customer.', call: 'sql_query(“SELECT customer_id, SUM(amount) … GROUP BY 1 ORDER BY 2 DESC LIMIT 50”)',
    ok: '50 rows returned (customer_id, revenue)', okTokens: 900 },
  { thought: 'Top 3 are ids 118, 42, 7. I need their names.', call: 'crm_lookup(ids=[118, 42, 7])',
    ok: 'Acme Corp, Globex, Initech', okTokens: 180 },
  { thought: 'Draft the summary and send it to finance.', call: 'send_email(to=“finance@example.test”, subject=“Top customers – last month”)',
    ok: 'Email queued (id m_5521)', okTokens: 40, write: true },
]

export function runAgent(opts: AgentOptions): AgentRun {
  const events: TraceEvent[] = []
  const contextPerTurn: number[] = []
  let context = BASE_CONTEXT
  let step = 0
  let planIdx = 0
  let failuresInARow = 0

  const turn = () => { step += 1; contextPerTurn.push(context) }
  const finish = (status: RunStatus): AgentRun =>
    ({ events, contextPerTurn, totalInputTokens: contextPerTurn.reduce((a, b) => a + b, 0), status })

  while (planIdx < PLAN.length) {
    if (step >= opts.maxSteps) {
      events.push({ step, kind: 'guard', text: `Step budget (${opts.maxSteps}) exhausted. Run stopped and escalated to a human.` })
      return finish('budget')
    }
    const p = PLAN[planIdx]
    turn()
    events.push({ step, kind: 'thought', text: failuresInARow ? 'That failed. Retrying the same query.' : p.thought })
    events.push({ step, kind: 'call', text: p.call })
    context += 120

    if (p.write && opts.confirmWrites && opts.approval !== 'approved') {
      if (opts.approval === 'pending') {
        events.push({ step, kind: 'guard', text: 'Write action paused: waiting for human approval before send_email runs.' })
        return finish('awaiting')
      }
      events.push({ step, kind: 'guard', text: 'Human rejected the write. Nothing was sent.' })
      return finish('rejected')
    }

    const fails = planIdx === 0 && (opts.failure === 'persistent' || (opts.failure === 'transient' && failuresInARow === 0))
    if (fails) {
      failuresInARow += 1
      events.push({ step, kind: 'error', text: 'Tool error: database timeout after 30s' })
      context += 60
      if (failuresInARow >= LOOP_LIMIT) {
        events.push({ step, kind: 'guard', text: `Loop detector: same failing call ${LOOP_LIMIT}× in a row. Run stopped.` })
        return finish('loop')
      }
      continue
    }
    failuresInARow = 0
    events.push({ step, kind: 'obs', text: p.ok })
    context += p.okTokens
    planIdx += 1
  }

  if (step >= opts.maxSteps) {
    events.push({ step, kind: 'guard', text: `Step budget (${opts.maxSteps}) exhausted before the final answer.` })
    return finish('budget')
  }
  turn()
  events.push({ step, kind: 'final', text: 'Sent finance the top 3 customers: Acme Corp, Globex, Initech.' })
  return finish('done')
}
