import type { ArchEdge, ArchNode, Reference } from '../../components/ui'

// Fixed grid (x: 10/28/46/64/82, y: 12/30/50/70/88) keeps nodes from overlapping and positions stable across stages.
const node = (id: string, label: string, kind: ArchNode['kind'], x: number, y: number, sub?: string): ArchNode =>
  ({ id, label, kind, x, y, ...(sub ? { sub } : {}) })

export const N = {
  dns: node('dns', 'DNS routing', 'lb', 10, 12, 'Route 53 + UltraDNS'),
  chaos: node('chaos', 'Chaos tooling', 'external', 28, 12),
  region: node('region', 'Other AWS regions', 'external', 46, 12, 'active-active'),
  disc: node('disc', 'Eureka', 'service', 64, 12, 'service discovery'),
  evc: node('evc', 'EVCache', 'cache', 82, 12, 'memcached tier'),
  ads: node('ads', 'Ad decisioning', 'service', 46, 30),
  live: node('live', 'Live ingest', 'worker', 64, 30, '2 regions × 2 paths'),
  cass: node('cass', 'Cassandra', 'db', 82, 30, 'member data'),
  client: node('client', 'Devices', 'client', 10, 50, 'TV · web · mobile'),
  edge: node('edge', 'Zuul edge', 'lb', 28, 50),
  api: node('api', 'Netflix API', 'service', 46, 50),
  svc: node('svc', 'Microservices', 'service', 64, 50, 'hundreds'),
  ml: node('ml', 'Personalization', 'worker', 82, 50, 'rows + artwork'),
  origin: node('origin', 'Live origin', 'storage', 46, 70),
  kafka: node('kafka', 'Keystone', 'queue', 64, 70, 'Kafka pipeline'),
  s3: node('s3', 'S3', 'storage', 82, 70, 'masters + data'),
  cdn: node('cdn', 'Commercial CDN', 'cdn', 28, 88),
  oca: node('oca', 'Open Connect', 'cdn', 28, 88, 'caches inside ISPs'),
  steer: node('steer', 'Steering + fill', 'service', 46, 88, 'OC control plane'),
  encode: node('encode', 'Encoding', 'worker', 64, 88, 'per title / per shot'),
  stream: node('stream', 'Stream processing', 'worker', 82, 88),
} satisfies Record<string, ArchNode>

/** Same node with a stage-specific label or subtitle. */
export const as = (n: ArchNode, label: string, sub?: string): ArchNode => ({ ...n, label, sub })

export const e = (from: string, to: string, extra: Partial<ArchEdge> = {}): ArchEdge => ({ from, to, ...extra })

// Every URL verified; netflixtechblog.com returns 403 to scripts but each post was confirmed by search or redirect.
const blog = (title: string, year: number, slug: string, note?: string): Reference =>
  ({ title, source: 'Netflix Technology Blog', year, url: `https://netflixtechblog.com/${slug}`, kind: 'blog', ...(note ? { note } : {}) })

