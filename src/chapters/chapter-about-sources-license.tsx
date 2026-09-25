import { Callout, CompareTable, H2, References } from '../components/ui'
import type { Reference } from '../components/ui'

const REPO = 'https://github.com/tranhuuhuy297/interactive-system-design'

const FURTHER_READING: Reference[] = [
  { title: 'System Design Interview – An Insider’s Guide (Vol. 1)', source: 'Alex Xu', year: 2020, kind: 'book',
    note: 'Popularized many of the case-study prompts covered here' },
  { title: 'System Design Interview – An Insider’s Guide (Vol. 2)', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book' },
  { title: 'ByteByteGo', source: 'Alex Xu et al.', url: 'https://bytebytego.com/', kind: 'blog', note: 'The authors’ ongoing newsletter and course' },
  { title: 'Designing Data-Intensive Applications', source: 'Martin Kleppmann (O’Reilly)', year: 2017, url: 'https://dataintensive.net/', kind: 'book' },
  { title: 'Site Reliability Engineering & The Site Reliability Workbook', source: 'Google', url: 'https://sre.google/books/', kind: 'book', note: 'Free online' },
  { title: 'The Amazon Builders’ Library', source: 'Amazon Web Services', url: 'https://aws.amazon.com/builders-library/', kind: 'docs' },
]

export default function AboutChapter() {
  return (
    <>
      <p>
        Blueprint is an <strong>independent, non-commercial educational project</strong> for learning system design and
        preparing for senior and staff-level interviews. This page explains where the material comes from, how to
        check it, and how you may reuse it.
      </p>

      <H2 id="original-work">Original work, cited sources</H2>
      <ul>
        <li>All explanations, diagrams, simulations, and interview answers are <strong>written from scratch</strong> for this site. No text, figures, or diagrams are reproduced from books, courses, or blogs.</li>
        <li>Ideas, algorithms, and common interview prompts (e.g. “design a URL shortener”) are shared industry knowledge. Where a chapter relies on a specific paper, RFC, documentation page, or engineering blog, it is listed in that chapter’s <strong>References</strong> section.</li>
        <li>Company-specific facts in the <strong>Episodes</strong> (“In the real world”) come from public sources such as engineering blogs, papers, and talks. Each episode lists them under <strong>Sources</strong>. Where public detail is thin, the text says so and describes general industry practice instead.</li>
        <li>Simulations are <strong>simplified teaching models</strong>. Their numbers are illustrative, not benchmarks of any real system.</li>
      </ul>

      <H2 id="trademarks">Trademarks & affiliation</H2>
      <p>
        Netflix, Stripe, Uber, Discord, Instagram, Amazon, Spotify, Airbnb, OpenAI/ChatGPT, Google, and every other
        company or product named on this site are trademarks of their respective owners. They are mentioned only to
        describe publicly documented engineering. <strong>This project is not affiliated with, sponsored by, or
        endorsed by any of them.</strong> The episodes are independent reconstructions for learning. They are not
        official architecture descriptions.
      </p>

      <H2 id="further-reading">Recommended reading</H2>
      <p>
        These books and resources shaped how system design is taught and interviewed. They are credited here as
        recommended reading, and they go deeper than this site on many topics. Please support the authors.
      </p>
      <References items={FURTHER_READING} />

      <H2 id="license">License</H2>
      <CompareTable
        columns={['License', 'What it allows']}
        rows={[
          { label: 'Source code', cells: [<a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">MIT</a>, 'Reuse, modify, and redistribute the code, including commercially, keeping the copyright notice.'] },
          { label: 'Written content', cells: [<a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC 4.0</a>, 'Share and adapt chapters, explanations, and questions with attribution, for non-commercial purposes only.'] },
          { label: 'Third-party assets', cells: ['Their own licenses', <>Geist fonts (<a href="https://openfontlicense.org/" target="_blank" rel="noopener noreferrer">SIL OFL 1.1</a>), Lucide icons (<a href="https://lucide.dev/license" target="_blank" rel="noopener noreferrer">ISC</a>), React, Motion, and Vite (MIT).</>] },
        ]}
      />
      <p>
        The full terms are in <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">LICENSE</a> and{' '}
        <a href={`${REPO}/blob/main/LICENSE-CONTENT.md`} target="_blank" rel="noopener noreferrer">LICENSE-CONTENT.md</a> in the repository.
      </p>

      <H2 id="corrections">Corrections & takedown requests</H2>
      <Callout kind="info" title="Found an error or a concern?">
        <p>
          Technology changes quickly, and mistakes happen. If a fact is wrong, a source is missing, or you believe
          something infringes your rights, please{' '}
          <a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">open an issue on GitHub</a>. Rights-holder
          concerns will be addressed promptly, including removal of the material.
        </p>
      </Callout>
    </>
  )
}
