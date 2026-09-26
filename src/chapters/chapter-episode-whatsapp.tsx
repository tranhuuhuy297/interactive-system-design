import {
  ArchitectureDiagram, Callout, CompareTable, EpisodePlayer, EstimationTable, H2, InterviewQuestion,
  KeyTakeaways, MentalModel, References, SideBySide, StatRow, Term, TLDR, VisualTimeline,
} from '../components/ui'
import { Building2, Cpu, Database, Image, KeyRound, Lock, MessageCircle, Server, Smartphone, Users } from 'lucide-react'
import type { ArchEdge, ArchNode } from '../components/ui'
import { EpisodeWhatsappFanoutDemo } from './demos/episode-whatsapp-fanout-demo'
import { WHATSAPP_REFS } from './demos/episode-whatsapp-sources'
import { WHATSAPP_STAGES } from './demos/episode-whatsapp-stages'

const SEND_NODES: ArchNode[] = [
  { id: 'sender', label: 'Sender phone', sub: 'encrypts locally', kind: 'client', x: 10, y: 22,
    detail: 'Fetches the recipient’s public keys once, then encrypts every message on the device. The server never sees plaintext.' },
  { id: 'keys', label: 'Key directory', sub: 'public keys only', kind: 'service', x: 34, y: 22 },
  { id: 'chat', label: 'Chat server', sub: 'holds the socket', kind: 'service', x: 34, y: 62,
    detail: 'One lightweight Erlang process per connected phone. It relays ciphertext and receipts.' },
  { id: 'queue', label: 'Offline queue', sub: 'until acked', kind: 'queue', x: 62, y: 84,
    detail: 'Holds ciphertext for offline devices. Deleted as soon as the device acknowledges delivery.' },
  { id: 'media', label: 'Media servers', sub: 'encrypted blobs', kind: 'storage', x: 62, y: 22 },
  { id: 'recv', label: 'Recipient devices', sub: 'phone + companions', kind: 'client', x: 86, y: 62 },
]
const SEND_EDGES: ArchEdge[] = [
  { from: 'sender', to: 'keys' }, { from: 'sender', to: 'chat' }, { from: 'chat', to: 'recv' },
  { from: 'chat', to: 'queue', async: true }, { from: 'sender', to: 'media' }, { from: 'media', to: 'recv' },
]

const TIMELINE = [
  { when: '2009', title: 'Launch on ejabberd, an open-source XMPP server', icon: MessageCircle },
  { when: '2012', title: '2 million+ connections on one FreeBSD box', icon: Cpu },
  { when: 'by 2014', title: 'Store-and-forward, Mnesia state, separate media servers', icon: Database },
  { when: 'Feb 2014', title: 'Facebook acquisition; 450M+ monthly users', icon: Building2 },
  { when: 'Apr 2016', title: 'End-to-end encryption with the Signal Protocol', icon: Lock },
  { when: '2016', title: 'Group messages with Sender Keys and server fan-out', icon: Users },
  { when: 'after 2014', title: 'Migration into Meta’s data centers', icon: Server },
  { when: '2021–2023', title: 'Multi-device with per-device keys', icon: Smartphone },
  { when: 'Sep 2021', title: 'End-to-end encrypted backups', icon: KeyRound },
]

