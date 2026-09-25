import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...rest }: ButtonProps) {
  return <button className={`btn btn--${variant} btn--${size} ${className}`} {...rest} />
}

interface SegmentedProps<T extends string> {
  options: readonly T[] | { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  label: string
}

/** Single-choice pill group (radiogroup semantics). */
export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  const opts = (options as (T | { value: T; label: ReactNode })[]).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {opts.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value}
          className={`segmented__opt ${o.value === value ? 'is-active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}

export function Slider({ label, value, min, max, step = 1, onChange, format }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="slider">
      <span className="slider__top">
        <span>{label}</span>
        <output className="mono">{format ? format(value) : value}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        style={{ ['--pct' as string]: `${pct}%` }} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function Badge({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
