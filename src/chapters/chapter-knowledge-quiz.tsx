import { Callout, H2, KeyTakeaways, References } from '../components/ui'
import { INTERVIEW_FURTHER_READING } from '../data/interview-further-reading'
import { QUIZ } from '../data/quiz-data'
import { QuizRunner } from './demos/quiz-runner'

export default function KnowledgeQuizChapter() {
  const topics = Array.from(new Set(QUIZ.map((q) => q.topic)))
  return (
    <>
      <p>
        A fast, scored check of the facts: latency numbers, quorum math, Kafka semantics, rate-limiter behavior.
        System design interviews are mostly about judgment, but <strong>one wrong fact undermines every decision you
        build on it</strong>. Aim for 90% before your loop.
      </p>
      <Callout kind="tip">
        Turn the timer on for your second run. Thirty seconds per question is about the pace of the quick concept
        checks interviewers slip into a design discussion.
      </Callout>

      <H2 id="quiz">Take the quiz</H2>
      <p>Ten random questions by default. Use keys 1–4 to answer and Enter to continue.</p>
      <QuizRunner />

      <H2 id="coverage">What it covers</H2>
      <p>
        {QUIZ.length} questions across {topics.length} topics: {topics.join(', ')}. Every question has an explanation.
        Read it even when you get the answer right.
      </p>
      <Callout kind="staff">
        Facts are the minimum. In the interview, always attach the consequence. Not just “R + W &gt; N gives
        overlap”, but “so with N=3 I'd use W=2, R=2, and I accept that a two-node outage makes the key unavailable
        for writes.”
      </Callout>

      <H2 id="further-reading">Further reading</H2>
      <References items={INTERVIEW_FURTHER_READING} />

      <KeyTakeaways items={[
        'Know the numbers cold: seconds in a day, the latency ladder, nines of availability, base62 capacity.',
        'Understand mechanisms: quorum overlap, Raft commit, partition ordering, offset commit semantics.',
        'Review your misses and go back to the chapter that covers them.',
        'In the interview, follow every fact with what it means for the design.',
      ]} />
    </>
  )
}
