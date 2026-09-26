import { CalendarClock, CheckCheck, Copy, Crown, Database, KeyRound, ListOrdered, Lock, Mail, Search, ShieldCheck, Timer } from 'lucide-react'
import type { MentalModelData } from './mental-model-types'

export const MENTAL_MODELS_CASES_C: MentalModelData[] = [
  {
    id: 'email-service',
    idea: 'Accept mail only after proving the sender, then store small metadata apart from big bodies.',
    picture: [
      { icon: Mail, label: 'SMTP accepts' },
      { icon: ShieldCheck, label: 'SPF · DKIM · DMARC + spam score' },
      { icon: Database, label: 'Metadata by user, body in blobs' },
      { icon: Search, label: 'Per-mailbox index' },
    ],
    analogy: 'a post office that checks the return address, files a card in your drawer, and keeps the parcel in the back room.',
    hook: 'Authenticate at the door, index per mailbox, never lose an accepted message.',
  },
  {
    id: 'message-queue',
    idea: 'A topic is a set of append-only logs; replicas copy the leader and consumers track offsets.',
    picture: [
      { icon: ListOrdered, label: 'Append to partition' },
      { icon: Copy, label: 'Followers replicate' },
      { icon: Crown, label: 'High watermark = safe' },
      { icon: CheckCheck, label: 'Consumers commit offsets' },
    ],
    analogy: 'a numbered ledger copied by clerks; you only read up to the last line every clerk has written.',
    hook: 'Append, replicate, commit; readers stop at the high watermark.',
  },
  {
    id: 'job-scheduler',
    idea: 'Find due runs by time bucket, lease them to workers, and make every run safe to repeat.',
    picture: [
      { icon: CalendarClock, label: 'Due-time buckets' },
      { icon: Lock, label: 'Claim with a lease' },
      { icon: Timer, label: 'Heartbeat or expire' },
      { icon: KeyRound, label: 'Idempotent by run id' },
    ],
    analogy: 'library holds that lapse if you do not renew them, so the next person in line can take the book.',
    hook: 'Leases expire, workers die; idempotency keys make retries boring.',
  },
]
