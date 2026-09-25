/** Price-time priority limit order book with deterministic matching (single-threaded, like a real engine's hot path). */
export type Side = 'buy' | 'sell'
export type OrderType = 'limit' | 'market'

export interface Order { id: number; side: Side; type: OrderType; price: number; qty: number; seq: number }
export interface Trade { seq: number; buyId: number; sellId: number; price: number; qty: number; aggressor: Side }

export interface Book {
  bids: Order[] // best (highest) first, then earliest seq
  asks: Order[] // best (lowest) first, then earliest seq
  trades: Trade[]
  nextSeq: number
}

export const emptyBook = (): Book => ({ bids: [], asks: [], trades: [], nextSeq: 1 })

export type NewOrder = { id: number; side: Side; type: OrderType; price: number; qty: number }

const crosses = (o: Order, best: Order) => o.type === 'market' || (o.side === 'buy' ? o.price >= best.price : o.price <= best.price)

/** Pure: returns a new book. Market-order remainder is cancelled (IOC semantics). */
export function submit(book: Book, input: NewOrder): Book {
  const seq = book.nextSeq
  const order: Order = { ...input, seq }
  const bids = book.bids.map((o) => ({ ...o }))
  const asks = book.asks.map((o) => ({ ...o }))
  const trades = [...book.trades]
  const opposite = order.side === 'buy' ? asks : bids

  while (order.qty > 0 && opposite.length > 0 && crosses(order, opposite[0])) {
    const resting = opposite[0]
    const qty = Math.min(order.qty, resting.qty)
    trades.push({
      seq, price: resting.price, qty, aggressor: order.side, // trade prints at the resting order's price
      buyId: order.side === 'buy' ? order.id : resting.id,
      sellId: order.side === 'sell' ? order.id : resting.id,
    })
    order.qty -= qty
    resting.qty -= qty
    if (resting.qty === 0) opposite.shift()
  }

  if (order.qty > 0 && order.type === 'limit') {
    const own = order.side === 'buy' ? bids : asks
    const better = (a: Order) => (order.side === 'buy' ? a.price < order.price : a.price > order.price)
    const idx = own.findIndex(better) // insert after all equal-priced orders → time priority
    own.splice(idx === -1 ? own.length : idx, 0, order)
  }
  return { bids, asks, trades, nextSeq: seq + 1 }
}

/** Aggregate resting orders into price levels for L2 market data. */
export function depth(orders: Order[]): { price: number; qty: number; count: number }[] {
  const levels: { price: number; qty: number; count: number }[] = []
  for (const o of orders) {
    const last = levels[levels.length - 1]
    if (last && last.price === o.price) { last.qty += o.qty; last.count += 1 }
    else levels.push({ price: o.price, qty: o.qty, count: 1 })
  }
  return levels
}

/** Deterministic fingerprint of book state, used to prove replicas converge. */
export function stateHash(book: Book): string {
  const s = JSON.stringify([book.bids, book.asks, book.trades.length])
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

export const replay = (log: NewOrder[]): Book => log.reduce(submit, emptyBook())

/** Seeded PRNG so generated order flow is reproducible. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 }
}

export function randomOrder(id: number, rand: () => number, mid = 100): NewOrder {
  const side: Side = rand() < 0.5 ? 'buy' : 'sell'
  const type: OrderType = rand() < 0.15 ? 'market' : 'limit'
  const offset = Math.round((rand() * 4 - 1) * 10) / 10 // mostly passive, sometimes crossing
  const price = Math.round((side === 'buy' ? mid - offset : mid + offset) * 10) / 10
  return { id, side, type, price, qty: 1 + Math.floor(rand() * 9) * 10 }
}
