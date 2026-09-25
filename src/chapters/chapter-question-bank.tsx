import { Callout, CompareTable, H2, KeyTakeaways } from '../components/ui'
import { QUESTION_BANK, Q_CATEGORIES } from '../data/question-bank-data'
import { QbankExplorer } from './demos/qbank-explorer'

export default function QuestionBankChapter() {
  const staffCount = QUESTION_BANK.filter((q) => q.level === 'staff').length
  return (
    <>
      <p>
        {QUESTION_BANK.length} questions across {Q_CATEGORIES.length} categories: the concept checks, follow-ups and
        trade-off probes that come up in system design loops. {staffCount} are tagged <strong>staff</strong>. On those,
        a correct mechanism is not enough; the interviewer is listening for failure modes, operability and the
        conditions under which you would choose differently.
      </p>
      <Callout kind="tip" title="How to drill">
        Answer out loud <em>before</em> flipping the card. Mark “Got it” only if you covered the staff points too.
        Marks are saved in your browser, so filter by <strong>Review</strong> tomorrow and go again.
      </Callout>

      <H2 id="drill">Drill</H2>
      <QbankExplorer />

      <H2 id="answer-shape">The shape of a staff answer</H2>
      <p>Strong answers to concept questions tend to follow the same arc. Use it as a checklist while you talk:</p>
      <CompareTable
        columns={['What it sounds like', 'Why it matters']}
        rows={[
          { label: '1. Direct answer', cells: ['“Short version: cache-aside with invalidate-on-write.”', 'Shows command of the topic in ten seconds'] },
          { label: '2. Mechanism', cells: ['How it works, with one concrete example or number', 'Proves depth beyond buzzwords'] },
          { label: '3. Failure mode', cells: ['“The thing that breaks first is the hot key on one shard…”', 'Staff engineers reason about how systems fail'] },
          { label: '4. Trade-off', cells: ['“The cost is staleness up to the TTL, acceptable because…”', 'Judgment tied to requirements, not dogma'] },
          { label: '5. Operability', cells: ['What you would monitor, alert on, and how you would roll it out', 'Shows you have run systems, not just drawn them'] },
        ]}
      />
      <Callout kind="staff">
        Interviewers keep asking follow-ups until you reach the edge of what you know. Saying “I haven't run that at
        this scale, but here's how I'd reason about it” counts <strong>in your favor</strong>. Confidently wrong numbers
        or mechanisms are the fastest way to a down-level.
      </Callout>

      <KeyTakeaways items={[
        'Practice out loud; recognizing an answer is not the same as producing it.',
        'Structure: direct answer, then mechanism, failure mode, trade-off and operability.',
        'Anchor claims in numbers and requirements, and name what would change your mind.',
        'Re-drill the cards marked “Review” until they move to “Got it”.',
      ]} />
    </>
  )
}
