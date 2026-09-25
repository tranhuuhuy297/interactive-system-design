/** Toy availability model: one bit per night per listing (1 = booked). */
export const DAYS = 28
export const LISTINGS = ['Loft', 'Cabin', 'Studio', 'Villa', 'Houseboat', 'Treehouse', 'Flat', 'Cottage']

export interface Booking { listing: number; start: number; nights: number; guest: string }

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Non-overlapping random stays per listing. */
export function seedBookings(seed = 11): Booking[] {
  const rnd = mulberry32(seed)
  const out: Booking[] = []
  LISTINGS.forEach((_, l) => {
    let day = Math.floor(rnd() * 4)
    while (day < DAYS - 1) {
      const nights = 1 + Math.floor(rnd() * 5)
      if (day + nights > DAYS) break
      out.push({ listing: l, start: day, nights, guest: 'past guest' })
      day += nights + 1 + Math.floor(rnd() * 6)
    }
  })
  return out
}

export const rangeMask = (start: number, nights: number) => {
  const n = Math.max(0, Math.min(nights, DAYS - start))
  return n >= 32 ? 0xffffffff : ((((1 << n) >>> 0) - 1) << start) >>> 0
}

/** Materialized index: what a search cluster would hold per listing. */
export function buildBitsets(bookings: Booking[]): number[] {
  const bits = LISTINGS.map(() => 0)
  for (const b of bookings) bits[b.listing] = (bits[b.listing] | rangeMask(b.start, b.nights)) >>> 0
  return bits
}

export interface SearchResult { available: number[]; ops: number }

export function searchBitset(bits: number[], start: number, nights: number): SearchResult {
  const m = rangeMask(start, nights)
  return { available: bits.flatMap((b, i) => ((b & m) === 0 ? [i] : [])), ops: bits.length }
}

const overlaps = (b: Booking, start: number, nights: number) => b.start < start + nights && start < b.start + b.nights

/** Naive: walk the bookings table and test every row for overlap. */
export function searchScan(bookings: Booking[], start: number, nights: number): SearchResult {
  let ops = 0
  const blocked = new Set<number>()
  for (const b of bookings) {
    ops += 1
    if (overlaps(b, start, nights)) blocked.add(b.listing)
  }
  return { available: LISTINGS.map((_, i) => i).filter((i) => !blocked.has(i)), ops }
}

export type RaceMode = 'naive' | 'guarded'

/** Two guests read "available" at the same moment, then both try to book. */
export function raceBooking(bookings: Booking[], listing: number, start: number, nights: number, mode: RaceMode) {
  const log: string[] = []
  const next = [...bookings]
  const guests = ['Guest A', 'Guest B']
  log.push(`Both guests see ${LISTINGS[listing]} as available for nights ${start + 1}–${start + nights}.`)
  for (const g of guests) {
    const clash = next.some((b) => b.listing === listing && overlaps(b, start, nights))
    if (mode === 'guarded' && clash) {
      log.push(`${g}: rejected. The conditional write found the nights already taken, so the guest is offered alternatives.`)
      continue
    }
    next.push({ listing, start, nights, guest: g })
    log.push(clash ? `${g}: confirmed, which means a DOUBLE BOOKING. Two stays now overlap.` : `${g}: confirmed.`)
  }
  return { bookings: next, log }
}

/** Nights with more than one booking on the same listing. */
export function conflictNights(bookings: Booking[]): Set<string> {
  const count = new Map<string, number>()
  for (const b of bookings) for (let d = b.start; d < b.start + b.nights; d++) {
    const k = `${b.listing}:${d}`
    count.set(k, (count.get(k) ?? 0) + 1)
  }
  return new Set([...count].filter(([, c]) => c > 1).map(([k]) => k))
}
