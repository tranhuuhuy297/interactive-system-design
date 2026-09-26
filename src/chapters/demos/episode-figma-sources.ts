import type { Reference } from '../../components/ui'

// Primary public sources for the Figma episode; shared by stage deep dives and the chapter's Sources list.
export const FIGMA_SRC = {
  wiki: { title: 'Figma', source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Figma', kind: 'docs', note: 'founding, preview (Dec 2015), launch (Sep 2016), FigJam (2021)' },
  webTool: { title: 'Building a professional design tool on the web', source: 'Figma Blog (Evan Wallace)', year: 2015, url: 'https://www.figma.com/blog/building-a-professional-design-tool-on-the-web/', kind: 'blog', note: 'C++ → asm.js, WebGL renderer' },
  wasm: { title: 'WebAssembly cut Figma’s load time by 3x', source: 'Figma Blog', year: 2017, url: 'https://www.figma.com/blog/webassembly-cut-figmas-load-time-by-3x/', kind: 'blog' },
  rust: { title: 'Rust in production at Figma', source: 'Figma Blog', year: 2018, url: 'https://www.figma.com/blog/rust-in-production-at-figma/', kind: 'blog', note: 'Rust child process per document' },
  multiplayer: { title: 'How Figma’s multiplayer technology works', source: 'Figma Blog (Evan Wallace)', year: 2019, url: 'https://www.figma.com/blog/how-figmas-multiplayer-technology-works/', kind: 'blog', note: 'server authority, last-writer-wins per property' },
  plugins: { title: 'How to build a plugin system on the web and also sleep well at night', source: 'Figma Blog', year: 2019, url: 'https://www.figma.com/blog/how-we-built-the-figma-plugin-system/', kind: 'blog' },
  multipleDbs: { title: 'The growing pains of database architecture', source: 'Figma Blog', year: 2023, url: 'https://www.figma.com/blog/how-figma-scaled-to-multiple-databases/', kind: 'blog', note: 'tactical fixes, then vertical partitioning' },
  liveGraph: { title: 'GraphQL, meet LiveGraph: a real-time data system at scale', source: 'Figma Blog', year: 2021, url: 'https://www.figma.com/blog/livegraph-real-time-data-fetching-at-figma/', kind: 'blog' },
  journal: { title: 'Making multiplayer more reliable', source: 'Figma Blog', year: 2022, url: 'https://www.figma.com/blog/making-multiplayer-more-reliable/', kind: 'blog', note: 'write-ahead journal in DynamoDB' },
  sharding: { title: 'How Figma’s databases team lived to tell the scale', source: 'Figma Blog', year: 2024, url: 'https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/', kind: 'blog', note: 'horizontal sharding, colos, DBProxy' },
  liveGraph100x: { title: 'Keeping it 100(x) with real-time data at scale', source: 'Figma Blog', year: 2024, url: 'https://www.figma.com/blog/livegraph-real-time-data-at-scale/', kind: 'blog' },
  figjam: { title: 'Introducing FigJam', source: 'Figma Blog', year: 2021, url: 'https://www.figma.com/blog/introducing-figjam/', kind: 'blog' },
} satisfies Record<string, Reference>

export const FIGMA_REFS: Reference[] = Object.values(FIGMA_SRC)
