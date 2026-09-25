import type { Reference } from '../../components/ui'

// Instagram's old engineering blog domain no longer resolves; those posts are cited by title, with live summaries where available.
export const IG_SRC = {
  launch: { title: 'Instagram', source: 'Encyclopaedia Britannica', url: 'https://www.britannica.com/money/Instagram', kind: 'docs', note: 'launch Oct 2010; 25,000 users on day one' },
  whatPowers: { title: 'What Powers Instagram: Hundreds of Instances, Dozens of Technologies', source: 'Instagram Engineering', year: 2011, kind: 'blog', note: 'original blog domain offline' },
  whatPowersSummary: { title: 'Instagram Architecture: 14 Million Users, Terabytes of Photos', source: 'High Scalability', year: 2011, url: 'https://highscalability.com/instagram-architecture-14-million-users-terabytes-of-photos/', kind: 'blog', note: 'summary of the 2011 stack post' },
  sharding: { title: 'Sharding & IDs at Instagram', source: 'Instagram Engineering', year: 2011, url: 'https://instagram-engineering.tumblr.com/post/10853187575/sharding-ids-at-instagram', kind: 'blog', note: '41/13/10-bit IDs generated in Postgres' },
  acquisition: { title: 'Facebook to Acquire Instagram', source: 'Facebook Newsroom', year: 2012, url: 'https://about.fb.com/news/2012/04/facebook-to-acquire-instagram/', kind: 'blog' },
  rocksandra: { title: 'Instagram Supercharges Cassandra with a Pluggable RocksDB Storage Engine', source: 'The New Stack', year: 2018, url: 'https://thenewstack.io/instagram-supercharges-cassandra-pluggable-rocksdb-storage-engine/', kind: 'blog', note: 'Cassandra since 2012; Rocksandra' },
  migration: { title: 'Instagram Migrates from Amazon’s Cloud into Facebook Data Centers', source: 'Data Center Knowledge', year: 2014, url: 'https://www.datacenterknowledge.com/cloud/instagram-migrates-from-amazon-s-cloud-into-facebook-data-centers', kind: 'blog', note: 'secondary source' },
  multiDc: { title: 'Instagration Pt. 2: Scaling our infrastructure to multiple data centers', source: 'Instagram Engineering', year: 2016, kind: 'blog', note: 'original blog domain offline' },
  scalingTalk: { title: 'Scaling Instagram Infrastructure', source: 'Lisa Guo, QCon (InfoQ)', url: 'https://www.infoq.com/presentations/instagram-scale-infrastructure', kind: 'talk' },
  feed: { title: 'See Posts You Care About First in Your Feed', source: 'Instagram', year: 2016, url: 'https://about.instagram.com/blog/announcements/see-posts-you-care-about-first-in-your-feed', kind: 'blog' },
  stories: { title: 'Introducing Instagram Stories', source: 'Instagram', year: 2016, url: 'https://about.instagram.com/blog/announcements/introducing-instagram-stories', kind: 'blog' },
  gc: { title: 'Dismissing Python Garbage Collection at Instagram', source: 'Instagram Engineering', year: 2017, kind: 'blog', note: 'original blog domain offline' },
  python3: { title: 'Instagram Makes a Smooth Move to Python 3', source: 'The New Stack', year: 2017, url: 'https://thenewstack.io/instagram-makes-smooth-move-python-3/', kind: 'blog' },
  europe: { title: 'How Instagram is scaling its infrastructure across the ocean', source: 'Sherry Xiao, Opensource.com', year: 2018, url: 'https://opensource.com/article/18/10/instagram-scaled-infrastructure', kind: 'blog' },
  reels: { title: 'Introducing Instagram Reels', source: 'Instagram', year: 2020, url: 'https://about.instagram.com/blog/announcements/introducing-instagram-reels-announcement', kind: 'blog' },
  encoding: { title: 'How Facebook encodes your videos', source: 'Engineering at Meta', year: 2021, url: 'https://engineering.fb.com/2021/04/05/video-engineering/how-facebook-encodes-your-videos/', kind: 'blog', note: 'Facebook video; related Meta practice' },
} satisfies Record<string, Reference>

export const IG_REFS: Reference[] = Object.values(IG_SRC)
