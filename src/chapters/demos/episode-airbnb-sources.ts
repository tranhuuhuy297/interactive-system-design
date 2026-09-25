import type { Reference } from '../../components/ui'

// Primary sources behind the Airbnb episode; every URL was checked to resolve.
export const AIRBNB_SRC = {
  qcon: { title: 'Airbnb’s Great Migration: From Monolith to Service-Oriented', source: 'Jessica Tai, QCon San Francisco', year: 2018, url: 'https://qconsf.com/sf2018/sf2018/presentation/airbnbs-great-migration-monolith-service-oriented.html', kind: 'talk', note: 'Rails “monorail” → SOA' },
  infoq: { title: 'Airbnb’s Great Migration (video and transcript)', source: 'InfoQ', year: 2019, url: 'https://www.infoq.com/presentations/airbnb-soa-migration/', kind: 'talk' },
  infoqNews: { title: 'Airbnb’s Migration from Monolith to Services', source: 'InfoQ', year: 2019, url: 'https://www.infoq.com/news/2019/02/airbnb-monolith-migration-soa/', kind: 'blog' },
  spinaltap: { title: 'Capturing Data Evolution in a Service-Oriented Architecture', source: 'Airbnb Tech Blog (J. Abi-Samra)', year: 2018, url: 'https://medium.com/airbnb-engineering/capturing-data-evolution-in-a-service-oriented-architecture-72f7c643ee6f', kind: 'blog', note: 'SpinalTap change data capture' },
  spinaltapRepo: { title: 'SpinalTap (open-source)', source: 'Airbnb on GitHub', url: 'https://github.com/airbnb/SpinalTap', kind: 'docs' },
  risk: { title: 'Architecting a Machine Learning System for Risk', source: 'Airbnb Tech Blog', year: 2014, url: 'https://medium.com/airbnb-engineering/architecting-a-machine-learning-system-for-risk-941abbba5a60', kind: 'blog' },
  experiments: { title: 'Experiments at Airbnb', source: 'Airbnb Tech Blog', year: 2014, url: 'https://medium.com/airbnb-engineering/experiments-at-airbnb-e2db3abf39e7', kind: 'blog' },
  erf: { title: 'Experiment Reporting Framework', source: 'Airbnb Tech Blog', year: 2014, url: 'https://medium.com/airbnb-engineering/experiment-reporting-framework-f3faca569e0c', kind: 'blog' },
  airflow: { title: 'Airflow: a workflow management platform', source: 'Airbnb Tech Blog (M. Beauchemin)', year: 2015, url: 'https://medium.com/airbnb-engineering/airflow-a-workflow-management-platform-46318b977fd8', kind: 'blog' },
  airflowDocs: { title: 'Apache Airflow', source: 'Apache Software Foundation', url: 'https://airflow.apache.org/', kind: 'docs' },
  nebula: { title: 'Nebula as a Storage Platform to Build Airbnb’s Search Backends', source: 'Airbnb Tech Blog', year: 2016, url: 'https://medium.com/airbnb-engineering/nebula-as-a-storage-platform-to-build-airbnbs-search-backends-ecc577b05f06', kind: 'blog' },
  pricing: { title: 'Customized Regression Model for Airbnb Dynamic Pricing', source: 'Ye et al., KDD', year: 2018, url: 'https://doi.org/10.1145/3219819.3219830', kind: 'paper' },
  pricingSummary: { title: 'Customized regression model for Airbnb dynamic pricing (summary)', source: 'The Morning Paper', year: 2018, url: 'https://blog.acolyer.org/2018/10/03/customized-regression-model-for-airbnb-dynamic-pricing/', kind: 'blog' },
  embeddings: { title: 'Real-time Personalization using Embeddings for Search Ranking at Airbnb', source: 'Grbovic & Cheng, KDD', year: 2018, url: 'https://doi.org/10.1145/3219819.3219885', kind: 'paper' },
  deepSearch: { title: 'Applying Deep Learning to Airbnb Search', source: 'Haldar et al., KDD', year: 2019, url: 'https://arxiv.org/abs/1810.09591', kind: 'paper' },
  retrieval: { title: 'Embedding-Based Retrieval for Airbnb Search', source: 'Airbnb Engineering & Data Science', url: 'https://airbnb.tech/ai-ml/embedding-based-retrieval-for-airbnb-search/', kind: 'blog' },
  orpheus: { title: 'Avoiding Double Payments in a Distributed Payments System', source: 'Airbnb Tech Blog (J. Chew)', year: 2019, url: 'https://medium.com/airbnb-engineering/avoiding-double-payments-in-a-distributed-payments-system-2981f6b070bb', kind: 'blog' },
  pgRange: { title: 'Range types', source: 'PostgreSQL documentation', url: 'https://www.postgresql.org/docs/current/rangetypes.html', kind: 'docs' },
  pgConstraints: { title: 'Constraints: exclusion constraints', source: 'PostgreSQL documentation', url: 'https://www.postgresql.org/docs/current/ddl-constraints.html', kind: 'docs' },
} satisfies Record<string, Reference>
