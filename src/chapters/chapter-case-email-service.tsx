import {
  ApiSpec, ArchitectureDiagram, Callout, CodeBlock, EstimationTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways,
  LayerStack, MentalModel, References, Requirements, SideBySide, StatRow, TLDR, Term,
} from '../components/ui'
import type { ArchEdge, ArchNode, Reference } from '../components/ui'
import {
  Archive, BadgeCheck, Ban, Database, FileSearch, FileSignature, Gauge, Globe, HardDrive, ListOrdered, Mail, RotateCcw, ScanSearch, Send, ShieldCheck, Split, Users,
} from 'lucide-react'
import { EmailInboundPipelineDemo } from './demos/email-inbound-pipeline-demo'

const REFS: Reference[] = [
  { title: 'RFC 5321: Simple Mail Transfer Protocol', source: 'IETF', year: 2008, url: 'https://www.rfc-editor.org/rfc/rfc5321', kind: 'rfc', note: 'SMTP, MX lookup, and the rule that an accepted message must not be lost' },
  { title: 'RFC 7208: Sender Policy Framework (SPF)', source: 'IETF', year: 2014, url: 'https://www.rfc-editor.org/rfc/rfc7208', kind: 'rfc' },
  { title: 'RFC 6376: DomainKeys Identified Mail (DKIM) Signatures', source: 'IETF', year: 2011, url: 'https://www.rfc-editor.org/rfc/rfc6376', kind: 'rfc' },
  { title: 'RFC 7489: Domain-based Message Authentication, Reporting, and Conformance (DMARC)', source: 'IETF', year: 2015, url: 'https://www.rfc-editor.org/rfc/rfc7489', kind: 'rfc', note: 'alignment and p=none / quarantine / reject policies' },
  { title: 'RFC 5322: Internet Message Format', source: 'IETF', year: 2008, url: 'https://www.rfc-editor.org/rfc/rfc5322', kind: 'rfc', note: 'Message-ID, In-Reply-To and References headers used for threading' },
  { title: 'RFC 9051: IMAP Version 4rev2', source: 'IETF', year: 2021, url: 'https://www.rfc-editor.org/rfc/rfc9051', kind: 'rfc' },
  { title: 'RFC 2177: IMAP4 IDLE command', source: 'IETF', year: 1997, url: 'https://www.rfc-editor.org/rfc/rfc2177', kind: 'rfc', note: 'server push of new mail to IMAP clients' },
  { title: 'System Design Interview – An Insider’s Guide, Vol. 2 (ch. “Distributed Email Service”)', source: 'Alex Xu & Sahn Lam', year: 2022, kind: 'book', note: 'recommended further reading on the same prompt' },
]

const NODES: ArchNode[] = [
  { id: 'mta', label: 'Sender MTA', sub: 'other providers', kind: 'external', x: 10, y: 20,
    detail: 'Another mail server looks up our MX record in DNS and opens an SMTP connection to deliver.' },
  { id: 'edge', label: 'SMTP edge', sub: 'MX, TLS, limits', kind: 'lb', x: 28, y: 20,
    detail: 'Terminates SMTP and TLS, applies per-IP connection limits, and rejects obvious abuse before reading the body. It answers “250 OK” only after the message is durably queued.' },
  { id: 'filter', label: 'Auth + spam', sub: 'SPF · DKIM · DMARC', kind: 'service', x: 46, y: 20,
    detail: 'Checks sender authentication, then scores content with rules and ML models. Malware scanning runs on attachments. The verdict decides inbox, spam folder, or reject.' },
  { id: 'queue', label: 'Delivery queue', sub: 'replicated log', kind: 'queue', x: 64, y: 20,
    detail: 'The durability boundary. Once a message is here on several replicas, the edge can acknowledge it. Mailbox writers consume from it, so a slow store never blocks SMTP.' },
  { id: 'outbound', label: 'Outbound relay', sub: 'reputation-aware', kind: 'service', x: 82, y: 20,
    detail: 'Delivers users’ sent mail to other providers. Pools IP addresses by reputation, throttles per destination domain, retries with backoff, and processes bounces.' },
  { id: 'push', label: 'Push service', sub: 'WebSocket · IMAP IDLE', kind: 'service', x: 46, y: 50,
    detail: 'Holds long-lived connections and tells clients “something changed in folder X”. Clients then fetch the delta; the push carries no mail content.' },
  { id: 'mailbox', label: 'Mailbox service', sub: 'owns a user’s mail', kind: 'service', x: 64, y: 50,
    detail: 'Writes the metadata row, stores the body in blob storage, updates labels and thread IDs, and emits an index event. All reads and writes for one user go to the shard that owns that user.' },
  { id: 'meta', label: 'Metadata store', sub: 'wide-column, by user', kind: 'db', x: 82, y: 50,
    detail: 'Small, hot rows: sender, subject, snippet, labels, read flag, thread ID. Partition key is the user ID, clustering by label and time, so “show my inbox” is one partition scan.' },
  { id: 'client', label: 'Clients', sub: 'web · mobile · IMAP', kind: 'client', x: 10, y: 80 },
  { id: 'gw', label: 'API gateway', kind: 'lb', x: 28, y: 80 },
  { id: 'search', label: 'Search index', sub: 'per-mailbox', kind: 'search', x: 64, y: 80,
    detail: 'An inverted index sharded by user. A query never crosses users, which keeps indexes small and makes access control trivial.' },
  { id: 'blob', label: 'Blob store', sub: 'bodies + attachments', kind: 'storage', x: 82, y: 80,
    detail: 'Immutable objects addressed by content hash. The same attachment sent to 1,000 recipients is stored once, with references from each mailbox.' },
]

