import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, References,
} from '../components/ui'
import type { Reference } from '../components/ui'
import { AiSecInjectionDemo } from './demos/ai-sec-injection-demo'

const REFS: Reference[] = [
  { title: 'OWASP Top 10 for LLM Applications (2025)', source: 'OWASP Gen AI Security Project', url: 'https://genai.owasp.org/llm-top-10/', kind: 'docs' },
  { title: 'Not what you’ve signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection', source: 'Greshake et al.', year: 2023, url: 'https://arxiv.org/abs/2302.12173', kind: 'paper' },
  { title: 'Prompt injection attacks against GPT-3', source: 'Simon Willison', year: 2022, url: 'https://simonwillison.net/2022/Sep/12/prompt-injection/', kind: 'blog', note: 'Coined the term' },
  { title: 'The Dual LLM pattern for building AI assistants that can resist prompt injection', source: 'Simon Willison', year: 2023, url: 'https://simonwillison.net/2023/Apr/25/dual-llm-pattern/', kind: 'blog' },
  { title: 'The lethal trifecta for AI agents: private data, untrusted content, and external communication', source: 'Simon Willison', year: 2025, url: 'https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/', kind: 'blog' },
  { title: 'Defending Against Indirect Prompt Injection Attacks With Spotlighting', source: 'Hines et al.', year: 2024, url: 'https://arxiv.org/abs/2403.14720', kind: 'paper' },
  { title: 'Universal and Transferable Adversarial Attacks on Aligned Language Models', source: 'Zou et al.', year: 2023, url: 'https://arxiv.org/abs/2307.15043', kind: 'paper', note: 'Automated jailbreak suffixes' },
  { title: 'AI Risk Management Framework', source: 'NIST', url: 'https://www.nist.gov/itl/ai-risk-management-framework', kind: 'docs' },
]

