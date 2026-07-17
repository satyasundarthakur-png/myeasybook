const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Groq returned an empty response.');
      return content as string;
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
