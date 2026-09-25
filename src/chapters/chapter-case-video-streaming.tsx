import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, CompareTable, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, Requirements,
} from '../components/ui'
import type { ArchEdge, ArchNode } from '../components/ui'
import { VideoAbrSim } from './demos/video-abr-sim'
import { VideoTranscodeDag } from './demos/video-transcode-dag'

const NODES: ArchNode[] = [
  { id: 'creator', label: 'Creator app', kind: 'client', x: 10, y: 22 },
  { id: 'api', label: 'Upload API', sub: 'signed URLs', kind: 'service', x: 30, y: 22,
    detail: 'Creates the video record (state = UPLOADING) and returns pre-signed, resumable multipart URLs. The API never proxies video bytes.' },
  { id: 'raw', label: 'Raw bucket', sub: 'object storage', kind: 'storage', x: 30, y: 58,
    detail: 'Original uploads, kept for re-encoding when codecs improve or new renditions are needed. Often moved to a cheaper storage class after processing.' },
  { id: 'q', label: 'Job queue', sub: 'on upload', kind: 'queue', x: 51, y: 58,
    detail: 'Object-created notifications trigger the transcoding DAG. Durable, so a failed task is retried without re-uploading.' },
  { id: 'tx', label: 'Transcode DAG', sub: 'worker fleet', kind: 'worker', x: 70, y: 58,
    detail: 'Split → encode each rendition per segment in parallel → package HLS/DASH manifests → thumbnails, captions and content-safety checks. Autoscaled, and a good fit for spot or preemptible capacity.' },
  { id: 'enc', label: 'Encoded bucket', sub: 'segments', kind: 'storage', x: 90, y: 58 },
  { id: 'meta', label: 'Metadata DB', sub: 'videos, channels', kind: 'db', x: 51, y: 22,
    detail: 'Title, owner, state machine (UPLOADING → PROCESSING → READY / FAILED), rendition list, and view counters (aggregated asynchronously).' },
  { id: 'cdn', label: 'CDN edge', sub: 'popular segments', kind: 'cdn', x: 90, y: 22,
    detail: 'Serves most watch bytes. The long tail is cold, so a tiered cache (edge → regional shield → origin) keeps the hit ratio high without pushing everything to every edge.' },
  { id: 'viewer', label: 'Viewer player', sub: 'ABR logic', kind: 'client', x: 70, y: 88,
    detail: 'Fetches the manifest, then picks a rendition per segment based on measured throughput and buffer level.' },
]

const EDGES: ArchEdge[] = [
  { from: 'creator', to: 'api' }, { from: 'api', to: 'meta' }, { from: 'creator', to: 'raw', label: 'PUT parts' },
  { from: 'raw', to: 'q', async: true }, { from: 'q', to: 'tx' }, { from: 'tx', to: 'enc' }, { from: 'tx', to: 'meta' },
  { from: 'enc', to: 'cdn' }, { from: 'viewer', to: 'cdn' }, { from: 'viewer', to: 'meta' },
]

