import type { Reference } from '../../components/ui'

// Every URL checked with curl (200) or, where bot-blocked, confirmed by search/fetch.
export const S = {
  acquisition: { title: 'Google To Acquire YouTube for $1.65 Billion in Stock', source: 'Google press release', year: 2006, url: 'http://www.google.com/press/pressrel/google_youtube.html', kind: 'blog', note: '100M+ daily views, 65K daily uploads at the time' },
  acquisitionNpr: { title: 'Google to Buy YouTube in $1.65 Billion Deal', source: 'NPR', year: 2006, url: 'https://www.npr.org/2006/10/09/6227759/google-to-buy-youtube-in-1-65-billion-deal', kind: 'blog' },
  cordes: { title: 'YouTube Scalability Talk (notes on Cuong Do’s Google Tech Talk)', source: 'Kyle Cordes', year: 2007, url: 'https://kylecordes.com/2007/youtube-scalability', kind: 'talk', note: 'Apache for pages, lighttpd for video, 30M → 100M pages/day' },
  hsArch: { title: 'YouTube Architecture', source: 'High Scalability', year: 2008, url: 'https://highscalability.com/youtube-architecture/', kind: 'blog', note: 'long-tail serving, thumbnails on BigTable, sharding by user' },
  hs7years: { title: '7 Years of YouTube Scalability Lessons in 30 Minutes', source: 'High Scalability (Mike Solomon, PyCon 2012)', year: 2012, url: 'https://highscalability.com/7-years-of-youtube-scalability-lessons-in-30-minutes/', kind: 'talk', note: 'in-house lighttpd CDN, jitter, Vitess' },
  contentIdHelp: { title: 'Using Content ID', source: 'YouTube Help', url: 'https://support.google.com/youtube/answer/3244015?hl=en', kind: 'docs' },
  contentIdWiki: { title: 'Content ID', source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Content_ID', kind: 'docs', note: 'launched 2007' },
  vitessHistory: { title: 'Vitess history', source: 'Vitess documentation', url: 'https://vitess.io/docs/overview/history/', kind: 'docs', note: 'created at YouTube in 2010' },
  vitessRepo: { title: 'vitessio/vitess', source: 'GitHub', url: 'https://github.com/vitessio/vitess', kind: 'docs' },
  vitessCncf: { title: 'Cloud Native Computing Foundation Announces Vitess Graduation', source: 'CNCF', year: 2019, url: 'https://www.cncf.io/announcements/2019/11/05/cloud-native-computing-foundation-announces-vitess-graduation/', kind: 'blog' },
  live: { title: 'Google Launches YouTube Live', source: 'MediaPost', year: 2011, url: 'https://www.mediapost.com/publications/article/148297/google-launches-youtube-live.html', kind: 'blog' },
  vp9: { title: 'VP9', source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/VP9', kind: 'docs', note: 'profile 0 finalized June 2013' },
  av1Test: { title: 'YouTube starts testing AV1 video format', source: 'FlatpanelsHD', year: 2018, url: 'https://www.flatpanelshd.com/news.php?subaction=showfull&id=1536822275', kind: 'blog' },
  recsys: { title: 'Deep Neural Networks for YouTube Recommendations', source: 'Covington, Adams & Sargin, RecSys', year: 2016, url: 'https://research.google/pubs/deep-neural-networks-for-youtube-recommendations/', kind: 'paper' },
  recsysNotes: { title: 'Deep neural networks for YouTube recommendations (paper summary)', source: 'The Morning Paper', year: 2016, url: 'https://blog.acolyer.org/2016/09/19/deep-neural-networks-for-youtube-recommendations/', kind: 'blog' },
  ggc: { title: 'Introduction to GGC', source: 'Google Interconnect Help', url: 'https://support.google.com/interconnect/answer/9058809?hl=en', kind: 'docs', note: '70–90% of cacheable traffic from inside the ISP' },
  edge: { title: 'Understanding Google Cloud network edge points', source: 'Google Cloud Blog', year: 2021, url: 'https://cloud.google.com/blog/products/networking/understanding-google-cloud-network-edge-points', kind: 'blog', note: 'GGC caches YouTube content in 1,300+ cities' },
  argos: { title: 'Reimagining video infrastructure to empower YouTube', source: 'YouTube Blog', year: 2021, url: 'https://blog.youtube/inside-youtube/new-era-video-infrastructure/', kind: 'blog', note: 'Argos VCU' },
  asplos: { title: 'Warehouse-scale video acceleration: co-design and deployment in the wild', source: 'Ranganathan et al., ASPLOS', year: 2021, url: 'https://doi.org/10.1145/3445814.3446723', kind: 'paper' },
  shortsUs: { title: 'Bringing YouTube Shorts to the U.S.', source: 'YouTube Blog', year: 2021, url: 'https://blog.youtube/news-and-events/youtube-shorts-united-states/', kind: 'blog' },
  shortsGlobal: { title: 'YouTube Shorts rolls out globally', source: 'Variety', year: 2021, url: 'https://variety.com/2021/digital/news/youtube-shorts-global-launch-1235018403/', kind: 'blog' },
} satisfies Record<string, Reference>
