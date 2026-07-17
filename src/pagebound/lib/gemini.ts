import { sleep } from './shared';
import { stripReasoningArtifacts } from './groq';
import type { AiMessage } from './aiTypes';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GeminiRequestError';
  }
}

/**
 * Gemini API wrapper, matching groqComplete's shape (same retry/backoff on
 * 429/5xx, same reasoning-artifact defense) so aiClient.ts can dispatch to
 * either provider transparently.
 *
 * Gemini's REST shape differs from the OpenAI-style Groq API: no single
 * "messages" array — a system instruction is its own top-level field, and
 * the conversation is a "contents" array using "model" instead of
 * "assistant" for the role name.
 *
 * Explicitly disables thinking (thinkingBudget: 0) even though Flash-Lite
 * has it off by default — matching the same defensive posture used for
 * Groq's reasoning models, since relying on a "should be off by default"
 * behavior is exactly what caused the reasoning-leak bug there.
 */
export async function geminiComplete(
  apiKey: string,
  model: string,
  messages: AiMessage[],
  opts: { temperature?: number; maxTokens?: number; maxRetries?: number } = {}
): Promise<string> {
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Add it in Settings before running AI steps.');
  }

  const systemMessages = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const conversation = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents: conversation,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxTokens ?? 4096,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (systemMessages) {
    body.systemInstruction = { parts: [{ text: systemMessages }] };
  }

  const maxRetries = opts.maxRetries ?? 4;
  let attempt = 0;

  while (true) {
    const res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
      if (!content) throw new Error('Gemini returned an empty response.');
      return stripReasoningArtifacts(content as string);
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= maxRetries) {
      const responseBody = await res.text();
      throw new GeminiRequestError(res.status, `Gemini request failed (${res.status}): ${responseBody.slice(0, 300)}`);
    }

    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
    const backoffMs = retryAfterMs ?? Math.min(20000, 1000 * 2 ** attempt) + Math.random() * 400;
    await sleep(backoffMs);
    attempt++;
  }
}
