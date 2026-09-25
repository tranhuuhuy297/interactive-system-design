import { Callout, CompareTable, H2, InterviewQuestion, KeyTakeaways } from '../components/ui'
import { StaffAnswerUpgrader } from './demos/staff-answer-upgrader'

export default function StaffSignalsChapter() {
  return (
    <>
      <p>
        At senior level and above, the system design round is the main leveling signal. Two candidates can draw nearly
        the same boxes and get different offers. The difference is in <strong>how they got there</strong>: who drove
        the scope, how they reasoned about failure, and whether their trade-offs were tied to requirements or recited
        from a blog post.
      </p>

      <H2 id="levels">Senior vs staff vs principal</H2>
      <p>Expectations vary by company, but the pattern across rubrics is consistent:</p>
      <CompareTable
        columns={['Senior', 'Staff', 'Principal']}
        rows={[
          { label: 'Scope', cells: ['Designs the system asked for', 'Reframes the problem; defines goals and non-goals', 'Connects it to the platform and multi-year strategy'] },
          { label: 'Ambiguity', cells: ['Asks clarifying questions', 'Makes and states assumptions, then moves forward', 'Identifies which unknowns are worth resolving at all'] },
          { label: 'Trade-offs', cells: ['Lists pros and cons', 'Picks one, tied to a requirement, with a reversal condition', 'Weighs org, cost and long-term complexity'] },
          { label: 'Failure', cells: ['Adds redundancy', 'Names what breaks first and how it degrades', 'Designs for blast radius and recovery across systems'] },
          { label: 'Operability', cells: ['Mentions monitoring', 'SLIs/SLOs, rollout, migration, on-call impact', 'Operational model across teams'] },
          { label: 'Evolution', cells: ['Designs for today\'s scale', 'Knows what v2 needs and what to defer', 'Sequences investment against the business roadmap'] },
          { label: 'Conversation', cells: ['Responds to prompts', 'Drives the agenda and checks in', 'Coaches the interviewer through the space'] },
        ]}
      />
      <Callout kind="staff">
        The most reliable single signal: <strong>you bring up the hard part before the interviewer does</strong>.
        “The risky piece here is fan-out for accounts with millions of followers. Let me deal with that now.”
      </Callout>

      <H2 id="upgrader">From senior to staff, one sentence at a time</H2>
      <p>
        Staff answers rarely use different technology. They add numbers, failure modes, consistency decisions,
        operability and cost to the same core idea. Try it:
      </p>
      <StaffAnswerUpgrader />

      <H2 id="rubric">What interviewers write down</H2>
      <p>Most system design rubrics reduce to some version of these dimensions. The simulator uses the same list:</p>
      <ul>
        <li><strong>Problem exploration:</strong> requirements, scale, constraints, non-goals.</li>
        <li><strong>Design quality:</strong> a coherent end-to-end design; the right component for each job.</li>
        <li><strong>Depth:</strong> can go two or three levels down on at least one component.</li>
        <li><strong>Trade-offs:</strong> real alternatives, decisive criteria.</li>
        <li><strong>Reliability & operations:</strong> failures, monitoring, deploys, cost.</li>
        <li><strong>Communication:</strong> structure, time management, collaboration with the interviewer.</li>
      </ul>

      <H2 id="phrases">Phrases that signal depth</H2>
      <CompareTable
        columns={['Instead of…', 'Say…']}
        rows={[
          { label: 'Scaling', cells: ['“We can scale horizontally.”', '“The first bottleneck at 10× is the single write primary; here\'s the runway and the plan.”'] },
          { label: 'Caching', cells: ['“Add a cache.”', '“The hot set is ~400 MB, so one node; checkout bypasses it because stock must be exact.”'] },
          { label: 'Consistency', cells: ['“We\'ll use eventual consistency.”', '“Feeds can lag 5 s; follower counts can drift; payments are strongly consistent.”'] },
          { label: 'Reliability', cells: ['“We\'ll add retries.”', '“Retries with jitter at one layer only, a retry budget, and idempotency keys so they\'re safe.”'] },
          { label: 'Choice', cells: ['“I\'d use Kafka.”', '“I need replay and per-key order, so a partitioned log fits; if not, SQS would be simpler to run.”'] },
        ]}
      />

      <H2 id="mistakes">Common down-level mistakes</H2>
      <ul>
        <li><strong>Drawing before scoping.</strong> Boxes in minute one means you are solving an unknown problem.</li>
        <li><strong>Buzzword stacking.</strong> Kafka, Kubernetes and microservices with no reason tied to a requirement.</li>
        <li><strong>Breadth without depth.</strong> Touching ten components but explaining none two levels down.</li>
        <li><strong>Ignoring the data.</strong> No schema, no partition key, no access patterns.</li>
        <li><strong>Only the happy path.</strong> No mention of timeouts, retries, duplicates or partial failure.</li>
        <li><strong>Defending instead of adapting.</strong> Treating the interviewer's challenge as an attack instead of new information.</li>
        <li><strong>Running out of time</strong> without a summary. The last impression counts.</li>
      </ul>

      <H2 id="ten-x">Handling “what if it's 10× bigger?”</H2>
      <p>This question tests whether your design has an understood scaling path. A strong structure:</p>
      <ol>
        <li>Redo the one or two estimates that change (write QPS, storage, fan-out).</li>
        <li>Identify the first component to saturate, and explain why it goes before the others.</li>
        <li>Apply the cheapest fix first: batching, caching, async work, compression. Re-architect only when the numbers require it.</li>
        <li>Mention cost: 10× traffic should cost less than 10× the money.</li>
      </ol>

      <H2 id="drill">Interview drill</H2>
      <InterviewQuestion
        q="Tell me about a system you designed that didn't scale the way you expected."
        senior={<p>Describe the system, what broke (for example DB load), and the fix (caching, replicas). Close with what you learned.</p>}
        staff={<>
          <p>Use STAR, but spend most of the time on <strong>reasoning and org impact</strong>: which assumption was wrong (for example, we assumed uniform tenant sizes), how you found it (the metrics that showed the skew), and the options you weighed.</p>
          <p>Cover how you sequenced the fix to protect customers and how you changed the process afterwards, such as capacity reviews or load tests in CI. That is the multiplier effect interviewers look for.</p>
        </>}
        followUps={['What would you design differently from day one?', 'How did you convince others to invest in the fix?']}
      />
      <InterviewQuestion
        q="The interviewer strongly disagrees with your database choice. How do you respond?"
        senior={<p>Explain the reasoning behind the choice. If their point is valid, switch to their suggestion.</p>}
        staff={<>
          <p>Treat it as information: ask what concern drives it (consistency? operations? query patterns?). Restate your requirement-based reasoning in one sentence, then evaluate their option against the same criteria.</p>
          <p>If it's a close call, say so and name the condition that would tip it. Being able to change your mind well is a positive signal; digging in or folding immediately are both negative ones.</p>
        </>}
      />

      <KeyTakeaways items={[
        'Staff signal comes from how you reason, not which technologies you name.',
        'Bring up the hard part yourself: what breaks first, and how the system degrades.',
        'Tie every trade-off to a requirement or number, and name what would change your mind.',
        'Add operability and cost: SLOs, rollout, migration, on-call.',
        'Drive the conversation and the clock, and finish with a summary and risks.',
      ]} />
    </>
  )
}
