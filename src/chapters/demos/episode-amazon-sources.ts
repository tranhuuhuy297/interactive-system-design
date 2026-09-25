import type { Reference } from '../../components/ui'

// Verified public sources, shared by stage deep dives and the chapter's Sources list.
export const AMAZON_SRC = {
  launch1995: { title: 'World’s Largest Bookseller Opens on the Web', source: 'Amazon press release', year: 1995, url: 'https://press.aboutamazon.com/1995/10/worlds-largest-bookseller-opens-on-the-web', kind: 'blog', note: 'more than one million titles' },
  caching: { title: 'Caching challenges and strategies', source: 'Amazon Builders’ Library', url: 'https://aws.amazon.com/builders-library/caching-challenges-and-strategies/', kind: 'blog' },
  recs: { title: 'Amazon.com Recommendations: Item-to-Item Collaborative Filtering', source: 'Linden, Smith & York, IEEE Internet Computing', year: 2003, url: 'https://doi.org/10.1109/MIC.2003.1167344', kind: 'paper' },
  vogels: { title: 'A Conversation with Werner Vogels', source: 'ACM Queue (interview by Jim Gray)', year: 2006, url: 'https://queue.acm.org/detail.cfm?id=1142065', kind: 'talk', note: '“You build it, you run it”' },
  dynamo: { title: 'Dynamo: Amazon’s Highly Available Key-value Store', source: 'DeCandia et al., SOSP', year: 2007, url: 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf', kind: 'paper', note: 'shopping cart motivation' },
  conditional: { title: 'DynamoDB condition expression examples (conditional updates)', source: 'Amazon DynamoDB Developer Guide', url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html', kind: 'docs' },
  saga: { title: 'Saga orchestration pattern', source: 'AWS Prescriptive Guidance', url: 'https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html', kind: 'docs' },
  cells: { title: 'Reducing the Scope of Impact with Cell-Based Architecture', source: 'AWS Well-Architected whitepaper', url: 'https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.html', kind: 'docs' },
  shuffle: { title: 'Workload isolation using shuffle-sharding', source: 'Colm MacCárthaigh, Amazon Builders’ Library', url: 'https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/', kind: 'blog' },
  shedding: { title: 'Using load shedding to avoid overload', source: 'Amazon Builders’ Library', url: 'https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/', kind: 'blog' },
  primeHistory: { title: 'The history of Prime Day', source: 'About Amazon', url: 'https://www.aboutamazon.com/news/retail/the-history-of-prime-day', kind: 'blog' },
  prime2015: { title: 'Amazon’s First-Ever Prime Day Breaks Global Records', source: 'Amazon press release', year: 2015, url: 'https://press.aboutamazon.com/2015/7/amazons-first-ever-prime-day-breaks-global-records-sales-exceed-black-friday', kind: 'blog' },
  prime2023: { title: 'Prime Day 2023 Powered by AWS – All the Numbers', source: 'AWS News Blog', year: 2023, url: 'https://aws.amazon.com/blogs/aws/prime-day-2023-powered-by-aws-all-the-numbers/', kind: 'blog' },
  scot: { title: 'Solving some of the largest, most complex operations problems', source: 'Amazon Science', year: 2022, url: 'https://www.amazon.science/latest-news/solving-some-of-the-largest-most-complex-operations-problems', kind: 'blog', note: 'SCOT computes delivery promises' },
} satisfies Record<string, Reference>
