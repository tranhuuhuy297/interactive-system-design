# Blueprint — The System Design Handbook

**Live site:** https://tranhuuhuy297.github.io/interactive-system-design/

Interactive system design handbook for staff-engineer interview prep. It covers the topics of the classic
system-design interview books with original content, adding live simulations, animated architecture
diagrams, and senior-vs-staff model answers.

- **Foundations**: interview framework, back-of-the-envelope estimation, scaling zero → millions, networking/APIs
- **Building blocks**: load balancing & consistent hashing, caching, databases & sharding, replication/consensus,
  queues & streams, rate limiting, unique IDs, reliability & observability
- **Case studies**: URL shortener, news feed, chat, notifications, autocomplete, web crawler, video platform,
  file sync, proximity, distributed KV store, payments, leaderboard, ad-click aggregation, reservations, metrics
- **Episodes**: story-driven "how to build X" from v0 to planet scale, with a stage-by-stage episode player —
  Netflix, Stripe payments, Uber, Discord, Instagram, Amazon checkout, Spotify, Airbnb, ChatGPT
- **Interview**: staff-level signals, mock interview simulator, question bank (flashcards), scored quiz

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle in dist/
```

## Layout

```
src/
  styles/            tokens.css (primitive → semantic), base.css (reset + prose)
  lib/               hash routing, localStorage state (keys prefixed sdh:), progress, theme
  data/              chapter registry, question bank, quiz, mock prompts
  components/ui/     shared kit: ArchitectureDiagram, Requirements, EstimationTable, ApiSpec,
                     Callout, CodeBlock, DemoFrame, InterviewQuestion, Tabs…
  components/shell/  sidebar, top bar, ⌘K palette, chapter view, TOC
  components/home/   landing page, live traffic simulator hero, 7-day sprint
  chapters/          one file per chapter; demos/ holds the simulations
```

Add a chapter: create `src/chapters/chapter-<slug>.tsx` (default export) and register it in
`src/data/chapters-registry.ts`. Case studies follow `chapter-case-url-shortener.tsx`.
