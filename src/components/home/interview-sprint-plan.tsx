import { CalendarDays } from 'lucide-react'

const DAYS = [
  { day: 'Day 1', focus: 'Method & math', links: ['framework', 'estimation'], task: 'Estimate QPS, storage and bandwidth for three products in under 5 minutes each.' },
  { day: 'Day 2', focus: 'Scaling & networking', links: ['scaling', 'networking', 'load-balancing'], task: 'Draw the zero-to-millions evolution from memory, naming the bottleneck behind each step.' },
  { day: 'Day 3', focus: 'Data', links: ['caching', 'databases', 'consistency'], task: 'Explain quorums and Raft to a rubber duck. Pick a shard key for 3 workloads.' },
  { day: 'Day 4', focus: 'Async & resilience', links: ['messaging', 'rate-limiting', 'unique-ids', 'reliability'], task: 'Design exactly-once-effect processing with an outbox and idempotent consumers.' },
  { day: 'Day 5', focus: 'Classic cases', links: ['url-shortener', 'news-feed', 'chat', 'notifications', 'nearby-friends'], task: 'Do two cases out loud, 35 minutes each, then compare against the chapter.' },
  { day: 'Day 6', focus: 'Hard cases', links: ['kv-store', 'object-storage', 'payments', 'stock-exchange', 'reservations', 'ad-click'], task: 'Focus on correctness: durability math, money, deterministic ordering, double-booking, late events.' },
  { day: 'Day 7', focus: 'Modern systems + full mock', links: ['google-maps', 'collab-editor', 'llm-serving', 'mock', 'staff-signals', 'quiz'], task: 'Pick one modern prompt (maps, collaborative docs, LLM serving), run it as a timed mock, score yourself, fix your weakest rubric dimension.' },
]

export function InterviewSprintPlan() {
  return (
    <section className="sprint">
      <header className="track__head">
        <span className="track__num"><CalendarDays size={22} /></span>
        <div>
          <h2>7-day interview sprint</h2>
          <p>A suggested path if your loop is next week.</p>
        </div>
      </header>
      <ol className="sprint__list">
        {DAYS.map((d) => (
          <li key={d.day}>
            <span className="sprint__day">{d.day}</span>
            <div>
              <strong>{d.focus}</strong>
              <p>{d.task}</p>
              <div className="sprint__links">
                {d.links.map((l) => <a key={l} href={`#/${l}`}>#{l}</a>)}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
