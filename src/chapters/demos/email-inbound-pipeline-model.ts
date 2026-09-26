// Toy model of an inbound mail pipeline: DMARC check, then a spam score threshold.
// Populations and score distributions are illustrative, chosen to show the trade-offs.

export type MailKind = 'legit' | 'forwarded' | 'spam' | 'spoof' | 'phish'
export type Verdict = 'inbox' | 'spam' | 'reject'

export interface Mail {
  kind: MailKind
  spfAligned: boolean
  dkimAligned: boolean
  /** Sending domain publishes p=reject. */
  policyReject: boolean
  score: number
}

export interface PipelineSettings {
  enforceDmarc: boolean
  spamThreshold: number
  rejectThreshold: number
}

const MIX: [MailKind, number][] = [['legit', 0.55], ['forwarded', 0.07], ['spam', 0.25], ['spoof', 0.08], ['phish', 0.05]]
const SCORE: Record<MailKind, [number, number]> = {
  legit: [2, 1.4], forwarded: [2.6, 1.4], spam: [7.4, 1.3], spoof: [5.2, 1.8], phish: [5.8, 1.5],
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic sample so every reader sees the same numbers. */
export function sampleMail(n = 400, seed = 7): Mail[] {
  const rnd = mulberry32(seed)
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd())
  const out: Mail[] = []
  for (let i = 0; i < n; i++) {
    let r = rnd(), kind: MailKind = 'legit'
    for (const [k, p] of MIX) { if (r < p) { kind = k; break } r -= p }
    const [mu, sd] = SCORE[kind]
    const score = Math.min(10, Math.max(0, mu + sd * gauss()))
    // Forwarding rewrites the envelope, so SPF breaks; DKIM usually survives (a few lists alter the body).
    const brokenDkim = kind === 'forwarded' && rnd() < 0.2
    out.push({
      kind, score,
      spfAligned: kind === 'legit' || kind === 'phish' || (kind === 'spam' && rnd() < 0.5),
      dkimAligned: kind === 'legit' || kind === 'phish' || (kind === 'forwarded' && !brokenDkim) || (kind === 'spam' && rnd() < 0.4),
      policyReject: kind === 'spoof' || (kind === 'forwarded' && rnd() < 0.5) || (kind === 'legit' && rnd() < 0.3),
    })
  }
  return out
}

export const isWanted = (k: MailKind) => k === 'legit' || k === 'forwarded'

export function route(m: Mail, s: PipelineSettings): Verdict {
  const dmarcPass = m.spfAligned || m.dkimAligned
  if (s.enforceDmarc && !dmarcPass && m.policyReject) return 'reject'
  if (m.score >= s.rejectThreshold) return 'reject'
  if (m.score >= s.spamThreshold) return 'spam'
  return 'inbox'
}

export interface PipelineStats {
  counts: Record<Verdict, { wanted: number; unwanted: number }>
  /** Wanted mail that did not reach the inbox. */
  falsePositiveRate: number
  /** Unwanted mail kept out of the inbox. */
  catchRate: number
  spoofsInInbox: number
}

export function runPipeline(mail: Mail[], s: PipelineSettings): PipelineStats {
  const counts: PipelineStats['counts'] = {
    inbox: { wanted: 0, unwanted: 0 }, spam: { wanted: 0, unwanted: 0 }, reject: { wanted: 0, unwanted: 0 },
  }
  let wanted = 0, unwanted = 0, spoofsInInbox = 0
  for (const m of mail) {
    const v = route(m, s)
    const w = isWanted(m.kind)
    if (w) { wanted++; counts[v].wanted++ } else { unwanted++; counts[v].unwanted++ }
    if (m.kind === 'spoof' && v === 'inbox') spoofsInInbox++
  }
  return {
    counts,
    falsePositiveRate: wanted ? (wanted - counts.inbox.wanted) / wanted : 0,
    catchRate: unwanted ? (unwanted - counts.inbox.unwanted) / unwanted : 0,
    spoofsInInbox,
  }
}
