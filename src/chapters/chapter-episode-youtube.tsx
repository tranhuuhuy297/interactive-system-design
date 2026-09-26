import {
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, MentalModel, References, SideBySide, StatRow, Term, TLDR, VisualTimeline,
} from '../components/ui'
import {
  Building2, Cpu, Database, Film, HardDrive, Layers, Radio, Rocket, Server, ShieldCheck, Smartphone, Sparkles,
} from 'lucide-react'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import { EpisodeYoutubeFunnelDemo } from './demos/episode-youtube-funnel-demo'
import { S } from './demos/episode-youtube-sources'
import { YOUTUBE_STAGES } from './demos/episode-youtube-stages'

const FLOW_NODES: ArchNode[] = [
  { id: 'client', label: 'Viewers', sub: 'web + apps', kind: 'client', x: 10, y: 50 },
  { id: 'web', label: 'Watch API', kind: 'service', x: 30, y: 22,
    detail: 'Builds the watch page: video metadata, the player configuration, and the recommendation list.' },
  { id: 'rec', label: 'Recommender', sub: 'retrieve → rank', kind: 'worker', x: 54, y: 10,
    detail: 'Retrieves hundreds of candidates from millions of videos, then ranks them with a heavier model.' },
  { id: 'meta', label: 'Metadata', sub: 'Vitess + MySQL', kind: 'db', x: 54, y: 36,
    detail: 'Titles, channels, and settings in sharded MySQL. Vitess routes each query to the right shard.' },
  { id: 'cid', label: 'Content ID', kind: 'worker', x: 54, y: 56,
    detail: 'Fingerprints each upload and compares it with reference files from rights holders.' },
  { id: 'store', label: 'Video storage', sub: 'all renditions', kind: 'storage', x: 54, y: 78 },
  { id: 'ggc', label: 'Cache in ISP', sub: 'Google Global Cache', kind: 'cdn', x: 30, y: 78,
    detail: 'Google-provided servers inside internet providers. Popular video is served from here.' },
  { id: 'creators', label: 'Creators', kind: 'client', x: 78, y: 10 },
  { id: 'upload', label: 'Upload API', sub: 'resumable', kind: 'service', x: 78, y: 36 },
  { id: 'encode', label: 'Transcoding', sub: 'Argos VCUs', kind: 'worker', x: 78, y: 64,
    detail: 'Splits the upload and encodes every resolution and codec in parallel on video chips.' },
]
const FLOW_EDGES: ArchEdge[] = [
  { from: 'client', to: 'web' }, { from: 'web', to: 'rec' }, { from: 'web', to: 'meta' }, { from: 'client', to: 'ggc' },
  { from: 'store', to: 'ggc', label: 'fill', async: true }, { from: 'creators', to: 'upload' }, { from: 'upload', to: 'meta' },
  { from: 'upload', to: 'encode' }, { from: 'encode', to: 'store' }, { from: 'encode', to: 'cid', async: true },
]

const REFS: Reference[] = [
  S.acquisition, S.cordes, S.hsArch, S.hs7years, S.contentIdWiki, S.contentIdHelp, S.vitessHistory, S.vitessCncf,
  S.live, S.vp9, S.av1Test, S.recsys, S.ggc, S.edge, S.argos, S.asplos, S.shortsUs, S.shortsGlobal,
]

