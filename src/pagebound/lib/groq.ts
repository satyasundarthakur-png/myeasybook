const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

import { sleep } from './shared';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GroqRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GroqRequestError';
  }
}

/**
 * Strips a leaked reasoning-model scratchpad from a response.
 *
 * Reasoning models on Groq (the gpt-oss family, Qwen3 family) generate an
 * internal <think>...</think> block before their real answer. groqComplete
 * requests reasoning_format: "hidden" to suppress this at the API level,
 * but there's a documented Groq bug (community.groq.com, "GPT-OSS-120B:
 * Reasoning tokens ... appearing in responses despite configuration to
 * hide reasoning") where it can still leak through for gpt-oss-120b — this
 * is a defensive second layer, not a substitute for the API parameter.
 *
 * Confirmed against real output from this exact failure mode: a Polish run
 * returned entire chapters replaced by the model's step-by-step correction
 * reasoning ("1. Analyze User Input... 2. Identify Constraints... Let's
 * verify...") instead of the corrected text.
 */
export function stripReasoningArtifacts(text: string): string {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // An unclosed <think> almost always means the response was cut off
  // mid-reasoning (ran out of tokens) before ever producing a real answer —
  // there's no usable content to recover from that, so fail loudly instead
  // of silently returning the dangling reasoning fragment as if it were content.
  if (/<think>/i.test(cleaned)) {
    throw new Error(
      'The model got stuck reasoning and never produced a final answer (unclosed <think> block). Try again, or switch models.'
    );
  }

  if (!cleaned) {
    throw new Error('Groq returned only reasoning content with no final answer.');
  }

  return cleaned;
}

/**
 * Minimal Groq chat-completion wrapper. Called directly from the browser,
 * matching the pattern used across the author's other Lovable + Groq apps.
 *
 * Retries on 429 (rate limit) and 5xx with exponential backoff, since
 * manuscripts with hundreds/thousands of chapters will otherwise blow
 * through per-minute rate limits and fail silently mid-run.
 */
export async function groqComplete(
  apiKey: string,
  model: string,
  messages: GroqMessage[],
  opts: { temperature?: number; maxTokens?: number; maxRetries?: number } = {}
): Promise<string> {
  if (!apiKey) {
    throw new Error('Missing Groq API key. Add it in Settings before running AI steps.');
  }

  const maxRetries = opts.maxRetries ?? 4;
  let attempt = 0;

  while (true) {
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 4096,
        // Suppress reasoning-model scratchpad content — see stripReasoningArtifacts
        // above for why this alone isn't fully trusted for every model.
        reasoning_format: 'hidden',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Groq returned an empty response.');
      return stripReasoningArtifacts(content as string);
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= maxRetries) {
      const body = await res.text();
      throw new GroqRequestError(res.status, `Groq request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    // Respect Retry-After if Groq sends it, otherwise exponential backoff + jitter.
    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
    const backoffMs = retryAfterMs ?? Math.min(20000, 1000 * 2 ** attempt) + Math.random() * 400;
    await sleep(backoffMs);
    attempt++;
  }
}

// Chunk long chapter text so we stay well under context/token limits per call.
export function chunkText(text: string, maxChars = 6000): string[] {
  if (text.length <= maxChars) return [text];
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > maxChars && current) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? current + '\n\n' + p : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
