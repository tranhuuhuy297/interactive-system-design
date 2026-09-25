import {
  Callout, CodeBlock, CompareTable, FlowDiagram, H2, InterviewQuestion, KeyTakeaways, MentalModel, References, SideBySide,
  Term, TLDR,
} from '../components/ui'
import {
  Cpu, Filter, FlaskConical, GitMerge, GraduationCap, Layers, PenLine, Scale, Sparkles, ThumbsUp,
} from 'lucide-react'
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
      <TLDR items={[
        'Try prompting first, then RAG, then fine-tuning. Climb only when evals show the lower rung is exhausted.',
        'Fine-tuning changes how a model behaves. RAG changes what it knows.',
        'LoRA trains a tiny add-on instead of the whole model. QLoRA fits big models on one GPU.',
        'Distillation copies a big model’s skill into a cheap small one for narrow, high-volume tasks.',
        'A tuned model is a maintained asset: retrain and re-evaluate on every base upgrade.',
      ]} />
      <MentalModel id="ai-fine-tuning" />
      <p>
        “Should we fine-tune?” is one of the most common and most over-answered questions in LLM engineering.{' '}
        <Term def="Continuing to train a pretrained model on your own examples so its weights change.">Fine-tuning</Term>{' '}
        changes <strong>how</strong> a model behaves far more reliably than <strong>what</strong> it knows.
      </p>
      <p>
        The staff-level skill is picking the cheapest intervention that closes the measured gap. It also means knowing
        what you sign up to maintain afterwards.
      </p>

      <H2 id="ladder">The ladder of interventions</H2>
      <p>Each rung costs more to build and maintain than the one before. Climb only when you must.</p>
      <FlowDiagram steps={[
        { label: 'Prompting', sub: 'instructions, examples, schema' },
        { label: 'RAG', sub: 'knowledge at query time' },
        { label: 'Fine-tuning', sub: 'behavior in the weights' },
        { label: 'Continued pretraining', sub: 'new domain language' },
      ]} caption="Climb only when the rung below is measured and exhausted. Cost and maintenance grow at every step." />

      <H2 id="good-bad">What fine-tuning is good (and bad) at</H2>
      <p>Fine-tuning is like training an employee’s habits. It works for style and routine, not for memorizing a changing handbook.</p>
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
        Full fine-tuning updates every weight. Its{' '}
        <Term def="Extra per-parameter values the training algorithm (e.g. Adam) keeps, often several times the model’s size.">optimizer state</Term>{' '}
        alone dwarfs the model.
      </p>
      <p>
        <strong>LoRA</strong> freezes the base and learns a{' '}
        <Term def="A matrix expressed as the product of two thin matrices, so it has far fewer numbers to learn.">low-rank</Term>{' '}
        update for selected matrices: <code>W′ = W + B·A</code>, with{' '}
        <Term def="The inner dimension of the two thin matrices; smaller rank means fewer trainable parameters.">rank</Term>{' '}
        <code>r</code> of 8–64. That is a tiny fraction of the parameters. You can merge the update into <code>W</code>{' '}
        for serving, or keep it as a separate{' '}<Term def="The small file of LoRA weights that sits on top of a shared base model.">adapter</Term>.
      </p>
      <p>
        <strong>QLoRA</strong> goes further. It keeps the frozen base in 4-bit precision while training the adapters.
        That puts large models within reach of a single GPU. Use the calculator to see the parameter counts.
      </p>
      <AiFtLoraCalculatorDemo />
      <CodeBlock lang="ts" title="LoRA, conceptually" code={`
// Frozen W: d_out × d_in. Trainable A: r × d_in (random init), B: d_out × r (zero init → starts as a no-op).
function loraForward(x: Vec, W: Mat, A: Mat, B: Mat, alpha: number, r: number): Vec {
  return add(matmul(W, x), scale(matmul(B, matmul(A, x)), alpha / r))
}`} />

      <H2 id="distillation">Distillation: big-model quality at small-model prices</H2>
      <p>
        When a{' '}<Term def="One of the most capable, usually largest, models available.">frontier model</Term>{' '}
        already solves the task, use it as a teacher. Generate outputs for a broad, realistic input set. Filter or
        human-review them. Then fine-tune a smaller student model on those pairs.
      </p>
      <FlowDiagram caption="Teacher once, student forever: pay frontier prices only while building the dataset"
        steps={[
          { label: 'Teacher answers', sub: 'frontier model, broad inputs', icon: Sparkles },
          { label: 'Filter & review', sub: 'drop wrong or unsafe outputs', icon: Filter },
          { label: 'Train student', sub: 'smaller, faster model', icon: GraduationCap },
          { label: 'Evaluate', sub: 'held-out data, not teacher examples', icon: FlaskConical },
        ]} />
      <p>
        Classic distillation matches the teacher’s full probability distribution. With API-only teachers you usually
        train on sampled outputs. Check the provider’s terms of use on training with model outputs. Evaluate the student
        on held-out data, not on the teacher’s examples.
      </p>

      <H2 id="preferences">Preference tuning: RLHF and DPO</H2>
      <p>
        Sometimes you can’t write the perfect answer, but you can tell which of two answers is better. Preference
        tuning learns from those judgments.
      </p>
      <SideBySide caption="Pick by what your data looks like"
        panels={[
          { title: 'SFT', icon: PenLine, points: ['Data: input → ideal output', 'Standard next-token loss', '+ Low complexity'], verdict: 'You can write good targets' },
          { title: 'RLHF', icon: Scale, points: ['Data: pairwise preferences + a reward model', 'Reinforcement learning against the reward model', '- High complexity (reward model, RL stability)'], verdict: 'At scale, with a mature pipeline' },
          { title: 'DPO', icon: ThumbsUp, tone: 'good', points: ['Data: pairwise preferences only', 'Direct loss on preferred vs rejected', '+ Moderate complexity'], verdict: 'Judging is easier than writing' },
        ]} />

      <H2 id="data">Data and evaluation make or break it</H2>
      <p>The model learns exactly what the data shows, including its mistakes. Most fine-tuning failures are data failures.</p>
      <ul>
        <li><strong>Quality over quantity.</strong> A few hundred clean, consistent examples often beat thousands of noisy ones. Inconsistent labels teach inconsistency.</li>
        <li><strong>Hold out an eval set</strong> before training and deduplicate it against training data to avoid contamination.</li>
        <li><strong>Check for regressions</strong> on general capabilities and safety behavior, not just the target task. Narrow tuning can erode both.</li>
        <li><strong>Match production inputs.</strong> Train on the same prompt template, context format, and edge cases the model will see live.</li>
      </ul>

      <H2 id="serving">Serving and maintenance implications</H2>
      <p>Training is the easy part. Serving and re-training the model for years is the real cost.</p>
      <SideBySide
        panels={[
          { title: 'Merge into the weights', icon: GitMerge, points: ['+ Zero serving overhead', '- One deployment per tuned model'] },
          { title: 'Keep as an adapter', icon: Layers, tone: 'good', points: ['+ One base serves many tenants (multi-LoRA)', '- Small per-request overhead'] },
          { title: 'Either way', icon: Cpu, tone: 'bad', points: ['- Base upgrade invalidates the tune', '- Retrain and re-evaluate every time'] },
        ]} />
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
