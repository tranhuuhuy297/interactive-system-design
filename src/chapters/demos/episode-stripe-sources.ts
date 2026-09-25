import type { Reference } from '../../components/ui'

// Verified public sources, shared by stage deep dives and the chapter's Sources list.
export const STRIPE_SRC = {
  versioning: { title: 'APIs as infrastructure: future-proofing Stripe with versioning', source: 'Brandur Leach, Stripe blog', year: 2017, url: 'https://stripe.com/blog/api-versioning', kind: 'blog', note: 'compatible with every API version since 2011; per-account pinning' },
  idemDocs: { title: 'Idempotent requests', source: 'Stripe API reference', url: 'https://docs.stripe.com/api/idempotent_requests', kind: 'docs', note: 'stores status + body; keys prunable after 24 h' },
  idemBlog: { title: 'Designing robust and predictable APIs with idempotency', source: 'Brandur Leach, Stripe blog', year: 2017, url: 'https://stripe.com/blog/idempotency', kind: 'blog' },
  webhooks: { title: 'Receive Stripe events in your webhook endpoint', source: 'Stripe docs', url: 'https://docs.stripe.com/webhooks', kind: 'docs', note: 'Stripe-Signature; live retries up to 3 days; no ordering guarantee' },
  connect: { title: 'Improving Connect to enable more platforms', source: 'Stripe blog', year: 2017, url: 'https://stripe.com/blog/connect-updates', kind: 'blog', note: 'Connect first launched in 2012' },
  marketplace: { title: 'It’s a sellers’ market(place)', source: 'Stripe blog', year: 2024, url: 'https://stripe.com/blog/its-a-sellers-marketplace', kind: 'blog', note: 'platforms serving 8M+ businesses' },
  ledger: { title: 'Ledger: Stripe’s system for tracking and validating money movement', source: 'Stripe engineering', year: 2024, url: 'https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement', kind: 'blog', note: '5B events/day' },
  radar2: { title: 'Improved fraud prevention with Radar 2.0', source: 'Stripe blog', year: 2018, url: 'https://stripe.com/blog/radar-2018', kind: 'blog', note: 'Radar launched 2016; nightly retraining' },
  radarPrimer: { title: 'A primer on machine learning for fraud detection', source: 'Stripe blog', year: 2016, url: 'https://stripe.com/blog/a-primer-on-machine-learning-for-fraud-detection', kind: 'blog' },
  elements: { title: 'Stripe unveils Stripe Elements', source: 'Stripe newsroom', year: 2017, url: 'https://stripe.com/newsroom/news/stripe-launches-elements', kind: 'blog', note: 'card data goes straight to Stripe; SAQ A' },
  pci: { title: 'A guide to PCI compliance', source: 'Stripe', url: 'https://stripe.com/guides/pci-compliance', kind: 'docs' },
  migrations: { title: 'Online migrations at scale', source: 'Jacqueline Xu, Stripe blog', year: 2017, url: 'https://stripe.com/blog/online-migrations', kind: 'blog', note: 'four-step dual-write pattern' },
  rbi: { title: 'Storage of Payment System Data (RBI/2017-18/153)', source: 'Reserve Bank of India', year: 2018, url: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11244', kind: 'docs' },
  sca: { title: 'Stripe readies businesses for Strong Customer Authentication in Europe', source: 'Stripe newsroom', year: 2019, url: 'https://stripe.com/newsroom/news/sca', kind: 'blog' },
  intents: { title: 'The Payment Intents API', source: 'Stripe docs', url: 'https://docs.stripe.com/payments/payment-intents', kind: 'docs' },
  retries: { title: 'Timeouts, retries, and backoff with jitter', source: 'Amazon Builders’ Library', url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/', kind: 'blog' },
  bfcm: { title: 'Businesses processed more than $31 billion on Stripe from Black Friday through Cyber Monday', source: 'Stripe newsroom', year: 2024, url: 'https://stripe.com/newsroom/news/bfcm2024', kind: 'blog' },
  letter: { title: 'Stripe’s 2023 annual letter', source: 'Stripe', year: 2024, url: 'https://stripe.com/annual-updates/2023', kind: 'blog', note: '~$1T total payment volume in 2023' },
} satisfies Record<string, Reference>
