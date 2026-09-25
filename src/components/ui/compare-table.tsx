import type { ReactNode } from 'react'

interface CompareTableProps {
  columns: string[]
  rows: { label: ReactNode; cells: ReactNode[] }[]
  caption?: string
}

/** Trade-off matrix. First column is the row label. */
export function CompareTable({ columns, rows, caption }: CompareTableProps) {
  return (
    <div className="compare">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th />
            {columns.map((c) => <th key={c} scope="col">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row">{r.label}</th>
              {r.cells.map((c, j) => <td key={j}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
