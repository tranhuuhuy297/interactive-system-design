import type { ArchEdge, ArchNode, Reference } from '../../components/ui'

// Fixed 5×4 grid slots so nodes never move or overlap between stages (720px min canvas).
export const CN = {
  client: { id: 'client', label: 'Web + apps', kind: 'client', x: 10, y: 50 },
  safety: { id: 'safety', label: 'Safety checks', sub: 'input + output', kind: 'service', x: 10, y: 14 },
  media: { id: 'media', label: 'Speech + vision', sub: 'STT · TTS · images', kind: 'worker', x: 10, y: 86 },
  edge: { id: 'edge', label: 'API edge', sub: 'auth · streaming', kind: 'lb', x: 30, y: 50 },
  quota: { id: 'quota', label: 'Usage limits', sub: 'per user · plan', kind: 'cache', x: 30, y: 14 },
  files: { id: 'files', label: 'File store', sub: 'uploads', kind: 'storage', x: 30, y: 86 },
  chat: { id: 'chat', label: 'Orchestrator', sub: 'prompt + tool loop', kind: 'service', x: 50, y: 50 },
  memory: { id: 'memory', label: 'User memory', sub: 'saved facts', kind: 'db', x: 50, y: 14 },
  sandbox: { id: 'sandbox', label: 'Code sandbox', sub: 'isolated runs', kind: 'worker', x: 50, y: 86 },
  convdb: { id: 'convdb', label: 'Conversations', sub: 'message trees', kind: 'db', x: 70, y: 14 },
  queue: { id: 'queue', label: 'Scheduler', sub: 'priority by plan', kind: 'queue', x: 70, y: 50 },
  tools: { id: 'tools', label: 'Tool runner', sub: 'plugins · browsing', kind: 'service', x: 70, y: 86 },
  vector: { id: 'vector', label: 'Retrieval index', sub: 'files · knowledge', kind: 'search', x: 90, y: 14 },
  model: { id: 'model', label: 'Model servers', sub: 'GPU fleet', kind: 'worker', x: 90, y: 50 },
  web: { id: 'web', label: 'External APIs', sub: 'web · plugins', kind: 'external', x: 90, y: 86 },
} satisfies Record<string, ArchNode>

export const ce = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })

// openai.com pages block scripted requests (403); each was confirmed via web search.
export const GSRC = {
  launch: { title: 'Introducing ChatGPT', source: 'OpenAI', year: 2022, url: 'https://openai.com/index/chatgpt/', kind: 'blog', note: '30 Nov 2022 research preview' },
  plus: { title: 'Introducing ChatGPT Plus', source: 'OpenAI', year: 2023, url: 'https://openai.com/index/chatgpt-plus/', kind: 'blog' },
  streaming: { title: 'Streaming API responses', source: 'OpenAI API docs', url: 'https://developers.openai.com/api/docs/guides/streaming-responses', kind: 'docs' },
  sse: { title: 'Server-sent events', source: 'WHATWG HTML Standard', url: 'https://html.spec.whatwg.org/multipage/server-sent-events.html', kind: 'docs' },
  rateLimits: { title: 'Rate limits', source: 'OpenAI API docs', url: 'https://platform.openai.com/docs/guides/rate-limits', kind: 'docs', note: 'RPM/TPM, usage tiers' },
  plugins: { title: 'ChatGPT plugins', source: 'OpenAI', year: 2023, url: 'https://openai.com/index/chatgpt-plugins/', kind: 'blog', note: 'browsing, code interpreter' },
  functions: { title: 'Function calling and other API updates', source: 'OpenAI', year: 2023, url: 'https://openai.com/index/function-calling-and-other-api-updates/', kind: 'blog' },
  seeHear: { title: 'ChatGPT can now see, hear, and speak', source: 'OpenAI', year: 2023, url: 'https://openai.com/index/chatgpt-can-now-see-hear-and-speak/', kind: 'blog' },
  gpt4o: { title: 'Hello GPT-4o', source: 'OpenAI', year: 2024, url: 'https://openai.com/index/hello-gpt-4o/', kind: 'blog' },
  gpts: { title: 'Introducing GPTs', source: 'OpenAI', year: 2023, url: 'https://openai.com/index/introducing-gpts/', kind: 'blog' },
  wau: { title: 'OpenAI’s ChatGPT now has 100 million weekly active users', source: 'TechCrunch', year: 2023, url: 'https://techcrunch.com/2023/11/06/openais-chatgpt-now-has-100-million-weekly-active-users/', kind: 'blog' },
  memory: { title: 'Memory and new controls for ChatGPT', source: 'OpenAI', year: 2024, url: 'https://openai.com/index/memory-and-new-controls-for-chatgpt/', kind: 'blog' },
  moderation: { title: 'Moderation', source: 'OpenAI API docs', url: 'https://platform.openai.com/docs/guides/moderation', kind: 'docs' },
  microsoft: { title: 'Microsoft and OpenAI extend partnership', source: 'Official Microsoft Blog', year: 2023, url: 'https://blogs.microsoft.com/blog/2023/01/23/microsoftandopenaiextendpartnership/', kind: 'blog' },
  stargate: { title: 'Announcing The Stargate Project', source: 'OpenAI', year: 2025, url: 'https://openai.com/index/announcing-the-stargate-project/', kind: 'blog' },
} satisfies Record<string, Reference>
