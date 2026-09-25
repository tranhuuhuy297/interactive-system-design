import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, References, Term, TLDR,
} from '../components/ui'
import type { Reference } from '../components/ui'
import { AiPromptConstrainedDecodingDemo } from './demos/ai-prompt-constrained-decoding-demo'

const REFS: Reference[] = [
  { title: 'Language Models are Few-Shot Learners', source: 'Brown et al. (OpenAI)', year: 2020, url: 'https://arxiv.org/abs/2005.14165', kind: 'paper', note: 'In-context (few-shot) learning' },
  { title: 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models', source: 'Wei et al. (Google)', year: 2022, url: 'https://arxiv.org/abs/2201.11903', kind: 'paper' },
  { title: 'Efficient Guided Generation for Large Language Models', source: 'Willard & Louf', year: 2023, url: 'https://arxiv.org/abs/2307.09702', kind: 'paper', note: 'Compiling regex / JSON schema into token masks (Outlines)' },
  { title: 'Structured Outputs guide', source: 'OpenAI API docs', url: 'https://platform.openai.com/docs/guides/structured-outputs', kind: 'docs' },
  { title: 'Tool use with Claude', source: 'Anthropic docs', url: 'https://docs.anthropic.com/en/docs/build-with-claude/tool-use', kind: 'docs' },
  { title: 'JSON Schema', source: 'json-schema.org', url: 'https://json-schema.org/', kind: 'docs' },
]

export default function PromptingStructuredOutputChapter() {
  return (
    <>
      <TLDR items={[
        'Treat prompts as versioned API contracts. Log the version with every call.',
        'Put durable rules in the system message. Wrap untrusted text in clear delimiters.',
        'Schema-constrained decoding guarantees the output shape, not that it is correct.',
        'A tool call from a model is a request, not a permission. Authorize it in code.',
        'Temperature 0 is not deterministic. Pin versions and bound retries.',
      ]} />
      <p>
        In a production LLM system, the prompt is not a clever sentence. It is an <strong>interface</strong>: the contract
        between your application and a probabilistic component you don’t control.
      </p>
      <p>
        This chapter treats prompts like any API: versioned, tested, typed at the boundary, and designed to fail in
        predictable ways.
      </p>

      <H2 id="contracts">Prompts are versioned contracts</H2>
      <p>A prompt has inputs, outputs, and consumers, just like an endpoint. Manage it the same way.</p>
      <ul>
        <li><strong>Inputs</strong>: instructions, context (retrieved documents, user data), examples, tool definitions.</li>
        <li><strong>Outputs</strong>: free text for humans, or <em>structured data</em> for code. Code is the demanding consumer.</li>
        <li><strong>Change management</strong>: a one-word prompt edit can shift behavior across thousands of cases. Store prompts in a registry with versions, and ship changes behind the same eval gates as code (see <a href="#/ai-evals">Evaluating LLM Systems</a>).</li>
      </ul>
      <Callout kind="pitfall">
        Prompts scattered as string literals across services make it impossible to answer “which prompt produced this bad
        output?”. Log the prompt <em>version</em> and model ID with every call.
      </Callout>

      <H2 id="anatomy">Anatomy of a request: roles and messages</H2>
      <p>
        Chat-style APIs separate four kinds of message: <strong>system</strong> instructions (policy, persona, output
        rules), <strong>user</strong> turns, prior <strong>assistant</strong> turns, and <strong>tool</strong> results.
      </p>
      <p>
        Keep durable rules in the system message. Delimit untrusted content clearly. Models weigh instructions by
        position and role, so structure matters.
      </p>
      <CodeBlock lang="ts" title="a templated request" code={`
const request = {
  model: MODEL_ID,                       // pinned, never "latest" in production
  messages: [
    { role: 'system', content: SUPPORT_TRIAGE_V7 },   // from the prompt registry
    { role: 'user', content: [
        'Classify the ticket below.',
        '<ticket>', escapeTags(ticket.body), '</ticket>',  // untrusted data, delimited
    ].join('\\n') },
  ],
  temperature: 0,
  response_format: { type: 'json_schema', json_schema: TRIAGE_SCHEMA },
}`} />

      <H2 id="few-shot">Few-shot examples and templating</H2>
      <p>
        Large models learn a task from a handful of examples placed in the prompt. This is called{' '}
        <Term def="The model picks up a task from examples in the prompt, with no weight updates.">in-context learning</Term>.
      </p>
      <p>
        Examples are the most reliable way to pin down format and edge cases. But they cost tokens on every call, and
        the model can copy their surface features too closely.
      </p>
      <CompareTable
        columns={['Zero-shot', 'Few-shot', 'Dynamic few-shot']}
        rows={[
          { label: 'How', cells: ['Instructions only', 'Fixed examples in the template', 'Retrieve the k most similar labeled examples per request'] },
          { label: 'Cost', cells: ['Lowest', '+ tokens every call', '+ tokens + a retrieval hop'] },
          { label: 'Best for', cells: ['Simple, well-known tasks', 'Strict formats, tricky edge cases', 'Long-tail inputs with a labeled pool'] },
          { label: 'Risk', cells: ['Ambiguous output format', 'Model copies example content', 'Retrieval quality becomes prompt quality'] },
        ]}
      />
      <p>
        Asking the model to reason step by step before answering (
        <Term def="Prompting the model to write out intermediate reasoning before its final answer.">chain-of-thought</Term>)
        improves multi-step tasks. It also adds output tokens and latency. If code consumes the result, keep the
        reasoning in a separate field or a separate call.
      </p>

      <H2 id="structured-output">Structured output: three levels of guarantee</H2>
      <p>When code reads the output, “usually valid” isn’t good enough. You can buy three levels of guarantee.</p>
      <CompareTable
        columns={['Ask in the prompt', 'JSON mode', 'Schema-constrained decoding']}
        rows={[
          { label: 'Mechanism', cells: ['“Respond with JSON like …”', 'Decoder restricted to syntactically valid JSON', 'Decoder restricted to your exact schema'] },
          { label: 'Parses?', cells: ['Usually', 'Yes', 'Yes'] },
          { label: 'Matches schema?', cells: ['Usually', 'Not guaranteed (keys, enums, types)', 'Yes, for the supported schema subset'] },
          { label: 'Semantically right?', cells: ['Not guaranteed', 'Not guaranteed', 'Still not guaranteed'] },
        ]}
      />
      <Callout kind="warn">
        Schema-valid does not mean correct. A constrained model will happily return <code>{'{"status": "ok"}'}</code> for a
        failed job. Constraints remove parsing failures so your evals can focus on the failures that matter.
      </Callout>

      <H2 id="constrained-decoding">How constrained decoding works</H2>
      <p>
        At each step the model scores every{' '}
        <Term def="A chunk of text the model reads and writes, often part of a word. A model has a fixed vocabulary of tokens.">token</Term>{' '}
        in its vocabulary. A constraint engine tracks where the output is within a{' '}
        <Term def="Formal rules for what strings are valid, compiled here from a JSON schema or regex.">grammar</Term>.
        It <strong>masks</strong> every token that could not lead to a valid completion.
      </p>
      <p>
        Sampling then happens only among allowed tokens. It is like autocomplete that greys out keys you’re not allowed
        to press. Precompiling the grammar into an index over the vocabulary keeps per-token overhead small.
      </p>
      <AiPromptConstrainedDecodingDemo />

      <H2 id="function-calling">Function calling is an API you expose to a model</H2>
      <p>
        With tool use, you describe functions: name, purpose, and JSON-schema parameters. The model responds with a
        structured call. <em>Your code</em> validates it, executes it, and returns the result as a tool message.
        Design the tool surface the way you would a public API.
      </p>
      <CodeBlock lang="json" title="a tool definition" code={`
{
  "name": "refund_order",
  "description": "Refund a delivered order. Only for orders the user owns. Partial refunds need an amount.",
  "input_schema": {
    "type": "object",
    "properties": {
      "order_id": { "type": "string", "pattern": "^ord_[a-z0-9]{12}$" },
      "amount_cents": { "type": "integer", "minimum": 1 },
      "reason": { "type": "string", "enum": ["damaged", "late", "wrong_item", "other"] }
    },
    "required": ["order_id", "reason"]
  }
}`} />
      <ul>
        <li><strong>Authorize in code, not in the prompt.</strong> The model choosing a tool is a request, not a permission.</li>
        <li><strong>Make side-effecting tools{' '}<Term def="Safe to repeat: running it twice has the same effect as running it once.">idempotent</Term></strong> (pass an idempotency key), because agent loops retry.</li>
        <li><strong>Few, well-described tools beat many overlapping ones.</strong> Tool descriptions are prompt text too. See <a href="#/ai-agents">Agents &amp; Tool Use</a>.</li>
      </ul>

      <H2 id="validate-repair">Validate, repair, and budget retries</H2>
      <FlowDiagram steps={[
        { label: 'Generate', sub: 'constrained if possible' },
        { label: 'Validate', sub: 'schema + business rules' },
        { label: 'Repair', sub: 'send errors back once' },
        { label: 'Fallback', sub: 'default, human, or error' },
      ]} caption="Bound the loop: one or two repairs, then a deterministic fallback" />
      <p>
        Check business rules (e.g. “refund ≤ order total”) in code after parsing. One repair turn that returns the
        validator’s error message fixes most slips. Unbounded retries turn a quality problem into a cost and latency
        incident.
      </p>

      <H2 id="determinism">Determinism and its limits</H2>
      <p>
        <Term def="A sampling setting; 0 always picks the most likely token, higher values add randomness.">Temperature</Term>{' '}
        0 selects the most likely token. It does not make a hosted model bit-for-bit reproducible.
      </p>
      <p>
        Batched GPU kernels, floating-point ordering, and silent model updates all introduce drift. Provider seed
        parameters are best-effort. (For how chat products are served at scale, see the{' '}
        <a href="#/ep-chatgpt">ChatGPT episode</a>.) Design for variance:
      </p>
      <ul>
        <li>Pin model versions and log them; re-run evals when the provider announces a change.</li>
        <li>Cache responses keyed by (prompt version, model, normalized input) when repeatability matters.</li>
        <li>For critical classifications, sample several times and take the majority. This trades cost for stability.</li>
      </ul>

      <Callout kind="staff">
        <p>Senior engineers write good prompts. Staff engineers build the <strong>prompt platform</strong>:</p>
        <ul>
          <li>a registry with versions and owners</li>
          <li>typed inputs and outputs at every call site</li>
          <li>eval-gated rollout with canaries</li>
          <li>per-version cost and quality dashboards</li>
          <li>a policy that untrusted text is always delimited and never trusted as instructions</li>
        </ul>
        <p>They also know when <em>not</em> to use an LLM: if a regex or a lookup table solves it, that is cheaper and deterministic.</p>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="Your LLM-powered extraction service returns invalid JSON about 2% of the time and downstream jobs crash. How do you fix it?"
        senior={<p>Use the provider’s JSON mode or structured outputs, add a retry when parsing fails, and validate with a schema library before passing data downstream.</p>}
        staff={<>
          <p>I’d fix it at three layers:</p>
          <ul>
            <li><strong>Generation.</strong> Use schema-constrained decoding so parse failures go to near zero. Check which schema features the provider supports, since unsupported constructs may be ignored.</li>
            <li><strong>Boundary.</strong> A validator enforces schema <em>and</em> business rules, with one repair attempt that feeds the error back. Then comes a deterministic fallback: dead-letter the item for review. Never crash the batch.</li>
            <li><strong>Measurement.</strong> Track invalid-rate, repair-rate, and field-level accuracy per prompt version in evals.</li>
          </ul>
          <p>The 2% parse failures were only the visible symptom. The same traffic probably hides semantically wrong but valid outputs, which only evals catch.</p>
        </>}
        followUps={['What if the provider does not support your schema’s oneOf/recursion?', 'How would you migrate 50 call sites to a prompt registry?', 'When would you self-host a model just for constrained decoding?']}
      />
      <InterviewQuestion
        q="How do you safely let a model call internal APIs such as refunds or account changes?"
        senior={<p>Define tools with strict schemas, validate the arguments, and require user confirmation for sensitive actions.</p>}
        staff={<>
          <p>Treat the model as an <strong>untrusted client</strong>. The tool layer enforces authorization with the end user’s identity, never the model’s claims. It validates arguments, applies per-action limits (amount caps, rate limits), and makes calls idempotent. High-impact actions require explicit human confirmation rendered by <em>our</em> UI, not text the model wrote.</p>
          <p>Every call is logged with prompt version, tool arguments, and outcome for audit. And I assume prompt injection will happen, because retrieved content can contain instructions. The blast radius must be bounded by permissions, not by the prompt. See <a href="#/ai-safety">AI Safety &amp; Security</a>.</p>
        </>}
        followUps={['How do you test tool-use behavior before launch?', 'What changes when the agent can chain five tool calls?']}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Prompts are API contracts: version them, log the version per call, and gate changes on evals.',
        'Delimit untrusted content and keep durable rules in the system message.',
        'Schema-constrained decoding guarantees shape, not truth. Validate business rules in code.',
        'Tool calls are requests from an untrusted client: authorize, validate, and make them idempotent.',
        'Temperature 0 is not determinism. Pin versions, cache, and measure variance.',
      ]} />
    </>
  )
}
