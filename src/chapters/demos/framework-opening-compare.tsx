import { useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import './framework-demos.css'

type Mode = 'weak' | 'strong'
interface Line { who: 'I' | 'C'; text: string; note?: string; tone?: 'good' | 'bad' }

const SCRIPTS: Record<Mode, Line[]> = {
  weak: [
    { who: 'I', text: 'Design a news feed.' },
    { who: 'C', text: "Sure. I'll use Kafka, Cassandra, and Redis, and put everything on Kubernetes.", note: 'Picks technologies before knowing the problem.', tone: 'bad' },
    { who: 'C', text: 'Users post, and a fan-out service pushes each post to followers.', note: 'Jumps into mechanism with no scale numbers.', tone: 'bad' },
    { who: 'I', text: 'What about users with 50 million followers?' },
    { who: 'C', text: "Hmm, we'd just add more workers.", note: 'Reacts instead of designing, and has no model of the load.', tone: 'bad' },
  ],
  strong: [
    { who: 'I', text: 'Design a news feed.' },
    { who: 'C', text: 'Before I draw anything: is this a follow graph like Twitter, or friends like Facebook? Is the feed ranked or chronological?', note: 'Clarifies the product shape, which drives everything else.', tone: 'good' },
    { who: 'C', text: "Say 300M DAU, about 1 post per user a day and 20 feed reads. That's about 3.5K writes/s and 70K reads/s, so the feed is read-heavy.", note: 'Anchors on numbers and derives the read:write skew.', tone: 'good' },
    { who: 'C', text: 'Follower counts are power-law distributed, so I expect a hybrid fan-out. I\'ll mark that as the deep dive and come back to it.', note: 'Names the hard part early and sets the agenda.', tone: 'good' },
    { who: 'C', text: "I'll sketch the API and the write and read paths first. Stop me if you'd like to focus somewhere else.", note: 'Drives the conversation while inviting steering.', tone: 'good' },
  ],
}

export function FrameworkOpeningCompare() {
  const [mode, setMode] = useState<Mode>('strong')
  return (
    <DemoFrame title="The first three minutes: weak vs strong opening" hint="Toggle to compare. The annotations show what the interviewer is writing down.">
      <Segmented label="Opening" value={mode} onChange={setMode}
        options={[{ value: 'weak', label: 'Weak opening' }, { value: 'strong', label: 'Strong opening' }]} />
      <ol className="fw-chat" key={mode}>
        {SCRIPTS[mode].map((l, i) => (
          <li key={i} className={`fw-chat__line fw-chat__line--${l.who === 'I' ? 'int' : 'cand'}`} style={{ animationDelay: `${i * 90}ms` }}>
            <span className="fw-chat__who">{l.who === 'I' ? 'Interviewer' : 'You'}</span>
            <p>{l.text}</p>
            {l.note && <span className={`fw-chat__note fw-chat__note--${l.tone}`}>{l.tone === 'good' ? '✓' : '✗'} {l.note}</span>}
          </li>
        ))}
      </ol>
    </DemoFrame>
  )
}
