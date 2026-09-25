import { useState } from 'react'
import { DemoFrame, Segmented, Slider } from '../../components/ui'
import './url-base62-encoder-demo.css'

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function toBase62(n: bigint): string {
  if (n === 0n) return '0'
  let out = ''
  while (n > 0n) { out = ALPHABET[Number(n % 62n)] + out; n /= 62n }
  return out
}

/** Non-cryptographic 32-bit FNV-1a: enough to demonstrate hash-then-truncate collisions. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h
}

type Strategy = 'counter' | 'hash'

export function UrlBase62EncoderDemo() {
  const [strategy, setStrategy] = useState<Strategy>('counter')
  const [counter, setCounter] = useState(125_000_000_000)
  const [len, setLen] = useState(7)
  const [url, setUrl] = useState('https://example.com/articles/how-to-design-a-url-shortener')
  const [issued, setIssued] = useState<{ long: string; code: string; clash: boolean }[]>([])

  const capacity = 62n ** BigInt(len)
  const code = strategy === 'counter'
    ? toBase62(BigInt(counter))
    : toBase62(BigInt(fnv1a(url))).padStart(len, '0').slice(0, len)

  const shorten = () => {
    const clash = issued.some((i) => i.code === code && i.long !== url)
    setIssued((prev) => [{ long: url, code, clash }, ...prev].slice(0, 6))
    if (strategy === 'counter') setCounter((c) => c + 1)
  }

  const reset = () => { setIssued([]); setCounter(125_000_000_000); setLen(7) }

  return (
    <DemoFrame title="Generate short codes: counter + base62 vs hash + truncate" onReset={reset}
      hint="Shorten the same URL twice, or edit it slightly, and compare what each strategy does.">
      <div className="b62">
        <div className="demo-controls">
          <Segmented label="Strategy" value={strategy} onChange={setStrategy}
            options={[{ value: 'counter', label: 'Counter → base62' }, { value: 'hash', label: 'Hash → truncate' }]} />
          <label className="b62__field">
            <span className="demo-label">Long URL</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
          </label>
          <Slider label="Code length" min={5} max={9} value={len} onChange={setLen} />
          <div className="b62__cap">
            <span>62<sup>{len}</sup> =</span>
            <strong className="mono">{capacity.toLocaleString('en-US')}</strong>
            <span>codes</span>
          </div>
          <button className="btn btn--primary btn--md" onClick={shorten}>Shorten</button>
        </div>

        <div className="demo-stage b62__stage">
          <div className="demo-label">{strategy === 'counter' ? `Counter value ${counter.toLocaleString('en-US')}` : `FNV-1a(url) = ${fnv1a(url)}`}</div>
          <div className="b62__code mono">sho.rt/<b>{code}</b></div>
          {strategy === 'counter' && code.length > len && (
            <p className="b62__warn" role="status">Counter needs {code.length} characters. A {len}-character code space is already exhausted at this volume.</p>
          )}
          <ul className="b62__log">
            {issued.length === 0 && <li className="b62__empty">No codes yet.</li>}
            {issued.map((i, k) => (
              <li key={k} className={i.clash ? 'is-clash' : ''}>
                <code>{i.code}</code>
                <span>{i.long}</span>
                {i.clash && <em>collision!</em>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DemoFrame>
  )
}
