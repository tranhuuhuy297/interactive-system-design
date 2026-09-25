import type { Reference } from '../../components/ui'

// Primary sources behind the Uber episode; every URL was checked to resolve.
export const UBER_SRC = {
  postgres: { title: 'Why Uber Engineering Switched from Postgres to MySQL', source: 'Uber Engineering', year: 2016, url: 'https://www.uber.com/us/en/blog/postgres-to-mysql-migration/', kind: 'blog', note: 'early Python + Postgres monolith' },
  soa: { title: 'Service-Oriented Architecture: Scaling the Uber Engineering Codebase As We Grow', source: 'Uber Engineering', year: 2015, url: 'https://www.uber.com/us/en/blog/service-oriented-architecture/', kind: 'blog' },
  ranney: { title: 'Scaling Uber’s Real-time Market Platform', source: 'Matt Ranney, QCon London (InfoQ)', year: 2015, url: 'https://www.infoq.com/presentations/uber-market-platform/', kind: 'talk' },
  hs: { title: 'How Uber Scales Their Real-time Market Platform', source: 'High Scalability (talk summary)', year: 2015, url: 'https://highscalability.com/how-uber-scales-their-real-time-market-platform/', kind: 'blog' },
  ringpop: { title: 'Ringpop (open-source)', source: 'Uber on GitHub', url: 'https://github.com/uber/ringpop-node', kind: 'docs' },
  schemaless1: { title: 'Designing Schemaless, Uber Engineering’s Scalable Datastore Using MySQL', source: 'Uber Engineering', year: 2016, url: 'https://www.uber.com/us/en/blog/schemaless-part-one-mysql-datastore/', kind: 'blog' },
  schemaless2: { title: 'The Architecture of Schemaless, Uber Engineering’s Trip Datastore Using MySQL', source: 'Uber Engineering', year: 2016, url: 'https://www.uber.com/us/en/blog/schemaless-part-two-architecture/', kind: 'blog' },
  h3: { title: 'H3: Uber’s Hexagonal Hierarchical Spatial Index', source: 'Uber Engineering', year: 2018, url: 'https://www.uber.com/us/en/blog/h3/', kind: 'blog' },
  h3docs: { title: 'H3 documentation', source: 'h3geo.org', url: 'https://h3geo.org/', kind: 'docs' },
  tracing: { title: 'Evolving Distributed Tracing at Uber Engineering', source: 'Uber Engineering', year: 2017, url: 'https://www.uber.com/us/en/blog/distributed-tracing/', kind: 'blog' },
  jaeger: { title: 'Jaeger: open source distributed tracing', source: 'CNCF / jaegertracing.io', url: 'https://www.jaegertracing.io/', kind: 'docs' },
  kafka: { title: 'Disaster Recovery for Multi-Region Kafka at Uber', source: 'Uber Engineering', year: 2020, url: 'https://www.uber.com/us/en/blog/kafka/', kind: 'blog' },
  michelangelo: { title: 'Meet Michelangelo: Uber’s Machine Learning Platform', source: 'Uber Engineering', year: 2017, url: 'https://www.uber.com/us/en/blog/michelangelo-machine-learning-platform/', kind: 'blog' },
  scalingMl: { title: 'Scaling Machine Learning at Uber with Michelangelo', source: 'Uber Engineering', year: 2018, url: 'https://www.uber.com/us/en/blog/scaling-michelangelo/', kind: 'blog' },
  deepeta: { title: 'DeepETA: How Uber Predicts Arrival Times Using Deep Learning', source: 'Uber Engineering', year: 2022, url: 'https://www.uber.com/us/en/blog/deepeta-how-uber-predicts-arrival-times/', kind: 'blog' },
  doma: { title: 'Introducing Domain-Oriented Microservice Architecture', source: 'Uber Engineering', year: 2020, url: 'https://www.uber.com/us/en/blog/microservice-architecture/', kind: 'blog' },
  fulfillment1: { title: 'Uber’s Fulfillment Platform: Ground-up Re-architecture to Accelerate Uber’s Go/Get Strategy', source: 'Uber Engineering', year: 2021, url: 'https://www.uber.com/us/en/blog/fulfillment-platform-rearchitecture/', kind: 'blog' },
  fulfillment2: { title: 'Building Uber’s Fulfillment Platform for Planet-Scale using Google Cloud Spanner', source: 'Uber Engineering', year: 2021, url: 'https://www.uber.com/us/en/blog/building-ubers-fulfillment-platform/', kind: 'blog' },
  fulfillmentInfoq: { title: 'Uber Re-Architected Its Foundational Fulfilment Service', source: 'InfoQ', year: 2021, url: 'https://www.infoq.com/news/2021/08/uber-rearchitecture/', kind: 'blog' },
} satisfies Record<string, Reference>
