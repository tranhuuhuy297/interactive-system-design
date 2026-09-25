import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, References, Term, TLDR,
} from '../components/ui'
import type { Reference } from '../components/ui'
import { AiEvalHarnessDemo } from './demos/ai-eval-harness-demo'
import { AiEvalJudgeBiasDemo } from './demos/ai-eval-judge-bias-demo'

const REFS: Reference[] = [
  { title: 'Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena', source: 'Zheng et al.', year: 2023, url: 'https://arxiv.org/abs/2306.05685', kind: 'paper', note: 'Judge agreement with humans; position, verbosity, and self-enhancement biases' },
  { title: 'Large Language Models are not Fair Evaluators', source: 'Wang et al.', year: 2023, url: 'https://arxiv.org/abs/2305.17926', kind: 'paper', note: 'Position bias and swap-based calibration' },
  { title: 'Ragas: Automated Evaluation of Retrieval Augmented Generation', source: 'Es et al.', year: 2023, url: 'https://arxiv.org/abs/2309.15217', kind: 'paper', note: 'Faithfulness, answer relevance, context metrics' },
  { title: 'Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference', source: 'Chiang et al.', year: 2024, url: 'https://arxiv.org/abs/2403.04132', kind: 'paper' },
  { title: 'An Introduction to the Bootstrap', source: 'B. Efron & R. Tibshirani (Chapman & Hall)', year: 1993, kind: 'book' },
  { title: 'Trustworthy Online Controlled Experiments', source: 'R. Kohavi, D. Tang & Y. Xu (Cambridge University Press)', year: 2020, kind: 'book', note: 'A/B testing practice and guardrail metrics' },
]

