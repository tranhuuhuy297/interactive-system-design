import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { highlight, type Lang } from './highlight-code'

interface CodeBlockProps {
  code: string
  lang?: Lang
  title?: string
}

export function CodeBlock({ code, lang = 'ts', title }: CodeBlockProps) {
  const trimmed = code.replace(/^\n+|\s+$/g, '')
  const html = useMemo(() => highlight(trimmed, lang), [trimmed, lang])
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trimmed)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked: silently ignore */
    }
  }
  return (
    <figure className="code-block">
      <figcaption className="code-block__bar">
        <span className="code-block__dots" aria-hidden><i /><i /><i /></span>
        <span className="code-block__title">{title ?? lang}</span>
        <button className="code-block__copy" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </figcaption>
      <pre><code dangerouslySetInnerHTML={{ __html: html }} /></pre>
    </figure>
  )
}
