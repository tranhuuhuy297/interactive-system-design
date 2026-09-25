import type { BankQuestion } from './question-bank-data'

/** AI Systems: LLM inference, LLM engineering, and AI product design. */
export const AI_QUESTIONS: BankQuestion[] = [
  {
    id: 'ai-1', category: 'AI Systems', level: 'senior',
    q: 'What is the difference between the prefill and decode phases of LLM inference?',
    senior: 'Prefill processes the whole prompt in one parallel pass and builds the KV cache; it is compute-bound and sets time to first token. Decode then generates one token at a time, re-reading the weights and the growing KV cache on every step; it is memory-bandwidth-bound and sets time per output token.',
    staff: [
      'They stress different hardware limits, so batching and scheduling treat them differently (chunked prefill, or separate prefill and decode pools).',
      'SLOs should be split too: TTFT for responsiveness, TPOT for streaming speed.',
      'Long prompts with short answers (RAG) are prefill-heavy; chat with long answers is decode-heavy. Capacity plans differ.',
    ],
    followUps: ['Why does batching help decode far more than prefill?', 'When would you split prefill and decode onto different GPUs?'],
  },
  {
    id: 'ai-2', category: 'AI Systems', level: 'staff',
    q: 'Estimate the KV cache size for one 8K-token sequence on a 70B-class model with grouped-query attention.',
    senior: 'KV bytes per token = 2 (K and V) × layers × KV heads × head dim × bytes per value. With 80 layers, 8 KV heads, head dim 128, and fp16: 2 × 80 × 8 × 128 × 2 ≈ 320 KiB per token, so about 2.5 GiB for 8K tokens.',
    staff: [
      'The KV cache, not compute, usually caps concurrency: 140 GB of fp16 weights plus a few GiB per long sequence fills even 8 × 80 GB quickly.',
      'Levers: grouped/multi-query attention (fewer KV heads), KV quantization (fp8/int8), paged allocation to avoid fragmentation, and prefix sharing.',
      'Show the formula before the number. Interviewers care that you can re-derive it for any model shape.',
    ],
    followUps: ['How does the answer change without GQA (64 KV heads)?', 'How many such sequences fit next to the weights on 8 × 80 GB?'],
  },
  {
    id: 'ai-3', category: 'AI Systems', level: 'senior',
    q: 'Why does continuous batching increase LLM serving throughput?',
    senior: 'With static batching, the whole batch waits for its longest sequence, leaving slots idle. Continuous (iteration-level) batching admits new requests as soon as any sequence finishes, so GPU slots stay full and throughput rises with little latency cost.',
    staff: [
      'It relies on paged KV memory so sequences of different lengths can join and leave without fragmentation.',
      'The scheduler now trades TTFT for new requests against TPOT for running ones; chunked prefill keeps a long new prompt from stalling everyone.',
      'Admission control on KV memory, not request count, prevents out-of-memory preemption storms.',
    ],
    followUps: ['What happens when the KV cache fills up mid-generation?'],
  },
  {
    id: 'ai-4', category: 'AI Systems', level: 'staff',
    q: 'How does speculative decoding speed up generation without changing the output distribution?',
    senior: 'A small draft model proposes several tokens; the large model verifies them in one forward pass and accepts the longest correct prefix. Because decode is memory-bound, verifying k tokens costs about the same as generating one, so each accepted draft token is nearly free.',
    staff: [
      'The speedup depends on the acceptance rate: good on predictable text such as code and boilerplate, weak on creative sampling.',
      'With the rejection-sampling acceptance rule, outputs follow the large model’s distribution exactly.',
      'It costs extra memory and compute for the draft model and helps latency more than throughput at high batch sizes.',
    ],
    followUps: ['Where does the draft model come from?', 'Why does it help less when the server is fully batched?'],
  },
  {
    id: 'ai-5', category: 'AI Systems', level: 'senior',
    q: 'What are the trade-offs of quantizing an LLM from fp16 to int8 or int4?',
    senior: 'Quantization shrinks weights 2–4×, so the model fits on fewer GPUs and decode reads less memory per token, which speeds it up. The cost is some accuracy loss, usually small at 8 bits and more noticeable at 4 bits, depending on the method and task.',
    staff: [
      'Weight-only quantization mainly helps memory-bound decode; activation quantization (e.g. fp8) also speeds up compute-bound prefill on supporting hardware.',
      'Always measure on your own eval suite: aggregate benchmarks can hide regressions on long context, math, or non-English tasks.',
      'KV cache quantization is a separate lever that increases concurrency.',
    ],
    followUps: ['How would you decide between int4 on 1 GPU and fp8 on 2 GPUs?'],
  },
  {
    id: 'ai-6', category: 'AI Systems', level: 'senior',
    q: 'How would you choose a chunking strategy for a RAG system?',
    senior: 'Split documents into passages of a few hundred tokens with a small overlap, following natural structure (headings, paragraphs, code blocks), and keep the document title and section path on each chunk so it makes sense on its own.',
    staff: [
      'Chunking is a retrieval-quality knob: evaluate it with recall@k on real questions instead of picking a size by feel.',
      'Different content needs different splitters: tables, slides, code, and chat threads all break naive fixed-size splitting.',
      'Store a content hash per chunk so re-indexing only re-embeds what changed.',
    ],
    followUps: ['How do you handle a 300-page PDF with tables?'],
  },
  {
    id: 'ai-7', category: 'AI Systems', level: 'staff',
    q: 'Why combine keyword search, vector search, and a reranker in RAG?',
    senior: 'Keyword search (BM25) finds exact terms like error codes and names; vector search finds paraphrases. Fusing both (e.g. reciprocal rank fusion) improves recall, and a cross-encoder reranker then orders the short list precisely before it goes into the prompt.',
    staff: [
      'Rerankers are too slow for the whole corpus but cheap on ~50 candidates: a classic precision/cost cascade.',
      'Sending fewer, better passages beats stuffing the context, because models use the middle of long contexts less reliably.',
      'Measure each stage separately (retrieval recall vs answer faithfulness) so you fix the right layer.',
    ],
    followUps: ['How would you evaluate retrieval without labeled data?'],
  },
  {
    id: 'ai-8', category: 'AI Systems', level: 'staff',
    q: 'How do you keep a RAG assistant from leaking documents a user is not allowed to see?',
    senior: 'Store each document’s allowed users and groups with its chunks and filter search results by the requesting user’s groups before the LLM sees them.',
    staff: [
      'Filter inside the index, not after the top-k cut; post-filtering avoids leaks but silently destroys recall.',
      'Store group ids and expand the user’s groups at query time with a short TTL, so group changes do not rewrite millions of chunks.',
      'Deletes and revocations need a fast lane with an SLO, and caches must be keyed by the user’s principal set.',
      'Prove it continuously with canary documents and test users that must never see them.',
    ],
    followUps: ['A source only exposes permissions through a slow API. What now?'],
  },
  {
    id: 'ai-9', category: 'AI Systems', level: 'senior',
    q: 'When would you fine-tune a model instead of using RAG or better prompts?',
    senior: 'Use RAG when the model needs knowledge that changes or must be cited. Use prompting for instructions and formats. Fine-tune when you need a consistent behavior, style, or output format the base model does not follow reliably, or to distill a large model’s behavior into a smaller, cheaper one.',
    staff: [
      'Fine-tuning is a poor way to add frequently changing facts: they go stale and cannot be cited or permission-filtered.',
      'Try prompting and RAG first and measure; fine-tune only with a clear eval gap and enough quality data.',
      'Account for the lifecycle cost: data pipelines, retraining when the base model updates, and serving LoRA adapters.',
    ],
    followUps: ['How would LoRA adapters change your serving design?'],
  },
  {
    id: 'ai-10', category: 'AI Systems', level: 'staff',
    q: 'What are the pitfalls of using an LLM as a judge in evaluations?',
    senior: 'LLM judges scale evaluation cheaply, but they can be inconsistent and biased, so their scores should be validated against human labels before you trust them.',
    staff: [
      'Known biases include position (preferring the first answer), verbosity (preferring longer answers), and self-preference for outputs from the same model family.',
      'Mitigations: swap answer order, use rubrics with specific criteria, prefer pairwise comparisons, and track agreement with a human-labeled calibration set.',
      'Use judges for regression detection and triage, not as the only gate for high-stakes launches.',
    ],
    followUps: ['How would you build a golden set for a new product?'],
  },
  {
    id: 'ai-11', category: 'AI Systems', level: 'staff',
    q: 'An agent can call tools that send email and modify tickets. How do you make it safe?',
    senior: 'Limit which tools it can call, validate tool arguments, ask the user to confirm risky actions, and log everything it does.',
    staff: [
      'Least privilege: scoped, short-lived credentials per task, with read-only tools by default.',
      'Treat all tool outputs and retrieved content as untrusted: indirect prompt injection can steer the agent toward exfiltration.',
      'Require human confirmation for irreversible or outward-facing actions, and cap steps, spend, and wall time.',
      'Keep a replayable audit log and red-team the agent with injection test cases before launch.',
    ],
    followUps: ['A retrieved web page tells the agent to forward the inbox. What stops it?'],
  },
  {
    id: 'ai-12', category: 'AI Systems', level: 'senior',
    q: 'What is prompt injection, and why can’t a better system prompt fully prevent it?',
    senior: 'Prompt injection is when untrusted text (user input, a web page, a document) contains instructions the model follows instead of the developer’s. Models do not reliably separate instructions from data, so wording alone cannot guarantee they will ignore injected instructions.',
    staff: [
      'Design as if injection will sometimes succeed: limit what a compromised model can do (tool permissions, egress, data access).',
      'Separate privileges: the component that reads untrusted content should not hold powerful tools.',
      'Layer defenses (input/output classifiers, allow-listed actions, confirmations) and test with an injection suite.',
    ],
    followUps: ['How would you detect data exfiltration through generated links or images?'],
  },
  {
    id: 'ai-13', category: 'AI Systems', level: 'staff',
    q: 'Should an LLM product use a semantic cache?',
    senior: 'A semantic cache returns a stored answer when a new prompt is similar enough to an old one. It can cut cost and latency for repeated FAQ-style questions.',
    staff: [
      'Similar is not identical: a small wording change can flip the right answer, so a similarity threshold trades hit rate for wrong answers.',
      'Caching across users can leak one user’s personalized or permissioned answer to another: scope by tenant and permission set, or do not share.',
      'Prefer exact-match caching and provider prompt/prefix caching, which are safe, and use semantic caching only for narrow, public content with evals on false hits.',
    ],
    followUps: ['How would you measure the false-hit rate?'],
  },
  {
    id: 'ai-14', category: 'AI Systems', level: 'staff',
    q: 'Your LLM gateway’s primary provider fails halfway through streaming a response. What happens?',
    senior: 'The gateway detects the error and retries the request on a fallback provider, then streams the new response to the client.',
    staff: [
      'Once tokens have reached the client, a transparent retry would duplicate or splice output. Fail over only before the first token.',
      'After streaming starts, send an explicit error event so the client can decide (retry, show partial answer).',
      'Bill from provider-reported usage per attempt and keep one request id, so cost attribution stays correct across retries.',
    ],
    followUps: ['How do circuit breakers reduce how often this happens?'],
  },
  {
    id: 'ai-15', category: 'AI Systems', level: 'senior',
    q: 'Which latency metrics matter for a streaming LLM API, and why?',
    senior: 'Time to first token (TTFT) determines how responsive the product feels; time per output token (TPOT), or tokens per second, determines how fast text streams. End-to-end latency matters for non-streaming and tool-calling workloads.',
    staff: [
      'Track them per percentile and per prompt-length bucket; averages hide long-prompt TTFT spikes.',
      'Queueing time is often the largest part of TTFT under load, so measure it separately from prefill.',
      'Tie SLOs to the use case: autocomplete needs a tight TTFT, while batch summarization cares about throughput and cost.',
    ],
    followUps: ['How would you autoscale on these metrics?'],
  },
]