export default function EvaluationChapter() {
  return (
    <>
      <TLDR items={[
        'For LLM features, the eval suite is the spec. It defines what “good” means.',
        'Use the cheapest metric that catches the failure. Save LLM judges for what code can’t check.',
        'LLM judges are biased: run both answer orders and calibrate against humans.',
        'Small eval sets are noisy. Compare versions on the same items and report an interval.',
        'Gate changes in CI, then confirm with a canary and live metrics.',
      ]} />
      <p>
        In traditional software, tests check code against a spec. With LLMs, the{' '}
        <Term def="Evaluation: a set of test inputs plus a way to score outputs, run on every change.">eval</Term>{' '}
        suite <strong>is</strong> the spec. It is the only precise statement of what “good” means for a probabilistic
        system.
      </p>
      <p>
        Teams with strong evals ship prompt, model, and retrieval changes weekly. Teams without them freeze, or ship
        regressions and learn from users.
      </p>

      <H2 id="spec">Evals are the product spec</H2>
      <p>Without evals, every change is a guess. With them, it is a measurement.</p>
      <ul>
        <li>Every model upgrade, prompt edit, or retrieval tweak is a behavior change across thousands of inputs. You need a way to see all of it at once.</li>
        <li>Evals turn debates (“the new prompt feels better”) into numbers with uncertainty.</li>
        <li>They make vendor and model choices reversible: you can swap models when a cheaper one passes the same suite.</li>
      </ul>

      <H2 id="datasets">Building the eval set</H2>
      <p>
        An eval is only as good as its examples. A{' '}
        <Term def="A curated set of inputs with known-good answers or labels, used as the fixed benchmark.">golden set</Term>{' '}
        usually mixes four sources.
      </p>
      <CompareTable
        columns={['Source', 'Strength', 'Watch out for']}
        rows={[
          { label: 'Production samples', cells: ['Real distribution, real phrasing', 'PII handling; skew toward easy cases'] },
          { label: 'Failure reports', cells: ['Targets known weaknesses', 'Over-fitting the prompt to a few anecdotes'] },
          { label: 'Synthetic generation', cells: ['Cheap coverage of edge cases', 'Must be human-reviewed; can be unrealistic'] },
          { label: 'Expert-written', cells: ['High-quality references', 'Expensive; small'] },
        ]}
      />
      <p>
        Split results by segment (language, customer tier, task type) and report a score per{' '}
        <Term def="A subset of the eval set, such as one language or one customer tier.">slice</Term>.
        An average can hide a collapse in one segment.
      </p>
      <p>
        Version the dataset. Keep a{' '}<Term def="Examples nobody looks at while tuning, so they give an honest final check.">held-out</Term>{' '}
        slice nobody tunes against. Add every production incident as a new case.
      </p>

      <H2 id="metrics">Choosing metrics</H2>
      <p>Metrics range from cheap and strict to flexible and costly. Pick per failure type.</p>
      <CompareTable
        columns={['Type', 'Examples', 'Cost / reliability']}
        rows={[
          { label: 'Deterministic', cells: ['Exact match, schema valid, unit tests pass, regex, citations resolve', 'Cheap, reliable, narrow'] },
          { label: 'Reference-based', cells: ['Similarity to a gold answer, key facts present', 'Cheap; penalizes valid alternative phrasings'] },
          { label: 'Model-graded', cells: ['LLM judge with a rubric; pairwise preference', 'Flexible; needs calibration against humans'] },
          { label: 'RAG-specific', cells: ['Context precision/recall, faithfulness to context, answer relevance', 'Separates retrieval from generation failures'] },
          { label: 'Human', cells: ['Expert review, side-by-side ratings', 'Gold standard; slow and costly'] },
        ]}
      />
      <Callout kind="tip">
        Prefer the cheapest metric that captures the failure. If “valid JSON with a known label” is the requirement, a
        deterministic check beats any judge. Reserve LLM judges for qualities code can’t check.
      </Callout>

      <H2 id="judges">LLM-as-judge: useful, biased, calibratable</H2>
      <p>
        An{' '}<Term def="Using a strong model with a scoring rubric to grade another model’s outputs.">LLM judge</Term>{' '}
        grades outputs so humans don’t have to. Strong models agree with human raters surprisingly often on many tasks.
        But they have systematic biases:
      </p>
      <ul>
        <li>They favor the answer in a particular <strong>position</strong> (first or second).</li>
        <li>They prefer <strong>longer</strong> answers.</li>
        <li>They can favor outputs resembling <strong>their own</strong> style.</li>
      </ul>
      <p>
        Mitigate with specific rubrics, pairwise comparisons run in both orders, and length-controlled comparisons.
        Keep a regularly refreshed human-labeled sample to measure judge agreement. The demo shows the swap trick.
      </p>
      <AiEvalJudgeBiasDemo />

      <H2 id="statistics">Is the difference real? Sample size and uncertainty</H2>
      <p>
        A score on 100 examples is a noisy estimate. At a 70% pass rate, a single score on 100 items carries roughly ±9
        points of 95% uncertainty.
      </p>
      <p>
        Compare versions <strong>paired on the same items</strong> and report an interval, not just two numbers. A{' '}
        <Term def="Estimate uncertainty by resampling your data with replacement many times and recomputing the metric.">bootstrap</Term>{' '}
        (resample items with replacement, recompute the difference, take percentiles) needs no distributional
        assumptions.
      </p>
      <AiEvalHarnessDemo />
      <Callout kind="warn">
        Trying 20 prompt variants and shipping the best one on a small set is a multiple-comparisons trap. The “winner”
        is partly luck. Confirm finalists on the held-out slice.
      </Callout>

      <H2 id="ci-gates">Regression gates in CI</H2>
      <p>Evals pay off when they run automatically on every change and can block a bad release.</p>
      <FlowDiagram steps={[
        { label: 'Change', sub: 'prompt, model, retriever, code' },
        { label: 'Offline suite', sub: 'deterministic + judge metrics' },
        { label: 'Gate', sub: 'per-slice thresholds vs baseline' },
        { label: 'Canary', sub: 'small % of live traffic' },
        { label: 'Rollout', sub: 'with online guardrails' },
      ]} />
      <CodeBlock lang="ts" title="eval gate (illustrative config)" code={`
export const gate = {
  suite: 'support-assistant@v12',
  baseline: 'prod',
  checks: [
    { metric: 'schema_valid', min: 0.995 },                        // hard floor
    { metric: 'answer_correct', maxDropVsBaseline: 0.01, ci: 0.95 },  // paired, per slice
    { metric: 'faithfulness', maxDropVsBaseline: 0.02, slices: ['enterprise', 'non-english'] },
    { metric: 'p95_latency_ms', max: 2500 },
    { metric: 'cost_per_1k_requests_usd', maxIncrease: 0.10 },
  ],
}`} />

      <H2 id="online">Online evaluation</H2>
      <p>Offline evals decide whether to try a change. Live traffic decides whether to keep it.</p>
      <ul>
        <li><strong>A/B tests</strong> on product outcomes (resolution rate, retention), with guardrail metrics: latency, cost, safety flags, complaint rate.</li>
        <li><strong>Implicit feedback</strong>: regenerate clicks, copy events, edits to drafts, and abandonment are cheaper and more plentiful than thumbs ratings.</li>
        <li><strong>Sampled production scoring</strong>: run judges on a sample of real traces daily to catch drift from new user behavior or silent provider changes.</li>
        <li><strong>Shadow mode</strong>: run a candidate model on live inputs without showing users, then compare offline.</li>
      </ul>

      <H2 id="tracing">Traces make failures debuggable</H2>
      <p>
        For RAG and agent systems, record every step of a request: rewritten query, retrieved chunk IDs and scores,
        final prompt, tool calls, model output, latency, and tokens.
      </p>
      <p>
        When an eval case fails, the{' '}<Term def="A step-by-step record of everything that happened for one request.">trace</Term>{' '}
        shows whether retrieval, the prompt, the model, or a tool was at fault. Without it, teams guess. See{' '}
        <a href="#/ai-rag">RAG Systems</a> and <a href="#/ai-agents">Agents &amp; Tool Use</a>.
      </p>

      <Callout kind="staff">
        <p>Staff engineers make evals a <strong>shared platform</strong>, not a notebook:</p>
        <ul>
          <li>versioned datasets with owners</li>
          <li>a harness every team can plug into</li>
          <li>per-slice dashboards</li>
          <li>judge calibration tracked over time</li>
          <li>CI gates that block regressions automatically</li>
        </ul>
        <p>They also budget human labeling as ongoing work, because eval sets decay as the product and users change.</p>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="A new model version scores 3 points higher on your 150-example eval. Should you ship it?"
        senior={<p>Probably not on that alone. 150 examples is small, so run a larger eval or check whether the difference is statistically significant, and look at latency and cost too.</p>}
        staff={<>
          <p>I’d want a <strong>paired interval</strong> on the difference. At 150 items a 3-point gain is often inside the noise. Then per-slice results: a +3 average can hide a −10 on a key segment.</p>
          <p>Then everything the average doesn’t capture:</p>
          <ul>
            <li>latency and cost per request</li>
            <li>safety and refusal behavior</li>
            <li>output length (judges reward verbosity)</li>
            <li>behavior on the held-out slice nobody tuned against</li>
          </ul>
          <p>If it still looks good, ship via canary with online guardrails. The offline suite decides whether we <em>try</em> it; production metrics decide whether we <em>keep</em> it.</p>
        </>}
        followUps={['How many examples would you need to detect a 3-point change?', 'What if human raters and the LLM judge disagree?']}
      />
      <InterviewQuestion
        q="How would you evaluate a customer-support RAG assistant before launch?"
        senior={<p>Build a golden set of questions and answers, measure answer correctness with an LLM judge, and have support agents review a sample.</p>}
        staff={<>
          <p>I’d evaluate in layers so failures are attributable:</p>
          <ul>
            <li><strong>Retrieval:</strong> recall@k against labeled relevant documents.</li>
            <li><strong>Generation:</strong> faithfulness to retrieved context, correctness against references, citation validity checked in code.</li>
            <li><strong>Behavior:</strong> correctly saying “I don’t know”, escalation triggers, tone, and policy compliance.</li>
          </ul>
          <p>The set would be drawn from historical tickets, stratified by product area and language, with hard cases from past escalations. Judges get calibrated against agent ratings on a sample. Launch goes through a shadow period comparing suggested vs actual agent replies, then a gated rollout measuring resolution rate and escalations.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'The eval suite is the spec: every model, prompt, or retrieval change is judged against it.',
        'Use the cheapest reliable metric; reserve LLM judges for what code can’t check.',
        'Judges are biased (position, length, self-preference): run both orders, use rubrics, calibrate against humans.',
        'Report paired differences with intervals, per slice. Small sets make small gains indistinguishable from noise.',
        'Gate releases in CI, then confirm with canaries and online guardrail metrics.',
      ]} />
    </>
  )
}