export default function WhatsappEpisode() {
  return (
    <>
      <TLDR items={[
        'WhatsApp is a relay, not an archive: servers hold a message only until the phone takes it.',
        'Each server held millions of open connections, thanks to Erlang and deep OS tuning.',
        'Since 2016, phones encrypt everything; servers relay ciphertext they cannot read.',
        'Groups use Sender Keys: encrypt once, and the server copies the ciphertext to members.',
        'Multi-device and backups were rebuilt around keys that never leave devices.',
      ]} />
      <MentalModel id="ep-whatsapp" />
      <p>
        WhatsApp became famous for doing more with less: hundreds of millions of users on a few hundred servers and a
        tiny team. The trick was a sharp scope. The server is a <strong>post office</strong>, not a filing cabinet.
      </p>
      <p>
        Then came a second, harder constraint: <Term def="Only the sender’s and recipients’ devices hold the keys. The operator relays ciphertext it cannot decrypt.">end-to-end encryption</Term>.
        This episode shows how both ideas shaped everything else, from{' '}
        <Term def="Hold a message only until the recipient’s device acknowledges it, then delete the server copy.">store-and-forward</Term> queues
        to <Term def="A group scheme where each sender shares a key once, then encrypts each message a single time for the whole group.">Sender Keys</Term>.
      </p>
      <Callout kind="info" title="How to watch this episode">
        At each stage, ask: <em>what does the server know?</em> and <em>how many copies does one message become?</em>{' '}
        Open “Go deeper” for the step-by-step flow, numbers, and sources.
      </Callout>
      <p className="muted"><em>This episode is an independent reconstruction from public sources. It is not affiliated with or endorsed by WhatsApp or Meta; all trademarks belong to their owners.</em></p>

      <H2 id="timeline">Timeline at a glance</H2>
      <VisualTimeline items={TIMELINE} />

      <H2 id="the-build">The build, stage by stage</H2>
      <EpisodePlayer stages={WHATSAPP_STAGES} height={400} />

      <H2 id="numbers">The numbers that shape everything</H2>
      <p>These figures come from WhatsApp’s March 2014 conference talk. They show why connections, not storage, set the size of the fleet.</p>
      <StatRow caption="Reported in the 2014 Erlang Factory talk" stats={[
        { value: '465M', label: 'monthly users', note: '2014' },
        { value: '147M', label: 'peak concurrent connections', note: '2014' },
        { value: '≈ 550', label: 'servers in total', note: '2014' },
      ]} />
      <EstimationTable
        assumptions={['Figures from the 2014 talk', 'About 150 chat servers held the connections', 'Messages spread evenly over a day (real traffic is peaky)']}
        rows={[
          { label: 'Connections per chat server', math: '147M / ≈150', result: '≈ 1M' },
          { label: 'Outbound messages, average', math: '40B / 86,400 s', result: '≈ 460K /s' },
          { label: 'Fan-out ratio', math: '40B out / 19B in', result: '≈ 2.1×' },
          { label: 'Mnesia RAM per partition', math: '≈ 2 TB / 16', result: '≈ 125 GB' },
        ]}
      />
      <p>
        The fan-out ratio is the hidden multiplier: group chats turn one incoming message into many outgoing ones.
        Encryption later made that multiplier expensive on the <em>phone</em>, which is what Sender Keys fix.
      </p>

      <H2 id="send-a-message">What happens when you press Send</H2>
      <p>One message, three possible paths: the recipient is online, offline, or it carries a photo.</p>
      <ArchitectureDiagram nodes={SEND_NODES} edges={SEND_EDGES} height={380}
        caption="Encrypt on the phone, relay ciphertext, delete after delivery"
        flows={[
          { name: 'Online', path: ['sender', 'keys', 'sender', 'chat', 'recv'], steps: ['Sender fetches public keys (first message only)', 'Keys come back; sender encrypts locally', 'Ciphertext goes up over the open connection', 'Server pushes it to each recipient device'] },
          { name: 'Offline', path: ['sender', 'chat', 'queue'], steps: ['Ciphertext arrives at the chat server', 'Recipient is offline, so it waits in the queue until acknowledged'] },
          { name: 'Photo', path: ['sender', 'media', 'recv'], steps: ['Phone uploads the encrypted file', 'Recipient downloads it and decrypts it on the device'] },
        ]} />

      <H2 id="group-fanout">Deep dive: why groups need Sender Keys</H2>
      <p>
        With pairwise encryption, a phone must encrypt and upload a separate copy for every recipient device. In a big
        group, that burns battery and data. Sender Keys move the copying to the server, without giving the server the key.
      </p>
      <EpisodeWhatsappFanoutDemo />
      <Callout kind="pitfall">
        “Just have the server fan out” is only half an answer under end-to-end encryption. The server can only copy a
        ciphertext that every member can already decrypt, so you must explain how the key reached them.
      </Callout>

      <H2 id="decisions">Key decisions and their alternatives</H2>
      <p>The three decisions that define the system:</p>
      <SideBySide panels={[
        { title: 'Relay, not archive', icon: MessageCircle, tone: 'good', points: ['+ Tiny storage, small privacy footprint', '+ Simple servers', '- Instead of: server-side chat history'], verdict: 'Messages' },
        { title: 'Encrypt on the device', icon: Lock, tone: 'good', points: ['+ The operator cannot read content', '- Search, backups, and multi-device get harder', '- Instead of: TLS to the server only'], verdict: 'Privacy' },
        { title: 'Separate media servers', icon: Image, tone: 'good', points: ['+ Big files never block small messages', '- Instead of: media through chat servers'], verdict: 'Attachments' },
      ]} />
      <p>Other decisions, in brief:</p>
      <CompareTable
        columns={['Chosen', 'Alternative', 'Why the choice fits']}
        rows={[
          { label: 'Runtime', cells: ['Erlang, one process per connection', 'Thread-per-connection servers', 'Millions of cheap isolated processes per box'] },
          { label: 'Hot state', cells: ['In-memory Mnesia, partitioned', 'External SQL', 'Lookups on every message stay in RAM, in the same runtime'] },
          { label: 'Group encryption', cells: ['Sender Keys + server fan-out', 'Pairwise for every message', 'One encryption per message instead of one per device'] },
          { label: 'Backups', cells: ['User-held key or HSM vault', 'Company-held key', 'Keeps the end-to-end promise through restores'] },
        ]}
      />

      <H2 id="staff">Staff-level lens</H2>
      <Callout kind="staff">
        <ul>
          <li><strong>Scope is architecture.</strong> Deciding not to store history removed whole classes of storage, compliance, and scaling work.</li>
          <li><strong>Size by connections.</strong> For push messaging, concurrent sockets per box set fleet size. Know the per-connection memory budget.</li>
          <li><strong>Security constraints move cost to the edge.</strong> Under E2EE, fan-out, search, and recovery shift onto devices. Say how you keep phones fast.</li>
          <li><strong>Plan for churn.</strong> Group key schemes are cheap for stable groups and costly for churny ones. Ask how often membership changes.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview angles</H2>
      <InterviewQuestion
        q="Design message delivery for a chat app where users are often offline."
        senior={<p>Keep a persistent connection per online device. For offline users, store messages in a queue or database and deliver them on reconnect, then mark them delivered.</p>}
        staff={<>
          <p>I would treat the server as <strong>store-and-forward</strong>: a per-device queue that holds ciphertext only until an acknowledgement, then deletes it. Messages carry client-generated IDs so retries are idempotent, and receipts flow back the same way.</p>
          <p>Then I would size it. Queue depth is bounded by offline time times incoming rate, so I would set a retention limit and a push-notification path for long-offline devices. I would also decide early whether we keep history. Not keeping it shrinks storage and privacy risk, but it makes backups and new devices a separate design.</p>
        </>}
        followUps={['How do you keep message order per conversation?', 'What happens if an acknowledgement is lost?', 'How long do you keep undelivered messages?']}
      />
      <InterviewQuestion
        q="How would you add end-to-end encryption to group chats of up to 1,000 people?"
        senior={<p>Use the Signal Protocol with pairwise sessions, and encrypt the message for each member.</p>}
        staff={<>
          <p>Pairwise encryption per message makes the sender’s cost grow with group size times devices. I would use <strong>Sender Keys</strong>: each member distributes a sender key once over pairwise sessions, then encrypts every message a single time and the server fans it out.</p>
          <p>The trade-offs to name: rotation on every leave (all members re-key), weaker self-healing than pairwise ratchets, and server-visible membership metadata. For very large or churny groups I would measure rekey traffic and consider different limits or schemes.</p>
        </>}
        followUps={['What does the server learn about the group?', 'How does multi-device change the cost?', 'How do you handle a member added mid-conversation?']}
      />

      <H2 id="references">Sources</H2>
      <References items={WHATSAPP_REFS} />

      <KeyTakeaways items={[
        'Make the server a relay: store messages only until the device acknowledges them.',
        'For push messaging, size the fleet by concurrent connections per box.',
        'Split media from chat so large files never delay small messages.',
        'End-to-end encryption moves work to devices; plan fan-out, backups, and multi-device around it.',
        'Sender Keys make group sends one encryption, at the cost of re-keying when members leave.',
        'A small team scales by keeping scope sharp and the core path simple.',
      ]} />
    </>
  )
}