const EDGES: ArchEdge[] = [
  { from: 'mta', to: 'edge' }, { from: 'edge', to: 'filter' }, { from: 'filter', to: 'queue', async: true },
  { from: 'queue', to: 'mailbox', async: true }, { from: 'mailbox', to: 'meta' }, { from: 'mailbox', to: 'blob' },
  { from: 'mailbox', to: 'search', async: true }, { from: 'mailbox', to: 'push' }, { from: 'push', to: 'client' },
  { from: 'client', to: 'gw' }, { from: 'gw', to: 'mailbox' }, { from: 'gw', to: 'search' }, { from: 'mailbox', to: 'outbound', async: true },
]

export default function EmailServiceChapter() {
  return (
    <>
      <TLDR items={[
        'Receive mail from the whole internet over SMTP, file it into a billion mailboxes, and let users read, search, and send.',
        'Key decision: acknowledge a message only after it is durably queued. SMTP senders delete their copy once you say “250 OK”.',
        'Split storage: small metadata rows partitioned by user, large bodies and attachments in content-addressed blob storage.',
        'The hard part is trust: SPF, DKIM and DMARC for identity, plus spam scoring where false positives cost more than misses.',
        'Staff insight: search, spam filtering and end-to-end encryption pull in opposite directions. Name the trade-off explicitly.',
      ]} />
      <MentalModel id="email-service" />

      <p>
        Email is a 40-year-old protocol running at planet scale. You do not control the senders, the clients, or the
        format of what arrives. You only control what you accept and how you store it.
      </p>
      <p>
        That shapes the design. The inbound path must be <strong>cautious</strong>: authenticate, score, then commit
        durably. The mailbox path must be <strong>fast and per-user</strong>, because every read, search and label change
        is scoped to one person.
      </p>

      <H2 id="requirements">1 · Clarify requirements</H2>
      <p>Pin down scale, size limits and what “never lose mail” means before drawing boxes.</p>
      <Requirements
        functional={['Receive mail from any provider (SMTP)', 'Send mail to any provider', 'Folders or labels, threads, read state', 'Full-text search over one’s own mailbox', 'Attachments up to 25 MB', 'Near-real-time new-mail notifications']}
        nonFunctional={['1B users', 'Accepted mail is never lost', 'Inbox load p99 < 300 ms; search p99 < 1 s', 'Spam folder accuracy: very few false positives', 'Multi-region, highly available reads']}
        outOfScope={['Calendar and contacts', 'Chat', 'Ads']}
      />
      <Callout kind="tip">
        Ask whether this is a <strong>web-first provider</strong> (API + push) or also a full <strong>IMAP server</strong>.
        IMAP adds per-folder UID sequences and long-lived connections that shape the mailbox store.
      </Callout>

      <H2 id="estimation">2 · Back-of-the-envelope</H2>
      <p>The traffic is moderate. Storage is what makes this a big system.</p>
      <EstimationTable
        assumptions={['1B users; each receives 40 and sends 10 messages per day (illustrative)', 'Average body 50 KB; 20% of messages carry attachments averaging 500 KB', 'Metadata row ~1 KB per message per mailbox']}
        rows={[
          { label: 'Inbound messages', math: '1B × 40 / 86,400', result: '≈ 460K/s' },
          { label: 'Outbound messages', math: '1B × 10 / 86,400', result: '≈ 115K/s' },
          { label: 'Bodies per day', math: '40B × 50 KB', result: '≈ 2 PB' },
          { label: 'Attachments per day', math: '40B × 20% × 500 KB', result: '≈ 4 PB (before dedupe)' },
          { label: 'Metadata per day', math: '40B × 1 KB', result: '≈ 40 TB' },
        ]}
      />
      <StatRow stats={[
        { value: '460K/s', label: 'inbound messages', note: 'illustrative' },
        { value: '2 PB/day', label: 'message bodies' },
        { value: '4 PB/day', label: 'attachments', note: 'before dedupe' },
        { value: '40 TB/day', label: 'metadata' },
      ]} />
      <p>
        Metadata is under 1% of the bytes but serves almost every request. That ratio argues for two stores with
        very different cost profiles, not one.
      </p>

      <H2 id="api">3 · API</H2>
      <p>Clients talk to a JSON API plus a push channel. Other mail servers talk SMTP to the edge, not this API.</p>
      <ApiSpec endpoints={[
        { method: 'POST', path: '/v1/messages', desc: 'Send a message. Attachments are uploaded first via pre-signed URLs.', body: '{ to[], cc[], subject, body, attachmentIds[], idempotencyKey }', returns: '202 { messageId }' },
        { method: 'GET', path: '/v1/labels/{label}/messages', desc: 'List message headers in a label, newest first.', body: '?cursor&limit=50', returns: '{ items[], nextCursor }' },
        { method: 'GET', path: '/v1/messages/{id}', desc: 'Fetch one message, with a signed URL for the body and attachments.', returns: '{ headers, snippet, bodyUrl, attachments[] }' },
        { method: 'PATCH', path: '/v1/messages/{id}', desc: 'Change labels or read state.', body: '{ addLabels[], removeLabels[], read? }', returns: '200' },
        { method: 'GET', path: '/v1/search', desc: 'Search the caller’s mailbox only.', body: '?q=from:alice invoice&cursor', returns: '{ items[], nextCursor }' },
        { method: 'WS', path: '/v1/events', desc: 'Push channel: “label X changed, new history id N”. Clients then sync the delta.', returns: 'stream of change events' },
      ]} />

      <H2 id="high-level">4 · High-level design</H2>
      <p>
        Two worlds meet in the mailbox service. The top row speaks SMTP to the internet. The bottom row serves your own
        users. The <Term def="A replicated, append-only buffer. Once a message is written there on several machines, losing one server cannot lose the message.">delivery queue</Term>{' '}
        between them is where a message becomes durable.
      </p>
      <ArchitectureDiagram nodes={NODES} edges={EDGES} height={440}
        caption="Inbound mail is authenticated, queued durably, then filed into the recipient’s mailbox shard"
        flows={[
          { name: 'Receive', path: ['mta', 'edge', 'filter', 'queue', 'mailbox', 'meta'],
            steps: ['Remote server connects to our MX over SMTP', 'Edge passes the message to authentication and spam scoring', 'Verdict attached; message written to the replicated queue, then the edge replies 250 OK', 'Mailbox writer for the recipient’s shard consumes it', 'Metadata row written; body goes to the blob store'] },
          { name: 'Notify', path: ['mailbox', 'push', 'client'],
            steps: ['Mailbox service emits “inbox changed” for the user', 'Push service tells every connected device to sync'] },
          { name: 'Read inbox', path: ['client', 'gw', 'mailbox', 'meta'],
            steps: ['Client requests the inbox page', 'Gateway routes to the user’s mailbox shard', 'One partition scan by (user, label, time)'] },
          { name: 'Send', path: ['client', 'gw', 'mailbox', 'outbound'],
            steps: ['Client posts a message with an idempotency key', 'Mailbox stores it in Sent', 'Outbound relay delivers to each recipient domain, retrying with backoff'] },
        ]} />

      <H2 id="trust">5 · Deep dive: authentication and spam</H2>
      <p>
        Anyone can put any address in the <em>From</em> line. Three DNS-based standards let you check the claim, and
        each one covers a gap in the others.
      </p>
      <SideBySide caption="DMARC is what turns two partial checks into a policy the domain owner controls" panels={[
        { title: 'SPF', icon: Globe, points: ['+ Domain lists IPs allowed to send for it', '+ Cheap: one DNS lookup', '- Breaks when mail is forwarded', '- Checks the envelope sender, not the visible From'], verdict: '“Did an allowed server send this?”' },
        { title: 'DKIM', icon: FileSignature, points: ['+ Signature over headers and body', '+ Usually survives forwarding', '- Breaks if a list rewrites the body', '- Signing domain can differ from From'], verdict: '“Was it altered, and who signed it?”' },
        { title: 'DMARC', icon: BadgeCheck, tone: 'good', points: ['+ Requires SPF or DKIM to align with the From domain', '+ Owner publishes none / quarantine / reject', '+ Aggregate reports back to the owner'], verdict: '“What should I do if both fail?”' },
      ]} />
      <p>
        Authentication proves <em>who</em> sent a message, not whether you want it. Spammers authenticate their own
        domains perfectly well. So authenticated mail still goes through content scoring, with thresholds tuned so that
        losing real mail is rare.
      </p>
      <FlowDiagram steps={[
        { label: 'Connection', sub: 'IP reputation, rate limits', icon: Gauge },
        { label: 'Authenticate', sub: 'SPF · DKIM · DMARC', icon: ShieldCheck },
        { label: 'Scan', sub: 'malware, URLs', icon: ScanSearch },
        { label: 'Score', sub: 'rules + ML', icon: FileSearch },
        { label: 'Route', sub: 'inbox · spam · reject', icon: Split },
      ]} caption="Cheap checks first: most abuse is dropped before the body is even read" />
      <EmailInboundPipelineDemo />
      <Callout kind="pitfall">
        Tuning only for catch rate. A spam folder that swallows one real invoice a week destroys trust faster than a
        few extra spam messages. Measure false positives separately and treat them as the primary SLO.
      </Callout>

      <H2 id="storage">6 · Deep dive: mailbox storage</H2>
      <p>
        Every query in a mailbox is scoped to one user. So partition everything by{' '}
        <Term def="The key that decides which shard stores a row. All rows with the same partition key live together.">partition key</Term>{' '}
        = user ID, and keep the hot metadata small.
      </p>
      <LayerStack legend="What a single inbox load touches, from hot to cold"
        caption="Bodies and attachments are fetched only when a message is opened"
        layers={[
          { label: 'Metadata rows', sub: 'sender, subject, snippet, labels, thread', icon: Database, size: 0.4, value: '~1 KB each', highlight: true },
          { label: 'Message bodies', sub: 'blob store, compressed', icon: Mail, size: 0.7, value: '~50 KB each' },
          { label: 'Attachments', sub: 'content-addressed, deduplicated', icon: HardDrive, size: 0.9, value: '~500 KB each' },
          { label: 'Cold tier', sub: 'old mail on cheaper storage', icon: Archive, size: 1, value: 'years of history' },
        ]} />
      <p>
        <strong>Threads</strong> come from standard headers. Each message has a Message-ID, and replies carry{' '}
        <Term def="Headers that list the Message-IDs a reply responds to. Following them links messages into a conversation.">In-Reply-To and References</Term>.
        The mailbox service maps those to a thread ID on write, with a subject-based fallback for broken clients.
      </p>
      <p>
        <strong>Labels</strong> are a set on the metadata row, plus one index row per label so “all mail labelled
        Receipts” is a single range scan. Moving a message is just a label change, never a copy.
      </p>

      <H2 id="search">7 · Deep dive: search</H2>
      <p>
        Users search only their own mail. That one fact decides the index layout.
      </p>
      <SideBySide caption="Per-mailbox indexes trade some efficiency for isolation and simplicity" panels={[
        { title: 'One global index', icon: Globe, tone: 'bad', points: ['+ Best compression across all mail', '- Every query needs a user filter', '- One bug leaks mail across users', '- Huge shards, painful rebuilds'], verdict: 'Wrong fit for private data' },
        { title: 'Index per mailbox', icon: Users, tone: 'good', points: ['+ Access control is the shard boundary', '+ Small indexes, fast rebuilds', '+ Idle mailboxes can sit on cold storage', '- Many tiny indexes to manage'], verdict: 'Standard choice for email' },
      ]} />
      <p>
        Indexing is asynchronous. The mailbox service emits an event after each write, and indexers update the user’s{' '}
        <Term def="A map from each word to the list of documents that contain it, which makes keyword search fast.">inverted index</Term>{' '}
        within seconds. Search results briefly lagging new mail is acceptable; losing mail is not.
      </p>

      <H2 id="outbound">8 · Deep dive: sending and deliverability</H2>
      <p>
        Sending is easy. Getting delivered is hard, because every other provider scores <em>you</em>. A few
        compromised accounts sending spam can hurt deliverability for everyone on the same IPs.
      </p>
      <FlowDiagram steps={[
        { label: 'Queue', sub: 'per destination domain', icon: ListOrdered },
        { label: 'Throttle', sub: 'respect remote limits', icon: Gauge },
        { label: 'Sign + send', sub: 'DKIM, TLS', icon: Send },
        { label: 'Retry', sub: 'backoff on 4xx', icon: RotateCcw },
        { label: 'Bounce', sub: '5xx → notify sender', icon: Ban },
      ]} caption="Temporary failures (4xx) are retried for days; permanent failures (5xx) bounce back to the sender" />
      <p>
        Protect reputation with separate IP pools for trusted and new senders, per-account send limits, and outbound
        spam scoring. The reputation you guard is shared, so abuse detection on the send path matters as much as on the
        receive path.
      </p>

      <H2 id="data-model">9 · Data model</H2>
      <p>Three records carry the design: the per-user metadata row, a label index, and immutable blobs.</p>
      <CodeBlock lang="ts" title="storage layout" code={`
// Metadata store (wide-column). Partition = userId, so one user's mailbox is one partition.
type MessageRow = {
  userId: string; messageId: string          // messageId is time-sortable
  threadId: string; labels: string[]; read: boolean
  from: string; subject: string; snippet: string; receivedAt: number
  bodyRef: string                            // blob key, e.g. sha256 of the body
  attachmentRefs: string[]                   // content-addressed, shared across mailboxes
  spamVerdict: 'inbox' | 'spam'; authResults: string
}

// Label index: labels:{userId}:{label} -> clustering by receivedAt desc -> messageId
// History log: history:{userId} -> monotonic historyId -> change record
//   (clients sync "everything after historyId N"; push only says "N changed")`} />

      <H2 id="staff">10 · Going beyond: staff-level extensions</H2>
      <p>The design above works. Staff candidates also cover the policies and trade-offs that shape it for years.</p>
      <Callout kind="staff">
        <ul>
          <li><strong>The ack boundary.</strong> SMTP says a server that accepts a message takes responsibility for it. So “250 OK” must follow a replicated write, and every later stage must be idempotent on messageId.</li>
          <li><strong>Encryption versus features.</strong> End-to-end encryption removes the server’s ability to search, scan for malware, and filter spam. Be explicit about which you give up, or move them to the client.</li>
          <li><strong>Retention and legal hold.</strong> Deletes become tombstones; a hold overrides user deletion for specific accounts. Blob garbage collection must respect both, which is why reference counting on shared attachments is subtle.</li>
          <li><strong>Data residency.</strong> Pin a user’s mailbox shard to a region, route inbound mail there, and keep global services (spam models, reputation) free of message content.</li>
          <li><strong>Cost.</strong> Most mail is never opened again after a month. Tiering bodies and attachments to cold storage, while keeping metadata hot, is the biggest storage lever.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="A mailbox storage node dies right after we replied 250 OK to a sender. Is the message lost?"
        senior={<p>It shouldn’t be. We replicate the mailbox store, so another replica has the message and serves it.</p>}
        staff={<>
          <p>The key is where we acknowledge. We only reply 250 OK after the message is durably written to the replicated delivery queue, before any mailbox write. The mailbox writer consumes from the queue, so a dead storage node just means the consumer retries against the new owner of that shard.</p>
          <p>Because retries can deliver twice, the mailbox write is idempotent on (userId, messageId). If we acknowledged before the queue write, a crash in that gap would silently drop mail the sender has already deleted. That is the one failure email users never forgive.</p>
        </>}
        followUps={['How long do you keep messages in the queue?', 'What if the recipient’s shard is down for an hour?', 'How do you detect duplicate deliveries from the remote side?']}
      />
      <InterviewQuestion
        q="How would you design search for a billion mailboxes?"
        senior={<p>Use an inverted index like Elasticsearch, sharded across many nodes, and filter results by user ID.</p>}
        staff={<>
          <p>I would shard the index by user, not by term or globally, because every query is scoped to one mailbox. Each user gets a logical index, and many small ones are packed onto each node. Access control then comes for free: a query physically cannot read another user’s index.</p>
          <p>Indexing is async from a change log, so new mail shows up in search within seconds. Idle users’ indexes can live on cheaper storage and load on first search. The hard parts are attachments (extract text asynchronously, with size limits) and keeping the index consistent with deletes and legal holds.</p>
        </>}
        followUps={['What about searching across a company’s shared mailboxes?', 'How do you rebuild an index after a format change?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Acknowledge SMTP only after a replicated write. Every later step must be idempotent on messageId.',
        'SPF checks the sending server, DKIM checks integrity, DMARC ties both to the visible From domain.',
        'Partition everything by user: metadata, labels, history, and the search index.',
        'Keep small metadata hot and large bodies and attachments in deduplicated, tiered blob storage.',
        'Spam false positives are the primary quality metric; deliverability depends on guarding shared IP reputation.',
      ]} />
    </>
  )
}