export default function AiSafetySecurityChapter() {
  return (
    <>
      <p>
        Classic application security separates <strong>code</strong> from <strong>data</strong>: SQL has parameters,
        HTML has escaping. Language models have no such boundary. Instructions and data arrive in the same stream of
        tokens, so any text the model reads can try to steer it. That single property explains most of this chapter.
        Treat model output as untrusted, treat anything the model reads as potentially hostile, and put the real
        controls in code around the model.
      </p>

      <H2 id="threat-model">Threat model: OWASP Top 10 for LLM apps</H2>
      <CompareTable
        columns={['What goes wrong', 'Primary control']}
        rows={[
          { label: 'Prompt injection', cells: ['Crafted text (typed or embedded in content) overrides instructions', 'Least privilege, approvals, output filtering; detection helps but can’t be relied on'] },
          { label: 'Sensitive information disclosure', cells: ['Model reveals PII, secrets, or other users’ data', 'Don’t give it access in the first place; per-user retrieval permissions; redaction'] },
          { label: 'Improper output handling', cells: ['Model output flows into HTML, SQL, or shell unchecked', 'Treat output like user input: encode, parameterize, sandbox'] },
          { label: 'Excessive agency', cells: ['Tools with more power than the task needs', 'Scoped tools and credentials, confirmation for side effects'] },
          { label: 'System prompt leakage', cells: ['Attackers extract hidden instructions', 'Never put secrets or authorization logic in prompts'] },
          { label: 'Vector & embedding weaknesses', cells: ['RAG returns documents the user can’t see, or poisoned ones', 'Filter retrieval by the caller’s permissions; vet ingested sources'] },
          { label: 'Unbounded consumption', cells: ['Huge prompts, runaway agents, denial of wallet', 'Token quotas, step budgets, max input size'] },
        ]}
        caption="Selected entries from the 2025 list; see the OWASP project for all ten."
      />

      <H2 id="injection">Direct vs indirect prompt injection</H2>
      <ul>
        <li><strong>Direct:</strong> the user types instructions to subvert the system (“ignore your rules…”). The attacker is the user, so the blast radius is mostly their own session. Jailbreaks are a variant.</li>
        <li><strong>Indirect:</strong> instructions hide in content the model processes for someone else: a web page, email, PDF, code comment, tool result, or MCP tool description. The victim never sees them. This is the dangerous one for agents.</li>
      </ul>
      <FlowDiagram steps={[
        { label: 'Attacker plants text', sub: 'web page, email, doc' },
        { label: 'Victim’s agent reads it', sub: 'summarize, browse, RAG' },
        { label: 'Model follows it', sub: 'same channel as instructions' },
        { label: 'Exfiltrate or act', sub: 'tool call, link, image' },
      ]} caption="Indirect injection turns any readable content into a potential command channel" />
      <Callout kind="warn" title="The dangerous combination">
        Simon Willison calls it the <strong>lethal trifecta</strong>: an agent with access to <em>private data</em>,
        exposure to <em>untrusted content</em>, and a way to <em>communicate externally</em>. Remove any one leg and
        the data-theft path closes.
      </Callout>

      <H2 id="sandbox">Try it: layers of defense</H2>
      <p>
        The scenario: an email assistant summarizes your inbox, and one newsletter hides instructions for it. There are
        two exfiltration paths, a tool call and a markdown image whose URL carries data. Notice that a clever enough
        attacker gets past prompt-level defenses, and only controls enforced in code hold every time.
      </p>
      <AiSecInjectionDemo />

      <H2 id="defense-in-depth">Defense in depth</H2>
      <CompareTable
        columns={['Stops', 'Doesn’t stop']}
        rows={[
          { label: 'Input classifiers / “injection detectors”', cells: ['Known, crude attacks', 'Novel or obfuscated phrasing. It’s an arms race'] },
          { label: 'Delimiting untrusted content', cells: ['Some naive injections', 'Adaptive attacks. It lowers probability, not possibility'] },
          { label: 'Least-privilege tools', cells: ['Actions the task never needed', 'Misuse of tools the task does need'] },
          { label: 'Human confirmation', cells: ['Unwanted side effects, when users read prompts', 'Approval fatigue: users click “yes”'] },
          { label: 'Output filtering (URLs, HTML)', cells: ['Exfiltration via rendered links and images', 'Exfiltration via tools'] },
          { label: 'Dual-LLM / quarantine', cells: ['The privileged model never reads untrusted text directly', 'Adds complexity; limits what tasks can do'] },
        ]}
      />
      <p>
        In the <strong>dual-LLM pattern</strong>, a privileged model plans and calls tools but never sees untrusted
        content. A quarantined model, with no tools, processes that content, and its outputs are passed around as
        opaque references (“summary $1”) rather than as text the privileged model reads. It is not a silver bullet,
        but it shows the principle: separate the component that <em>reads</em> hostile text from the component that
        can <em>act</em>.
      </p>

      <H2 id="output-handling">Treat model output as untrusted input</H2>
      <CodeBlock lang="ts" title="never trust generated content" code={`
// ❌ XSS: the model can be steered into emitting <img onerror=...>
el.innerHTML = markdownToHtml(modelOutput)

// ✅ sanitize rendered markdown and allowlist link/image domains
el.innerHTML = sanitize(markdownToHtml(modelOutput), { allowedDomains: ['docs.example.com'] })

// ❌ SQL injection by proxy
db.query(\`SELECT * FROM orders WHERE status = '\${modelOutput.status}'\`)

// ✅ validate against a schema, then parameterize
const { status } = OrderFilter.parse(modelOutput)   // enum: 'open' | 'shipped' | 'refunded'
db.query('SELECT * FROM orders WHERE status = $1', [status])

// ❌ running generated code on your servers
eval(modelOutput.code)
// ✅ isolated sandbox: no network by default, CPU/memory/time limits, throwaway filesystem`} />

      <H2 id="content-safety">Jailbreaks and content safety</H2>
      <p>
        Alignment training makes models refuse harmful requests, but jailbreaks, including automatically generated
        adversarial suffixes, keep finding gaps. Production systems add <strong>moderation classifiers</strong> on
        inputs and outputs, category-specific policies, and rate limits for abusive accounts. Assume the system prompt
        will leak: keep secrets and authorization decisions out of it, and enforce permissions in code.
      </p>

      <H2 id="data">Data protection</H2>
      <ul>
        <li><strong>Permission-aware retrieval:</strong> filter RAG results by the requesting user’s access <em>before</em> they enter the prompt. See <a href="#/ai-rag">RAG Systems</a>.</li>
        <li><strong>Tenant isolation</strong> in caches, memories, and fine-tuning data. A semantic cache shared across tenants is a data leak waiting to happen.</li>
        <li><strong>Poisoning:</strong> ingested documents and training data can carry planted instructions or misinformation. Track provenance and vet sources.</li>
        <li><strong>PII:</strong> redact before sending when possible, and apply retention rules to logs and traces too.</li>
      </ul>

      <H2 id="operations">Red-teaming, monitoring, response</H2>
      <p>
        Maintain an evolving attack suite (known injections, jailbreaks, exfiltration attempts) and run it as a release
        gate like any other eval. In production, log tool calls and blocked actions, alert on spikes, and keep kill
        switches per tool and per feature. Frameworks like the NIST AI Risk Management Framework help organize this
        as a continuous process rather than a launch checklist.
      </p>

      <Callout kind="staff">
        <ul>
          <li><strong>Design for “the model will be tricked”.</strong> Security comes from what the model <em>can’t do</em>, not from what it’s told not to do.</li>
          <li><strong>Break the trifecta</strong> per feature: if it reads untrusted content, remove private data or external communication.</li>
          <li><strong>Deterministic controls in code</strong> (capabilities, approvals, output encoding, permissions) beat probabilistic controls in prompts.</li>
          <li><strong>Security review for every new tool:</strong> each tool expands the blast radius of every prompt injection.</li>
        </ul>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="We’re adding a browsing agent that can read web pages and access the user’s email. How do you secure it?"
        senior={<p>Add prompt-injection detection, tell the model in the system prompt to ignore instructions in web content, require confirmation before sending emails, and log everything.</p>}
        staff={<>
          <p>This feature has the full trifecta: private data (email), untrusted content (the web), and external communication (sending email, loading URLs). Prompt instructions and detectors lower risk but don’t remove it, so I’d change the <strong>capabilities</strong>.</p>
          <ul>
            <li>Split the browsing session from the email session so no single context has both, or run web content through a quarantined model with no tools.</li>
            <li>Sending is a confirmed action that shows the exact recipient and content.</li>
            <li>Rendered output only allows allowlisted domains, and there is no auto-loading of images.</li>
            <li>Credentials are scoped per task.</li>
          </ul>
          <p>Then red-team it with an injection suite in CI, and monitor blocked actions in production.</p>
        </>}
        followUps={['Users complain about too many confirmations. What now?', 'How do you handle MCP servers from third parties?', 'How would you detect an attack in progress?']}
      />
      <InterviewQuestion
        q="Your RAG assistant answered a question using a document the user isn’t allowed to see. What went wrong and how do you fix it?"
        senior={<p>The vector search didn’t check permissions. Add access checks to the retrieval step and re-index with ACL metadata.</p>}
        staff={<>
          <p>Authorization happened too late, or not at all. The fix is to <strong>enforce permissions at retrieval time</strong> with the caller’s identity. Filter candidates by ACL in the index (pre-filtering) or re-check against the source system before the chunk enters the prompt. Never rely on the model to withhold what it has already seen.</p>
          <p>Also handle ACL <em>changes</em>: permission updates must propagate to the index quickly, and caches must be scoped per user or per ACL set. I’d add a permission-leak eval (users who must not see document X ask about X) as a release gate, and audit logs of retrieved document IDs per answer.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'LLMs mix instructions and data in one channel, so any text they read can try to steer them.',
        'Indirect prompt injection plus tools is the core agent risk. Break the trifecta of private data, untrusted content, and external communication.',
        'Enforce security in code: least-privilege tools, confirmations, output encoding, permission-aware retrieval.',
        'Treat model output as untrusted input to HTML, SQL, shells, and other systems.',
        'Red-team continuously and gate releases on an attack suite; detectors are a layer, not the defense.',
      ]} />
    </>
  )
}