export const S = {
  watchNow: { title: 'Netflix to be delivered on the Web (Associated Press)', source: 'NBC News', year: 2007, url: 'https://www.nbcnews.com/id/wbna16650421', kind: 'blog', note: '“Watch Now” launch' },
  migration: { title: 'Completing the Netflix Cloud Migration', source: 'Netflix', year: 2016, url: 'https://about.netflix.com/en/news/completing-the-netflix-cloud-migration', kind: 'blog' },
  cassandra: blog('Benchmarking Cassandra Scalability on AWS — Over a million writes per second', 2011, 'benchmarking-cassandra-scalability-on-aws-over-a-million-writes-per-second-39f45f066c9e'),
  eureka: { title: 'Eureka (service discovery)', source: 'Netflix OSS on GitHub', url: 'https://github.com/Netflix/eureka', kind: 'docs' },
  apiRedesign: blog('Redesigning the Netflix API', 2011, 'redesigning-the-netflix-api-db5a7221fcff'),
  apiDifferences: blog('Embracing the Differences: Inside the Netflix API Redesign', 2012, 'embracing-the-differences-inside-the-netflix-api-redesign-15fd8b3dc49d'),
  ocOverview: { title: 'Open Connect Overview (PDF)', source: 'Netflix', url: 'https://openconnect.netflix.com/Open-Connect-Overview.pdf', kind: 'docs' },
  ocAppliances: { title: 'Open Connect Appliances', source: 'Netflix', url: 'https://openconnect.netflix.com/en/appliances/', kind: 'docs' },
  simian: blog('The Netflix Simian Army', 2011, 'the-netflix-simian-army-16e57fbab116'),
  hystrix: blog('Introducing Hystrix for Resilience Engineering', 2012, 'introducing-hystrix-for-resilience-engineering-13531c1ab362'),
  christmas: blog('A Closer Look at the Christmas Eve Outage', 2012, 'a-closer-look-at-the-christmas-eve-outage-d7b409a529ee'),
  isthmus: blog('Isthmus — Resiliency against ELB outages', 2013, 'isthmus-resiliency-against-elb-outages-d9e0623484f3'),
  activeActive: blog('Active-Active for Multi-Regional Resiliency', 2013, 'active-active-for-multi-regional-resiliency-c47719f6685b'),
  evcache: blog('Announcing EVCache: Distributed in-memory datastore for Cloud', 2013, 'announcing-evcache-distributed-in-memory-datastore-for-cloud-c26a698c27f7'),
  zuul: { title: 'Zuul (edge gateway)', source: 'Netflix OSS on GitHub', url: 'https://github.com/Netflix/zuul', kind: 'docs' },
  chaosKong: blog('Chaos Engineering Upgraded', 2015, 'chaos-engineering-upgraded-878d341f15fa', 'Chaos Kong'),
  nimble: blog('Project Nimble: Region Evacuation Reimagined', 2018, 'project-nimble-region-evacuation-reimagined-d0d0568254d4'),
  pipeline: blog('Evolution of the Netflix Data Pipeline', 2016, 'evolution-of-the-netflix-data-pipeline-da246ca36905'),
  kafka: blog('Kafka Inside Keystone Pipeline', 2016, 'kafka-inside-keystone-pipeline-dd5aeabaf6bb'),
  iceberg: { title: 'Apache Iceberg (history)', source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Apache_Iceberg', kind: 'docs', note: 'created at Netflix; donated to Apache in 2018' },
  global: { title: 'Netflix Launches In 130 New Countries', source: 'TechCrunch', year: 2016, url: 'https://techcrunch.com/2016/01/06/netflix-finally-goes-global/', kind: 'blog' },
  perTitle: blog('Per-Title Encode Optimization', 2015, 'per-title-encode-optimization-7e99442b62a2'),
  dynOpt: blog('Dynamic optimizer — a perceptual video encoding optimization framework', 2018, 'dynamic-optimizer-a-perceptual-video-encoding-optimization-framework-e19f1e3a277f', 'shot-based encoding'),
  av1Android: blog('Netflix Now Streaming AV1 on Android', 2020, 'netflix-now-streaming-av1-on-android-d5264a515202'),
  av1Share: blog('AV1 — Now Powering 30% of Netflix Streaming', 2025, 'av1-now-powering-30-of-netflix-streaming-02f592242d80'),
  artwork: blog('Artwork Personalization at Netflix', 2017, 'artwork-personalization-c589f074ad76'),
  adsPartner: { title: 'Netflix to Partner With Microsoft on New Ad Supported Subscription Plan', source: 'Netflix', year: 2022, url: 'https://about.netflix.com/en/news/netflix-partners-with-microsoft', kind: 'blog' },
  adsLaunch: { title: 'Announcing Basic with Ads (US)', source: 'Netflix', year: 2022, url: 'https://about.netflix.com/en/news/announcing-basic-with-ads-us', kind: 'blog' },
  adsInHouse: { title: 'Q3 2024 Letter to Shareholders (SEC filing)', source: 'Netflix, Inc.', year: 2024, url: 'https://www.sec.gov/Archives/edgar/data/1065280/000106528024000286/ex991_q324.htm', kind: 'docs', note: 'in-house ad tech rollout' },
  live1: blog('Behind the Streams: Three Years Of Live at Netflix (Part 1)', 2025, 'behind-the-streams-live-at-netflix-part-1-d23f917c2f40'),
  live2: blog('Behind the Streams: Building a Reliable Cloud Live Streaming Pipeline (Part 2)', 2025, 'building-a-reliable-cloud-live-streaming-pipeline-for-netflix-8627c608c967'),
  liveOrigin: blog('Netflix Live Origin', 2025, 'netflix-live-origin-41f1b0ad5371'),
  tyson: { title: 'The Tyson-Paul fight had tech issues. Can streaming handle more major live events?', source: 'NPR (via WFAE)', year: 2024, url: 'https://www.wfae.org/business/2024-11-21/the-tyson-paul-fight-had-tech-issues-can-streaming-handle-more-major-live-events', kind: 'blog' },
} satisfies Record<string, Reference>