export default function VideoStreamingChapter() {
  return (
    <>
      <p>
        Video platforms are really <strong>two systems</strong>. The upload side is a batch pipeline that turns one
        large file into hundreds of small ones. The watch side is a content-delivery problem whose main cost is
        bandwidth. Strong answers keep the two separate, and put the numbers where the money is: <strong>egress</strong>.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <Requirements
        functional={['Upload videos (up to a few GB)', 'Watch on web, mobile, TV with smooth playback', 'Multiple resolutions; adapt to the network', 'Basic metadata: title, thumbnail, view count']}
        nonFunctional={['50M DAU (illustrative)', 'Fast start: < 2 s to first frame', 'Minimal rebuffering', 'Publish within minutes of upload', 'Cost-efficient at petabyte scale']}
        outOfScope={['Live streaming', 'Recommendations', 'Comments / social', 'Monetization & ads']}
      />

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <EstimationTable
        assumptions={['50M DAU, 5 videos watched each, ~10 min per view', 'Average delivered bitrate ~3 Mbps', '500K uploads/day, ~300 MB raw each', 'All numbers illustrative']}
        rows={[
          { label: 'Views / day', math: '50M × 5', result: '250M' },
          { label: 'Egress / day', math: '250M × 600 s × 3 Mbps ÷ 8', result: '≈ 56 PB' },
          { label: 'Avg egress rate', math: '56 PB ÷ 86,400 s', result: '≈ 5 Tbps' },
          { label: 'Raw ingest / day', math: '500K × 300 MB', result: '≈ 150 TB' },
          { label: 'Encoded (5 renditions)', math: '≈ 1–1.5× raw size', result: '≈ 150–225 TB/day' },
          { label: 'Upload rate', math: '500K ÷ 86,400', result: '≈ 6 uploads/s' },
        ]}
      />
      <Callout kind="staff">
        Egress dwarfs everything else. At an illustrative $0.01/GB that is on the order of <strong>$500K per day</strong>,
        which is why large platforms negotiate CDN contracts, peer with ISPs, and place their own cache appliances
        inside ISP networks. Your design choices (bitrate ladder, codec, cache tiering) are cost decisions first.
      </Callout>

      <H2 id="api">3 · API</H2>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/videos', desc: 'Create a video record and start a resumable multipart upload.', body: '{ title, sizeBytes, contentType }', returns: '{ videoId, uploadId, partUrls[] }' },
        { method: 'POST', path: '/v1/videos/{id}/complete', desc: 'Client confirms all parts. Server verifies checksums and enqueues processing.', body: '{ uploadId, parts: [{ n, etag }] }', returns: '202 { state: "PROCESSING" }' },
        { method: 'GET', path: '/v1/videos/{id}', desc: 'Metadata plus playback info once READY.', returns: '{ title, state, manifestUrl, thumbnails }' },
        { method: 'GET', path: 'cdn/…/{id}/master.m3u8', desc: 'HLS master manifest listing renditions; the player then fetches media playlists and segments.' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={400}
        caption="Upload pipeline on top, delivery path to the viewer on the right"
        flows={[
          { name: 'Upload', path: ['creator', 'api', 'meta'], steps: ['Creator requests an upload session', 'API records the video (UPLOADING) and returns signed part URLs'] },
          { name: 'Process', path: ['creator', 'raw', 'q', 'tx', 'enc'], steps: ['Parts go straight to object storage', 'Upload-complete event is queued', 'Workers run the transcoding DAG', 'Segments and manifests are written; metadata is set to READY'] },
          { name: 'Watch', path: ['viewer', 'cdn', 'enc'], steps: ['Player requests the manifest and segments from the nearest edge', 'On a miss, the edge (via a regional shield) pulls from origin storage'] },
        ]} />

      <H2 id="upload">5 · Deep dive: uploads that survive bad networks</H2>
      <ul>
        <li><strong>Direct-to-storage</strong> with pre-signed URLs. App servers never stream bytes, so they stay small and stateless.</li>
        <li><strong>Multipart and resumable</strong>: split into 5–100 MB parts, upload them in parallel, retry only failed parts, and resume after an app restart using the upload ID.</li>
        <li><strong>Integrity</strong>: per-part checksums, and a final verification before processing starts.</li>
        <li><strong>State machine</strong> in the metadata DB so the UI can show progress and a stuck job is detectable.</li>
      </ul>

      <H2 id="transcoding">6 · Deep dive: the transcoding DAG</H2>
      <p>
        One upload must become several resolutions × codecs, split into short segments (typically 2–6 s) with
        manifests. Modeling this as a <strong>DAG of small tasks</strong> gives parallelism, retries per task, and
        easy extension (captions, content moderation, per-title optimization).
      </p>
      <VideoTranscodeDag />
      <CompareTable
        columns={['H.264 / AVC', 'VP9', 'AV1']}
        rows={[
          { label: 'Device support', cells: ['Universal', 'Broad (web, Android)', 'Growing; hardware decode on newer devices'] },
          { label: 'Compression', cells: ['Baseline', 'Better (≈30–40% smaller)', 'Best (≈30% smaller than VP9)'] },
          { label: 'Encode cost', cells: ['Cheap', 'Higher', 'Much higher'] },
          { label: 'Use it for', cells: ['Everything (fallback)', 'Popular content', 'Most-watched content, where bandwidth savings pay back encode cost'] },
        ]}
        caption="Compression ratios are rough industry ranges; they vary with content and encoder settings."
      />
      <Callout kind="tip">
        Encode <strong>based on popularity</strong>. Every upload gets a cheap H.264 ladder immediately. Only videos
        that cross a view threshold get the expensive AV1 encode, because that is where egress savings exceed compute cost.
      </Callout>

      <H2 id="delivery">7 · Deep dive: adaptive bitrate & delivery</H2>
      <VideoAbrSim />
      <ul>
        <li><strong>HLS / DASH</strong> both serve segments over plain HTTP, so any CDN can cache them. A manifest lists renditions, and the player picks one per segment.</li>
        <li><strong>Tiered caching</strong>: edge → regional shield → origin. The shield collapses misses from many edges into one origin fetch.</li>
        <li><strong>Pre-positioning</strong>: push predicted-popular content (new episodes, trending videos) to edges during off-peak hours.</li>
        <li><strong>Startup time</strong>: start at a low rendition, keep the first segments short, and preload the first segment of likely-next videos.</li>
      </ul>

      <H2 id="data-model">8 · Data model</H2>
      <CodeBlock lang="ts" title="video metadata" code={`
type Video = {
  videoId: string                    // partition key
  ownerId: string
  title: string
  state: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'BLOCKED'
  durationSec?: number
  renditions: { codec: 'h264' | 'vp9' | 'av1'; height: number; bitrateKbps: number }[]
  manifestPath?: string              // e.g. /v/{videoId}/master.m3u8
  createdAt: number
}

// View counts: never UPDATE videos SET views = views + 1 per play.
// Emit play events → stream aggregation → periodic batch writes.`} />

      <H2 id="staff">9 · Going beyond: staff-level extensions</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Cost model first</strong>: storage (originals + renditions), compute (encodes, including re-encodes when codecs change), and egress (dominant). Show which lever moves which line.</li>
          <li><strong>Per-title encoding</strong>: a cartoon needs far fewer bits than a sports match at the same quality. Tune the bitrate ladder per video using a quality metric such as VMAF.</li>
          <li><strong>Safety & rights</strong>: content moderation and copyright matching (fingerprinting) are DAG stages that can block publishing, so design the state machine for them.</li>
          <li><strong>Multi-CDN</strong>: route by real-user measurements, and fail over when one CDN degrades in a region.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Uploads of 4K videos take hours to become watchable. How do you cut time-to-publish?"
        senior={<p>Add more transcoding workers and use faster instance types. Maybe use GPUs for encoding.</p>}
        staff={<>
          <p>More machines don't help if the job is one long serial task. I'd <strong>split on keyframe (GOP) boundaries</strong> and encode segments in parallel across the fleet, so time-to-publish tracks the longest segment rather than the whole file.</p>
          <p>Then <strong>publish progressively</strong>: mark the video READY as soon as a low rendition (e.g. 480p H.264) is packaged, and add higher renditions and better codecs to the manifest as they finish. Also start processing parts while the upload is still in progress. The trade-off is scheduler complexity and a few more manifest updates.</p>
        </>}
        followUps={['How do you avoid visible seams between segments encoded separately?', 'How do you prioritize a creator with 10M subscribers?']}
      />
      <InterviewQuestion
        q="Your CDN bill doubled but traffic grew 20%. Where do you look?"
        senior={<p>Check the cache hit ratio. Maybe a configuration change reduced caching, so more requests go to origin.</p>}
        staff={<>
          <p>I'd break the bill into <strong>bytes delivered × price per byte</strong>. For bytes, look at average bitrate per view, which rises if the ABR ladder changed or new devices default to 4K, and at cache fill traffic (hit ratio, shield effectiveness, cache-key fragmentation from query strings). For price, look at regional mix: growth in expensive regions can dominate.</p>
          <p>Levers: cap bitrate for small screens, AV1 for top content, fix cache keys, add a shield tier, and renegotiate or shift traffic across CDNs.</p>
        </>}
      />

      <KeyTakeaways items={[
        'Two systems: a batch upload/transcode pipeline and a CDN-dominated delivery path.',
        'Uploads go straight to object storage via resumable multipart signed URLs.',
        'Transcoding is a DAG. Segment-level parallelism shortens time-to-publish; total compute is unchanged.',
        'ABR (HLS/DASH) lets the player trade quality for smoothness per segment.',
        'Staff depth: egress is the cost center, popularity-based codecs, per-title encoding, multi-CDN.',
      ]} />
    </>
  )
}
