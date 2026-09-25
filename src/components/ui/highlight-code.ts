/** Tiny regex highlighter: good enough for teaching snippets, zero deps. */
export type Lang = 'ts' | 'tsx' | 'css' | 'json' | 'bash' | 'text' | 'html'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const RULES: Record<string, [RegExp, string][]> = {
  ts: [
    [/\/\/[^\n]*|\/\*[\s\S]*?\*\//y, 'com'],
    [/`(?:\\.|[^`])*`|'(?:\\.|[^'\n])*'|"(?:\\.|[^"\n])*"/y, 'str'],
    [/<\/?[A-Za-z][\w.]*/y, 'tag'],
    [/\b(?:import|export|from|const|let|var|function|return|if|else|type|interface|extends|default|as|new|await|async|for|of|in|null|undefined|true|false|keyof|typeof|class|private|public|readonly|switch|case|break)\b/y, 'kw'],
    [/\b\d+(?:\.\d+)?\b/y, 'num'],
    [/\b[A-Za-z_$][\w$]*(?=\s*\()/y, 'fn'],
    [/\b[a-z][\w-]*(?==)/y, 'prop'],
  ],
  css: [
    [/\/\*[\s\S]*?\*\//y, 'com'],
    [/"[^"\n]*"|'[^'\n]*'/y, 'str'],
    [/--[\w-]+/y, 'prop'],
    [/@[\w-]+/y, 'kw'],
    [/\b[a-z-]+(?=\s*:)/y, 'fn'],
    [/-?\b\d+(?:\.\d+)?(?:px|rem|em|%|ms|s|vw|vh|deg)?\b/y, 'num'],
    [/\b(?:var|calc|clamp|oklch|color-mix|rgb|hsl|min|max)\b/y, 'kw'],
  ],
  json: [
    [/"(?:\\.|[^"\\])*"(?=\s*:)/y, 'prop'],
    [/"(?:\\.|[^"\\])*"/y, 'str'],
    [/-?\b\d+(?:\.\d+)?\b/y, 'num'],
    [/\b(?:true|false|null)\b/y, 'kw'],
  ],
  bash: [
    [/#[^\n]*/y, 'com'],
    [/"[^"\n]*"|'[^'\n]*'/y, 'str'],
    [/(?<=^|\n|\s)(?:npm|npx|pnpm|yarn|git|cd|node)\b/y, 'kw'],
    [/\s--?[\w-]+/y, 'prop'],
  ],
}
RULES.tsx = RULES.ts
RULES.html = [
  [/<!--[\s\S]*?-->/y, 'com'],
  [/<\/?[\w-]+/y, 'tag'],
  [/"[^"]*"/y, 'str'],
  [/\b[\w-]+(?==)/y, 'prop'],
]

export function highlight(code: string, lang: Lang): string {
  const rules = RULES[lang]
  if (!rules) return esc(code)
  let out = ''
  let plain = ''
  let i = 0
  while (i < code.length) {
    let matched = false
    for (const [re, cls] of rules) {
      re.lastIndex = i
      const m = re.exec(code)
      if (m && m[0].length > 0) {
        out += esc(plain) + `<span class="syn-${cls}">${esc(m[0])}</span>`
        plain = ''
        i += m[0].length
        matched = true
        break
      }
    }
    if (!matched) {
      // Consume a whole identifier so keywords don't match mid-word.
      const word = /[\w$]+/y
      word.lastIndex = i
      const w = word.exec(code)
      const chunk = w ? w[0] : code[i]
      plain += chunk
      i += chunk.length
    }
  }
  return out + esc(plain)
}