export default function YoutubeEpisode() {
  return (
    <>
      <TLDR items={[
        'YouTube’s core problem is a huge, user-uploaded catalog where most videos are rarely watched.',
        'It split video bytes from web pages early, and later moved popular video into caches inside ISPs.',
        'Sharded MySQL outgrew app-level routing, so YouTube built Vitess, now an open-source CNCF project.',
        'Every upload is encoded into many renditions; better codecs and custom chips keep that affordable.',
        'Recommendations run in two passes: retrieve hundreds from millions, then rank them carefully.',
      ]} />
      <MentalModel id="ep-youtube" />

      <p>
        YouTube lets anyone upload, so its catalog grows every minute and most of it is the{' '}
        <Term def="The many items that each get few views. Together they are a large share of the catalog, but no cache holds them all.">long tail</Term>.
        That shapes almost every decision: how video is stored, where it is served from, and how viewers find anything.
      </p>
      <p>
        This episode follows YouTube from a Python web app in 2005 to custom video chips and Shorts. Each stage starts with a
        real problem and ends with the decision it forced.
      </p>
      <Callout kind="info" title="How to watch this episode">
        Step through the stages below. Before clicking Next, guess what breaks. Open <strong>Go deeper</strong> for the
        walk-through, numbers, alternatives, and sources.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by YouTube or Google; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <VisualTimeline items={[
        { when: '2005', title: 'Python app, MySQL, video servers', note: 'Ship fast with a small team', icon: Rocket },
        { when: '2005–2006', title: 'Video split from pages; hits on a CDN', note: 'Traffic tripled in months', icon: Server },
        { when: '2006', title: 'Google agrees to buy YouTube', note: '100M+ views a day', icon: Building2 },
        { when: '2006–2008', title: 'Thumbnails on BigTable, MySQL sharded by user', note: 'Small files and write load', icon: Database },
        { when: '2007', title: 'Content ID', note: 'Match uploads against rights holders’ references', icon: ShieldCheck },
        { when: '2010–2012', title: 'Vitess built and open-sourced', note: 'A proxy that routes queries to shards', icon: Layers },
        { when: '2011', title: 'YouTube Live', note: 'Seconds of delay, not minutes', icon: Radio },
        { when: '2013–2018', title: 'VP9, then AV1 tests', note: 'Fewer bits per view', icon: Film },
        { when: '2016', title: 'Two-stage deep recommendations', note: 'Millions → hundreds → dozens', icon: Sparkles },
        { when: '2020–2021', title: 'Shorts', note: 'A swipe feed of vertical clips', icon: Smartphone },
        { when: '2021', title: 'Argos video chips described', note: 'Transcoding on custom hardware', icon: Cpu },
      ]} />

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={YOUTUBE_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <p>Uploads are the number to start from. Every uploaded hour becomes many encoded hours, stored and served.</p>
      <StatRow caption="The middle figure is derived; the storage rows below are estimates, not YouTube figures" stats={[
        { value: '500+ h', label: 'uploaded every minute', note: 'YouTube, 2021' },
        { value: '≈ 720K h', label: 'uploaded per day', note: 'derived: 500 × 60 × 24' },
        { value: '70–90%', label: 'cacheable traffic served inside ISPs', note: 'Google, typical' },
      ]} />
      <EstimationTable
        assumptions={['500 hours uploaded per minute (YouTube, 2021)', '~10 renditions per video across resolutions and codecs (estimate)', '~1 GB per rendition-hour on average (estimate)']}
        rows={[
          { label: 'Upload hours per day', math: '500 × 60 × 24', result: '≈ 720K h' },
          { label: 'Rendition-hours per day', math: '720K × 10', result: '≈ 7.2M h' },
          { label: 'New storage per day', math: '7.2M × 1 GB', result: '≈ 7 PB (estimate)' },
        ]}
      />
      <p>
        Storage and encoding grow with uploads, not views. That is why encoding efficiency and deciding which videos get
        expensive codecs matter as much as serving.
      </p>

      <H2 id="upload-to-play">From upload to play</H2>
      <p>
        Two paths meet in storage. Creators push video in; viewers pull pages from the API and video bytes from caches.
        Uploads go through <Term def="Re-encoding a video into other resolutions and codecs so every device and connection can play it.">transcoding</Term> before anyone can watch.
      </p>
      <ArchitectureDiagram nodes={FLOW_NODES} edges={FLOW_EDGES} height={400}
        caption="Writes flow down the right side; reads come from the API and ISP caches on the left"
        flows={[
          { name: 'Upload', path: ['creators', 'upload', 'encode', 'store'], steps: ['A creator uploads, resuming if the connection drops', 'The upload is queued for transcoding', 'Every rendition is written to storage'] },
          { name: 'Watch page', path: ['client', 'web', 'meta'], steps: ['A viewer opens a video', 'The API reads metadata through Vitess'] },
          { name: 'Recommend', path: ['client', 'web', 'rec'], steps: ['The page needs “up next”', 'The recommender retrieves and ranks candidates'] },
          { name: 'Stream', path: ['client', 'ggc'], steps: ['The player streams segments from a cache inside the viewer’s ISP'] },
        ]} />

      <H2 id="recommendations">Deep dive: two-stage recommendations</H2>
      <p>
        Scoring millions of videos with a rich model on every page load is impossible. So a cheap retrieval step picks a few
        hundred <Term def="Videos returned by the first, cheap stage. Only these are scored by the expensive ranking model.">candidates</Term>,
        and an expensive ranking model scores only those.
      </p>
      <p>
        The trade-off is recall. A video that retrieval misses can never be ranked. Try growing the candidate pool below and
        watch ranking eat the latency budget.
      </p>
      <EpisodeYoutubeFunnelDemo />

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <p>The three decisions that shaped YouTube’s architecture most:</p>
      <SideBySide panels={[
        { title: 'Vitess in front of MySQL', icon: Layers, tone: 'good', points: ['+ Keeps relational data and SQL', '+ Resharding becomes an operation', '- Instead of: a NoSQL rewrite'], verdict: 'Metadata' },
        { title: 'Retrieve, then rank', icon: Sparkles, tone: 'good', points: ['+ Fits a rich model in the latency budget', '- Missed candidates are never shown', '- Instead of: one model over everything'], verdict: 'Recommendations' },
        { title: 'Custom video chips', icon: Cpu, tone: 'good', points: ['+ Far more transcoding per dollar', '- Years of hardware work', '- Instead of: ever more CPUs'], verdict: 'Transcoding' },
      ]} />
      <p>Other decisions, in brief:</p>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Thumbnails', cells: ['BigTable', 'One file per image', 'Millions of tiny files overwhelm disks and file systems'] },
          { label: 'Long-tail video', cells: ['Own servers, hits on caches', 'Everything on a CDN', 'Rarely watched videos miss every cache anyway'] },
          { label: 'Copyright', cells: ['Fingerprint matching (Content ID)', 'Takedown requests only', 'Scales to every upload; owners choose a policy'] },
          { label: 'Delivery', cells: ['Caches inside ISPs', 'Serve everything over transit', 'Less congestion and lower latency for viewers'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <p>Compare YouTube with Netflix: both stream video, but their catalogs push the design in different directions.</p>
      <SideBySide panels={[
        { title: 'Netflix', icon: HardDrive, points: ['Curated, known catalog', 'Demand is predictable', 'Caches can be pre-filled overnight'], verdict: 'Push content ahead of demand' },
        { title: 'YouTube', icon: Film, points: ['Anyone uploads, every minute', 'Most videos are rarely watched', 'Caches hold what is popular locally'], verdict: 'Cache the hits, spend on encoding wisely' },
      ]} />
      <Callout kind="staff">
        <ul>
          <li><strong>Size the write path by uploads, the read path by views.</strong> They grow at different rates and need different hardware.</li>
          <li><strong>Spend compute where views are.</strong> Expensive codecs repay themselves on popular videos first.</li>
          <li><strong>Move routing out of application code.</strong> Vitess turned resharding from a code change into an operation.</li>
          <li><strong>Two stages beat one big model.</strong> Name the recall risk and how you measure it.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="Design the pipeline from upload to first play. Where does the time go?"
        senior={<p>Resumable upload to storage, a queue, parallel transcoding into several resolutions, then publish metadata and serve through a CDN.</p>}
        staff={<>
          <p>Most of the time is transcoding, so split the file into chunks and encode them in parallel. Publish a first playable rendition quickly, and add expensive codecs later or only for videos that get views.</p>
          <p>Run checks such as Content ID asynchronously, but before the video goes public. Metadata writes go to the owner’s shard; the video only becomes visible once its renditions exist.</p>
        </>}
        followUps={['How do you handle a 10-hour upload over a flaky mobile network?', 'Which renditions do you produce first?', 'How would you rebuild storage if a region is lost?']}
      />
      <InterviewQuestion
        q="The catalog grows 10×. How do you keep recommendations under 100 ms?"
        senior={<p>Precompute embeddings, use approximate nearest-neighbor search for candidates, and cache results.</p>}
        staff={<>
          <p>Retrieval cost grows slowly with corpus size if it uses an approximate nearest-neighbor index, so keep the candidate count fixed and let the ranker’s budget stay the same.</p>
          <p>Watch recall: measure how often videos the ranker would love are missing from candidates, and add retrieval sources (subscriptions, trending, similar videos) rather than one bigger pool.</p>
        </>}
      />

      <H2 id="references">Sources</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'A user-uploaded long tail shapes everything: cache the hits, serve the rest efficiently.',
        'Separate bytes from pages early; video grows far faster than the web tier.',
        'Shard by owner, then move routing into a proxy like Vitess so resharding is an operation.',
        'Uploads drive encoding and storage cost; codecs and custom chips keep it affordable.',
        'Recommend in two passes: cheap retrieval for recall, expensive ranking for precision.',
      ]} />
    </>
  )
}
