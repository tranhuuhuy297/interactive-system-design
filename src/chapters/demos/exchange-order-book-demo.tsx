import { useEffect, useRef, useState } from 'react'
import { DemoFrame, Segmented } from '../../components/ui'
import { depth, emptyBook, randomOrder, rng, submit } from './exchange-matching-model'
import type { Book, OrderType, Side } from './exchange-matching-model'
import './exchange-demos.css'

function seedBook(): Book {
  let b = emptyBook()
  const rand = rng(7)
  for (let i = 1; i <= 14; i++) {
    const o = randomOrder(i, rand)
    if (o.type === 'limit') b = submit(b, o)
  }
  return b
}

export function ExchangeOrderBookDemo() {
  const [book, setBook] = useState<Book>(seedBook)
  const [side, setSide] = useState<Side>('buy')
  const [type, setType] = useState<OrderType>('limit')
  const [price, setPrice] = useState(100)
  const [qty, setQty] = useState(30)
  const [auto, setAuto] = useState(false)
  const nextId = useRef(100)
  const rand = useRef(rng(42))

  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => {
      setBook((b) => {
        const best = b.bids[0] && b.asks[0] ? (b.bids[0].price + b.asks[0].price) / 2 : 100
        return submit(b, randomOrder(nextId.current++, rand.current, Math.round(best * 10) / 10))
      })
    }, 700)
    return () => clearInterval(t)
  }, [auto])

  const send = () => setBook((b) => submit(b, { id: nextId.current++, side, type, price, qty }))
  const reset = () => { setAuto(false); setBook(seedBook()); nextId.current = 100 }

  const bids = depth(book.bids).slice(0, 7)
  const asks = depth(book.asks).slice(0, 7).reverse() // show best ask nearest the spread
  const maxQty = Math.max(1, ...bids.map((l) => l.qty), ...asks.map((l) => l.qty))
  const spread = book.bids[0] && book.asks[0] ? (book.asks[0].price - book.bids[0].price).toFixed(1) : '—'
  const tape = book.trades.slice(-8).reverse()

  return (
    <DemoFrame title="Order book + matching engine (price-time priority)" onReset={reset}
      hint="Send a buy limit at or above the best ask to cross the spread. Market orders sweep levels; any unfilled remainder is cancelled.">
      <div className="xo">
        <div className="xo__form">
          <Segmented label="Side" options={['buy', 'sell'] as const} value={side} onChange={setSide} />
          <Segmented label="Order type" options={['limit', 'market'] as const} value={type} onChange={setType} />
          <label className="xo__field"><span>Price</span>
            <input type="number" step={0.1} value={price} disabled={type === 'market'}
              onChange={(e) => setPrice(Math.round(Number(e.target.value) * 10) / 10)} />
          </label>
          <label className="xo__field"><span>Qty</span>
            <input type="number" min={1} step={10} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
          </label>
          <button className={`btn btn--primary btn--sm xo__send xo__send--${side}`} onClick={send}>
            {side === 'buy' ? 'Buy' : 'Sell'} {qty}{type === 'limit' ? ` @ ${price.toFixed(1)}` : ' @ MKT'}
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => setAuto((a) => !a)} aria-pressed={auto}>
            {auto ? 'Stop order flow' : 'Auto order flow'}
          </button>
        </div>

        <div className="xo__book" aria-label="Order book depth">
          <div className="xo__head"><span>Price</span><span>Size</span><span>Orders</span></div>
          {asks.map((l) => (
            <button key={`a${l.price}`} className="xo__lvl xo__lvl--ask" onClick={() => { setSide('buy'); setType('limit'); setPrice(l.price) }}>
              <i style={{ width: `${(l.qty / maxQty) * 100}%` }} />
              <span className="mono">{l.price.toFixed(1)}</span><span className="mono">{l.qty}</span><span className="mono">{l.count}</span>
            </button>
          ))}
          <div className="xo__spread">spread {spread}</div>
          {bids.map((l) => (
            <button key={`b${l.price}`} className="xo__lvl xo__lvl--bid" onClick={() => { setSide('sell'); setType('limit'); setPrice(l.price) }}>
              <i style={{ width: `${(l.qty / maxQty) * 100}%` }} />
              <span className="mono">{l.price.toFixed(1)}</span><span className="mono">{l.qty}</span><span className="mono">{l.count}</span>
            </button>
          ))}
          {!bids.length && !asks.length && <p className="xo__empty">Book is empty.</p>}
        </div>

        <div className="xo__tape">
          <div className="demo-label">Trades</div>
          {tape.length === 0 && <p className="xo__empty">No trades yet.</p>}
          <ul>
            {tape.map((t, i) => (
              <li key={`${t.seq}-${t.buyId}-${t.sellId}-${i}`} className={`xo__trade xo__trade--${t.aggressor}`}>
                <span className="mono">{t.price.toFixed(1)}</span><span className="mono">{t.qty}</span>
                <small>#{t.buyId}↔#{t.sellId}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DemoFrame>
  )
}
