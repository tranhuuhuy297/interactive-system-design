import type { ReactNode } from 'react'
import { CheckCircle2, CircleSlash, Gauge } from 'lucide-react'

/** Functional / non-functional / out-of-scope requirements, the first thing to pin down. */
export function Requirements({ functional, nonFunctional, outOfScope }: { functional: string[]; nonFunctional: string[]; outOfScope?: string[] }) {
  return (
    <div className="reqs">
      <div className="reqs__col">
        <div className="reqs__title"><CheckCircle2 size={15} /> Functional</div>
        <ul>{functional.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
      <div className="reqs__col reqs__col--nfr">
        <div className="reqs__title"><Gauge size={15} /> Non-functional</div>
        <ul>{nonFunctional.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
      {outOfScope && (
        <div className="reqs__col reqs__col--out">
          <div className="reqs__title"><CircleSlash size={15} /> Out of scope</div>
          <ul>{outOfScope.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

interface EstimateRow { label: string; math: string; result: string }

/** Back-of-the-envelope table: show the arithmetic, not just the answer. */
export function EstimationTable({ rows, assumptions }: { rows: EstimateRow[]; assumptions?: string[] }) {
  return (
    <div className="estim">
      {assumptions && (
        <div className="estim__assume">
          <span className="demo-label">Assumptions</span>
          <ul>{assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="mono estim__math">{r.math}</td>
              <td className="mono estim__res">{r.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface Endpoint { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'WS'; path: string; desc: ReactNode; body?: string; returns?: string }

/** Compact API contract listing. */
export function ApiSpec({ endpoints }: { endpoints: Endpoint[] }) {
  return (
    <div className="api">
      {endpoints.map((e) => (
        <div key={e.method + e.path} className="api__row">
          <span className={`api__method api__method--${e.method.toLowerCase()}`}>{e.method}</span>
          <code className="api__path">{e.path}</code>
          <div className="api__desc">
            {e.desc}
            {(e.body || e.returns) && (
              <div className="api__io mono">
                {e.body && <span><b>body</b> {e.body}</span>}
                {e.returns && <span><b>→</b> {e.returns}</span>}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
