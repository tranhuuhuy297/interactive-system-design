import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, References,
} from '../components/ui'
import type { Reference } from '../components/ui'
import { AiFtDecisionWizardDemo } from './demos/ai-ft-decision-wizard-demo'
import { AiFtLoraCalculatorDemo } from './demos/ai-ft-lora-calculator-demo'

const REFS: Reference[] = [
  { title: 'LoRA: Low-Rank Adaptation of Large Language Models', source: 'Hu et al.', year: 2021, url: 'https://arxiv.org/abs/2106.09685', kind: 'paper' },
  { title: 'QLoRA: Efficient Finetuning of Quantized LLMs', source: 'Dettmers et al.', year: 2023, url: 'https://arxiv.org/abs/2305.14314', kind: 'paper' },
  { title: 'Distilling the Knowledge in a Neural Network', source: 'Hinton, Vinyals & Dean', year: 2015, url: 'https://arxiv.org/abs/1503.02531', kind: 'paper' },
  { title: 'Training language models to follow instructions with human feedback (InstructGPT)', source: 'Ouyang et al.', year: 2022, url: 'https://arxiv.org/abs/2203.02155', kind: 'paper', note: 'SFT → reward model → RLHF' },
  { title: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model', source: 'Rafailov et al.', year: 2023, url: 'https://arxiv.org/abs/2305.18290', kind: 'paper' },
  { title: 'The Llama 3 Herd of Models', source: 'Llama Team, Meta', year: 2024, url: 'https://arxiv.org/abs/2407.21783', kind: 'paper', note: 'Model shapes used in the calculator' },
]

export default function FineTuningDecisionsChapter() {
  return (
    <>
      <p>
        “Should we fine-tune?” is one of the most common and most over-answered questions in LLM engineering. Fine-tuning
        changes <strong>how</strong> a model behaves far more reliably than <strong>what</strong> it knows. The staff-level
        skill is picking the cheapest intervention that closes the measured gap, and knowing what you sign up to maintain
        afterwards.
      </p>

      <H2 id="ladder">The ladder of interventions</H2>
      <FlowDiagram steps={[
        { label: 'Prompting', sub: 'instructions, examples, schema' },
        { label: 'RAG', sub: 'knowledge at query time' },
        { label: 'Fine-tuning', sub: 'behavior in the weights' },
        { label: 'Continued pretraining', sub: 'new domain language' },
      ]} caption="Climb only when the rung below is measured and exhausted. Cost and maintenance grow at every step." />

      <H2 id="good-bad">What fine-tuning is good (and bad) at</H2>
      <CompareTable
        columns={['Good fit', 'Poor fit']}
        rows={[
          { label: 'Output', cells: ['Strict formats, house style, tone, labels', 'Open-ended facts the model must recall'] },
          { label: 'Knowledge', cells: ['Domain phrasing and jargon', 'Fresh or frequently changing facts (use RAG)'] },
          { label: 'Economics', cells: ['Distilling a big model’s skill into a small, fast one', 'Low-volume tasks where a prompt already works'] },
          { label: 'Control', cells: ['Shorter prompts: behavior moves into weights', 'Anything needing citations or per-user permissions'] },
        ]}
      />
      <AiFtDecisionWizardDemo />

      <H2 id="lora">Full fine-tuning vs LoRA vs QLoRA</H2>
      <p>
        Full fine-tuning updates every weight, so optimizer state alone dwarfs the model. <strong>LoRA</strong> freezes the base
        and learns a low-rank update for selected matrices, <code>W′ = W + B·A</code>, with rank <code>r</code> of 8–64. That is a
        tiny fraction of the parameters. The update can be merged into <code>W</code> for serving, or kept as a separate adapter.
        <strong> QLoRA</strong> goes further: it keeps the frozen base in 4-bit precision while training the adapters, putting
        large models within reach of a single GPU.
      </p>
      <AiFtLoraCalculatorDemo />
      <CodeBlock lang="ts" title="LoRA, conceptually" code={`
// Frozen W: d_out × d_in. Trainable A: r × d_in (random init), B: d_out × r (zero init → starts as a no-op).
function loraForward(x: Vec, W: Mat, A: Mat, B: Mat, alpha: number, r: number): Vec {
  return add(matmul(W, x), scale(matmul(B, matmul(A, x)), alpha / r))
}`} />

      <H2 id="distillation">Distillation: big-model quality at small-model prices</H2>
      <p>
        When a frontier model already solves the task, generate outputs for a broad, realistic input set. Filter or
        human-review them, then fine-tune a smaller model on those pairs. Classic distillation matches the teacher’s full
        probability distribution; with API-only teachers you usually train on sampled outputs. Watch the provider’s terms of
        use regarding training on model outputs, and evaluate the student on held-out data, not the teacher’s examples.
      </p>

      <H2 id="preferences">Preference tuning: RLHF and DPO</H2>
      <CompareTable
        columns={['Supervised fine-tuning (SFT)', 'RLHF', 'DPO']}
        rows={[
          { label: 'Data', cells: ['Input → ideal output', 'Pairwise preferences + a reward model', 'Pairwise preferences only'] },
          { label: 'Training', cells: ['Standard next-token loss', 'Reinforcement learning against the reward model', 'Direct loss on preferred vs rejected'] },
          { label: 'Complexity', cells: ['Low', 'High (reward model, RL stability)', 'Moderate'] },
          { label: 'Use when', cells: ['You can write good targets', 'At scale, with a mature pipeline', 'Judging is easier than writing'] },
        ]}
      />

      <H2 id="data">Data and evaluation make or break it</H2>
      <ul>
        <li><strong>Quality over quantity.</strong> A few hundred clean, consistent examples often beat thousands of noisy ones. Inconsistent labels teach inconsistency.</li>
        <li><strong>Hold out an eval set</strong> before training and deduplicate it against training data to avoid contamination.</li>
        <li><strong>Check for regressions</strong> on general capabilities and safety behavior, not just the target task. Narrow tuning can erode both.</li>
        <li><strong>Match production inputs.</strong> Train on the same prompt template, context format, and edge cases the model will see live.</li>
      </ul>

      <H2 id="serving">Serving and maintenance implications</H2>
      <ul>
        <li><strong>Merged vs adapter:</strong> merging gives zero serving overhead; keeping adapters lets one base model serve many tenants or tasks (multi-LoRA). See <a href="#/ai-serving">Serving Stacks &amp; Model Routing</a> and the <a href="#/llm-serving">LLM Inference Platform</a> case study.</li>
        <li><strong>Base model upgrades</strong> invalidate adapters. You retrain and re-evaluate on each new base, so budget for it.</li>
        <li><strong>Version everything</strong>: dataset, base model, hyperparameters, adapter. Roll out behind the same eval gates and canaries as prompts.</li>
      </ul>

      <Callout kind="staff">
        <p>A staff answer frames fine-tuning as an ongoing <strong>product line</strong>, not a one-off experiment. It needs:</p>
        <ul>
          <li>a data flywheel from production feedback</li>
          <li>an eval suite that gates releases</li>
          <li>a retraining plan for base model upgrades</li>
          <li>a cost comparison against “bigger model + better prompt” that is re-run every quarter as model prices fall</li>
        </ul>
        <p>Often the winning move is to <em>not</em> fine-tune yet, and to invest in evals that make the decision obvious later.</p>
      </Callout>

      <H2 id="interview">Interview drill</H2>
      <InterviewQuestion
        q="A product team wants to fine-tune a model on the company wiki so the assistant “knows our docs”. What do you advise?"
        senior={<p>Use RAG instead, because fine-tuning doesn’t reliably teach facts and the wiki changes often. Fine-tuning could still help with tone.</p>}
        staff={<>
          <p>I’d steer to <strong>RAG for knowledge</strong>. Facts in weights go stale, can’t be cited, can’t respect page-level permissions, and hallucinate with confidence when recall is fuzzy.</p>
          <p>Then I’d ask what gap they actually observed. If answers are right but formatted badly, fix the prompt first. If the model misreads internal jargon, a small LoRA on terminology can complement retrieval.</p>
          <p>I’d agree on an eval set of real employee questions before either path, so we can compare RAG vs RAG + fine-tune on data rather than intuition. See <a href="#/ai-rag">RAG Systems</a>.</p>
        </>}
        followUps={['How would you measure “knows our docs”?', 'What if the wiki is 80% outdated?']}
      />
      <InterviewQuestion
        q="Your LLM feature costs too much at scale. When is fine-tuning a smaller model the right fix?"
        senior={<p>When the task is narrow and repetitive. We can distill the large model into a smaller model with LoRA and serve it ourselves.</p>}
        staff={<>
          <p>When four things hold:</p>
          <ul>
            <li>the task is narrow and stable</li>
            <li>volume is high enough that per-token savings outweigh training, evaluation, and serving ops</li>
            <li>we have an eval set proving the small model meets the bar</li>
            <li>we can keep up with retraining</li>
          </ul>
          <p>Before that I’d exhaust cheaper levers: prompt compression, caching, routing easy requests to a small model and hard ones to the large one, and batch APIs. I’d model total cost of ownership, including GPUs at realistic utilization and on-call. Self-hosting a small model at 20% utilization is often more expensive than an API.</p>
        </>}
      />

      <H2 id="references">References &amp; further reading</H2>
      <References items={REFS} />

      <KeyTakeaways items={[
        'Climb the ladder: prompting → RAG → fine-tuning → pretraining, each step justified by evals.',
        'Fine-tuning shapes behavior and format; retrieval supplies facts.',
        'LoRA trains a tiny fraction of parameters; QLoRA puts large models on a single GPU.',
        'Distillation trades a training project for large, recurring inference savings on narrow tasks.',
        'A tuned model is a maintained asset: data, evals, and retraining on every base upgrade.',
      ]} />
    </>
  )
}
