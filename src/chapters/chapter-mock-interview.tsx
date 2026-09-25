import { Callout, CompareTable, H2, KeyTakeaways, References } from '../components/ui'
import { INTERVIEW_FURTHER_READING } from '../data/interview-further-reading'
import { MOCK_PROMPTS } from '../data/mock-prompts-data'
import { MockSimulator } from './demos/mock-simulator'
import { MOCK_PHASES } from './demos/mock-phases'

export default function MockInterviewChapter() {
  return (
    <>
      <p>
        Reading about system design is not the same as doing it out loud against a clock. This simulator gives you
        one of {MOCK_PROMPTS.length} classic prompts, runs a 45-minute clock with a phase coach, lets the
        “interviewer” throw curveballs, and saves a self-score so you can see your trend over weeks of practice.
      </p>
      <Callout kind="tip" title="How to get real value from it">
        Talk out loud the whole time, as if someone were listening. Better still, record yourself or practice with a
        friend playing interviewer. Use the scratchpad the way you would use the interview whiteboard. Only open the
        reference after the deep-dive phase.
      </Callout>

      <H2 id="simulator">Run a mock</H2>
      <MockSimulator />

      <H2 id="time-budget">The 45-minute budget</H2>
      <p>
        Most loops give you 45–60 minutes, with 5 minutes of introductions and 5 minutes for your questions at the
        end. That leaves about 35–45 minutes of design. The coach uses this split:
      </p>
      <CompareTable
        columns={['Minutes', 'Goal', 'Common failure']}
        rows={MOCK_PHASES.map((p) => ({
          label: p.title,
          cells: [String(p.minutes), p.hints[0], FAILURES[p.id] ?? ''],
        }))}
      />
      <Callout kind="staff">
        Staff candidates <strong>manage the clock out loud</strong>: “We have about 15 minutes left. I'd like to go
        deep on the fan-out path because it's the riskiest part. Or would you rather I cover storage?” Offering the
        interviewer a choice shows you know what matters and still leaves them in charge.
      </Callout>

      <H2 id="curveballs">Handling curveballs</H2>
      <p>
        Curveballs such as “now 10× the traffic”, “a region goes down” or “the provider times out” test whether your
        design is built on reasoning or memorized. A reliable response pattern:
      </p>
      <ol>
        <li><strong>Restate the new constraint</strong> and redo only the numbers it affects.</li>
        <li><strong>Name what breaks first</strong> in your current design, and why.</li>
        <li><strong>Make the smallest change</strong> that fixes it, and say what it costs.</li>
        <li><strong>Say what stays the same.</strong> It shows the design is modular.</li>
      </ol>
      <Callout kind="pitfall">
        Tearing up the whole design in response to a curveball. It signals that your first design had no clear
        reasoning behind it. Change as little as possible, and say why you are changing it.
      </Callout>

      <H2 id="when-stuck">When you get stuck</H2>
      <ul>
        <li><strong>Go back to requirements.</strong> “Let me re-check what this needs to guarantee.” That usually tells you which trade-off matters.</li>
        <li><strong>Walk a single request</strong> through your boxes. Gaps show up quickly.</li>
        <li><strong>Think aloud about options.</strong> “I see two ways: A, which costs X, or B, which costs Y.” Interviewers can help when they can hear your reasoning.</li>
        <li><strong>Be honest about gaps.</strong> “I haven't operated Cassandra, but my understanding is…” is much better than bluffing.</li>
      </ul>

      <H2 id="further-reading">Further reading</H2>
      <References items={INTERVIEW_FURTHER_READING} />

      <KeyTakeaways items={[
        'Practice out loud, with a clock, and use the scratchpad like a whiteboard.',
        'Budget time explicitly and say it out loud: about 5 / 4 / 5 / 10 / 15 / 6 minutes.',
        'Answer curveballs with the smallest change: restate, find what breaks first, fix it, keep the rest.',
        'Score yourself after every session and watch the trend, not a single result.',
      ]} />
    </>
  )
}

const FAILURES: Record<string, string> = {
  clarify: 'Jumping straight to boxes; missing the one requirement that changes everything',
  estimate: 'Ten minutes of arithmetic that never informs a decision',
  api: 'Skipping it, then having no partition key when storage comes up',
  hld: 'Optimizing one box before the end-to-end flow exists',
  deep: 'Staying shallow on five components instead of deep on one',
  wrap: 'Running out of time with no summary or risks',
}
