import {
  Callout, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, Requirements, Tabs,
} from '../components/ui'
import { FrameworkOpeningCompare } from './demos/framework-opening-compare'
import { FrameworkTimelinePlanner } from './demos/framework-timeline-planner'

export default function InterviewFrameworkChapter() {
  return (
    <>
      <p>
        A system design interview is not a quiz with a correct diagram at the end. It is a <strong>45-minute
        simulation of how you would lead a design review</strong>: you turn an ambiguous prompt into requirements,
        propose an architecture, defend trade-offs under pressure, and know where it will break. The framework
        below keeps you from the two classic failures, which are drowning in detail too early and never going
        deep at all.
      </p>

      <H2 id="four-steps">The four steps</H2>
      <FlowDiagram steps={[
        { label: '1 · Clarify & scope', sub: '~5–8 min · requirements, scale' },
        { label: '2 · High-level design', sub: '~10–15 min · API, data flow, buy-in' },
        { label: '3 · Deep dive', sub: '~15–20 min · bottlenecks, trade-offs' },
        { label: '4 · Wrap-up', sub: '~3–5 min · summary, evolution' },
      ]} caption="Typical 45-minute budget. Real loops vary, so ask how long you have." />
      <p>
        The budget matters more than the exact numbers. Candidates rarely fail because they lack knowledge. They
        fail because they spend 25 minutes on requirements, or draw boxes for 40 minutes without ever
        quantifying anything.
      </p>
      <FrameworkTimelinePlanner />

      <H2 id="clarify">Step 1 · Clarify and scope</H2>
      <p>
        Your first job is to shrink an unbounded prompt into something you can design in half an hour. Split
        requirements into what the system <em>does</em> and how <em>well</em> it must do it:
      </p>
      <Requirements
        functional={['The 3–5 user-visible capabilities you will design', 'Who the actors are (users, admins, other services)', 'Key flows: the one write and one read that matter most']}
        nonFunctional={['Scale: DAU, QPS, data volume, growth', 'Latency targets (p50 / p99)', 'Availability vs consistency preference', 'Durability, compliance, cost constraints']}
        outOfScope={['Anything you explicitly park, said out loud', 'Auth, billing, and admin tools unless central']}
      />
      <Callout kind="tip">
        Say your assumptions as numbers even if the interviewer is vague: “I'll assume 100M DAU. Tell me if that's
        off.” Numbers turn opinions into engineering. Most interviewers will simply agree, and you have now anchored
        the whole conversation.
      </Callout>
      <FrameworkOpeningCompare />

      <H2 id="high-level">Step 2 · High-level design and buy-in</H2>
      <ul>
        <li><strong>API first.</strong> Three to five endpoints or messages define the contract and the data you must store.</li>
        <li><strong>Draw the request path end to end</strong>: client → edge → service → storage. Keep it to 6–10 boxes.</li>
        <li><strong>Walk one write and one read</strong> through the diagram out loud. This catches missing components.</li>
        <li><strong>Choose data stores deliberately</strong> and say why: access pattern, consistency need, scale.</li>
        <li><strong>Check in</strong>: “Does this shape look reasonable before I go deeper?” Buy-in keeps you from designing the wrong system.</li>
      </ul>
      <Tabs items={[
        { label: 'What goes on the board', content: (
          <CompareTable columns={['Always', 'Usually', 'Only if asked']} rows={[
            { label: 'Content', cells: ['Requirements + numbers, API, box diagram', 'Data model / schema, key algorithm', 'Class diagrams, exact library choices'] },
            { label: 'Why', cells: ['Anchors every later decision', 'Where depth is demonstrated', 'Low signal for the time spent'] },
          ]} />
        ) },
        { label: 'Signals interviewers look for', content: (
          <ul>
            <li>Problem navigation: did you scope it, or did it scope you?</li>
            <li>Solution design: is the architecture coherent and matched to requirements?</li>
            <li>Technical depth: can you go two levels deeper on any box?</li>
            <li>Communication: can others follow and challenge your reasoning?</li>
          </ul>
        ) },
      ]} />

      <H2 id="deep-dive">Step 3 · Deep dive</H2>
      <p>
        This is where levels are decided. Pick the one or two components where the system is actually hard, or let
        the interviewer pick, and go deep with numbers. A good deep dive has a rhythm:
      </p>
      <FlowDiagram steps={[
        { label: 'Quantify', sub: 'what load hits this box?' },
        { label: 'Options', sub: '≥ 2 real alternatives' },
        { label: 'Trade-offs', sub: 'latency · cost · complexity · consistency' },
        { label: 'Decide', sub: 'commit, with a reason' },
        { label: 'Failure', sub: 'what breaks, how we recover' },
      ]} />
      <Callout kind="pitfall">
        Listing technologies is not depth. “Use Kafka” earns nothing. “Partition the topic by user ID so each user's
        events stay ordered, and size for 3× peak so a consumer lag spike drains in under 10 minutes” earns a lot.
      </Callout>

      <H2 id="wrap-up">Step 4 · Wrap-up</H2>
      <p>
        Leave three to five minutes. Summarize the design in two sentences, name the bottlenecks you would watch,
        and describe what changes at 10× scale. Interviewers remember endings. A calm, honest summary beats
        cramming in one more feature.
      </p>

      <H2 id="staff">Staff-level extensions</H2>
      <Callout kind="staff">
        <p>Senior candidates design a system that works. Staff candidates design a system an organization can <strong>run, evolve, and afford</strong>. Weave these in without being asked:</p>
        <ul>
          <li><strong>Trade-off narration</strong>: every decision states what you gave up. “Eventual consistency here, because a stale like count costs nothing and strong consistency would add a cross-region round trip.”</li>
          <li><strong>Failure modes</strong>: node loss, network partition, region outage, poison messages, retry storms.</li>
          <li><strong>Evolution</strong>: the v1 you would ship in a quarter versus the v3 at 100× scale, and what triggers each migration.</li>
          <li><strong>Cost</strong>: storage tiering, egress, and cache sizing expressed in dollars or machines.</li>
          <li><strong>Operability and org</strong>: SLOs, dashboards, on-call burden, which team owns which service, how you roll out safely.</li>
        </ul>
      </Callout>

      <H2 id="anti-patterns">Anti-patterns that sink candidates</H2>
      <CompareTable columns={['What it looks like', 'What to do instead']} rows={[
        { label: 'Silent drawing', cells: ['Minutes of boxes with no narration', 'Think out loud. The interviewer grades reasoning, not art.'] },
        { label: 'Buzzword bingo', cells: ['Microservices, Kafka, and Kubernetes in the first minute', 'Start simple and add components only when a requirement forces it'] },
        { label: 'Premature depth', cells: ['Designing the DB schema before the API exists', 'Breadth first, then depth where it matters'] },
        { label: 'Single option', cells: ['“We use Cassandra.”', '“Cassandra vs Postgres: here is the deciding factor.”'] },
        { label: 'Defensive', cells: ['Arguing when the interviewer pushes back', 'Treat pushback as a new requirement and adapt visibly'] },
      ]} />

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="The interviewer says only “Design Instagram.” What do you do in the first five minutes?"
        senior={<p>Ask clarifying questions: which features (upload, feed, follow, likes?), how many users, and whether it's mobile or web. Then write the functional and non-functional requirements and start the high-level design.</p>}
        staff={<>
          <p>I'd propose a scope instead of asking an open-ended list: “I'll focus on photo upload and the home feed and park stories, DMs, and search. I'll assume 500M DAU with a feed that is roughly 100:1 read-heavy.” Then I derive the numbers that shape the architecture: upload QPS, media storage per year, feed read QPS.</p>
          <p>I also name the two hard problems up front, media delivery cost (CDN and storage tiering) and feed fan-out for celebrity accounts, so the interviewer sees where I'll spend depth. Proposing a scope shows judgment, and it is easier for them to correct than to answer ten questions.</p>
        </>}
        followUps={['What if the interviewer rejects your scope?', 'Which non-functional requirement would change your design the most?']}
      />
      <InterviewQuestion
        q="You're 30 minutes in and realize your data model can't support a requirement. What now?"
        senior={<p>Acknowledge the problem, go back and fix the data model, then continue with the deep dive.</p>}
        staff={<>
          <p>I'd call it out immediately: “I've spotted a flaw. My partition key doesn't support query X.” Then I'd weigh a minimal fix, such as a secondary index or a denormalized read model fed by CDC, against a redesign, and pick the one that fits the remaining time.</p>
          <p>Catching your own mistake is a <strong>positive</strong> signal. It is exactly what happens in real design reviews, and interviewers note self-correction far more favorably than a flaw they had to point out.</p>
        </>}
        followUps={['How would you migrate the live data to the new model?']}
      />

      <KeyTakeaways items={[
        'Four steps (clarify, high-level, deep dive, wrap-up), budgeted roughly 7 / 12 / 18 / 5 minutes.',
        'Anchor on numbers early. Assumptions stated as numbers turn opinions into engineering.',
        'Get buy-in on the high-level design before going deep.',
        'Depth means quantify, compare two or more options, decide, then cover failures.',
        'Staff signal: narrate trade-offs, failure modes, evolution, cost, and operability without being asked.',
      ]} />
    </>
  )
}
