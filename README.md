# Blueprint — The System Design Handbook

**Live site:** https://tranhuuhuy297.github.io/interactive-system-design/

Interactive system design handbook for staff-engineer interview prep: original explanations, live
simulations, animated architecture diagrams, and senior-vs-staff model answers. Every chapter cites its
sources in a References section.

- **Foundations**: interview framework, back-of-the-envelope estimation, scaling zero → millions, networking/APIs
- **Building blocks**: load balancing & consistent hashing, caching, databases & sharding, replication/consensus,
  queues & streams, rate limiting, unique IDs, reliability & observability
- **Case studies**: URL shortener, news feed, chat, notifications, autocomplete, web crawler, video platform,
  file sync, proximity, distributed KV store, payments, leaderboard, ad-click aggregation, reservations, metrics,
  Google Maps, nearby friends, object storage, stock exchange, collaborative editor, LLM inference platform
- **Episodes**: story-driven "how to build X" from v0 to planet scale, with a stage-by-stage episode player —
  Netflix, Stripe payments, Uber, Discord, Instagram, Amazon checkout, Spotify, Airbnb, ChatGPT
- **AI Systems**: LLM inference (prefill/decode, KV cache, batching, speculative decoding, parallelism, serving
  stacks), LLM engineering (prompting & structured output, RAG, fine-tuning decisions, evals), AI engineering
  (agents & tools, production LLM apps, safety & security), plus case studies: enterprise RAG assistant,
  AI coding assistant, LLM gateway
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

## Sources, credits & disclaimer

- All text, diagrams, and simulations are original. Chapters list their primary sources (papers, RFCs,
  official docs, engineering blogs) under **References**; episodes list theirs under **Sources**.
- Recommended further reading that shaped how this field is taught: Alex Xu, *System Design Interview*
  Vol. 1 (2020) and Vol. 2 with Sahn Lam (2022); Martin Kleppmann, *Designing Data-Intensive Applications*
  (2017); Google's SRE books; the Amazon Builders' Library. This project does not reproduce their content.
- Company and product names are trademarks of their respective owners, used only to describe publicly
  documented engineering. This project is independent and not affiliated with or endorsed by any of them.
- Simulations are simplified teaching models; their numbers are illustrative, not benchmarks.
- Spot an error or a rights concern? Please [open an issue](https://github.com/tranhuuhuy297/interactive-system-design/issues).

## License

- Code: [MIT](LICENSE)
- Written content: [CC BY-NC 4.0](LICENSE-CONTENT.md)
- Third-party: Geist fonts (SIL OFL 1.1), Lucide icons (ISC), React / Motion / Vite (MIT)
