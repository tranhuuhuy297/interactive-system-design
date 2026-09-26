import type { Reference } from '../../components/ui'

// Primary public sources for the WhatsApp episode; shared by stage deep dives and the chapter's Sources list.
export const WHATSAPP_SRC = {
  wiki: { title: 'WhatsApp', source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/WhatsApp', kind: 'docs', note: 'founding (2009), user milestones, multi-device rollout' },
  twoMillion: { title: '1 million is so 2011', source: 'WhatsApp Blog', year: 2012, url: 'https://blog.whatsapp.com/1-million-is-so-2011', kind: 'blog', note: '2,277,845 open sockets on one FreeBSD box' },
  billionB: { title: 'That’s ‘Billion’ with a ‘B’: Scaling to the next level at WhatsApp (slides)', source: 'Rick Reed, Erlang Factory SF', year: 2014, url: 'https://www.erlang-factory.com/static/upload/media/1394350183453526efsf2014whatsappscaling.pdf', kind: 'talk' },
  hs500m: { title: 'How WhatsApp Grew to Nearly 500 Million Users, 11,000 cores, and 70 Million Messages a Second', source: 'High Scalability', year: 2014, url: 'https://highscalability.com/how-whatsapp-grew-to-nearly-500-million-users-11000-cores-an/', kind: 'blog', note: 'write-up of the 2014 talk: servers, Mnesia, partitioning' },
  hs19b: { title: 'The WhatsApp Architecture Facebook Bought For $19 Billion', source: 'High Scalability', year: 2014, url: 'https://highscalability.com/the-whatsapp-architecture-facebook-bought-for-19-billion/', kind: 'blog', note: 'ejabberd origins, team size, transient message storage' },
  acquisition: { title: 'Facebook to Acquire WhatsApp', source: 'Meta Newsroom', year: 2014, url: 'https://about.fb.com/news/2014/02/facebook-to-acquire-whatsapp/', kind: 'blog' },
  e2ee: { title: 'end-to-end encryption', source: 'WhatsApp Blog', year: 2016, url: 'https://blog.whatsapp.com/end-to-end-encryption', kind: 'blog' },
  signal: { title: 'WhatsApp’s Signal Protocol integration is now complete', source: 'Signal Blog', year: 2016, url: 'https://signal.org/blog/whatsapp-complete/', kind: 'blog' },
  senderKeys: { title: 'Sender Keys', source: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Sender_Keys', kind: 'docs', note: 'group encryption with server fan-out' },
  whitepaper: { title: 'WhatsApp Encryption Overview (technical whitepaper)', source: 'WhatsApp', url: 'https://www.whatsapp.com/security/WhatsApp-Security-Whitepaper.pdf', kind: 'docs' },
  multiDevice: { title: 'How WhatsApp enables multi-device capability', source: 'Engineering at Meta', year: 2021, url: 'https://engineering.fb.com/2021/07/14/security/whatsapp-multi-device/', kind: 'blog' },
  backups: { title: 'How WhatsApp is enabling end-to-end encrypted backups', source: 'Engineering at Meta', year: 2021, url: 'https://engineering.fb.com/2021/09/10/security/whatsapp-e2ee-backups/', kind: 'blog' },
} satisfies Record<string, Reference>

export const WHATSAPP_REFS: Reference[] = Object.values(WHATSAPP_SRC)
