const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Minimal Groq chat-completion wrapper. Called directly from the browser,
 * matching the pattern used across the author's other Lovable + Groq apps.
 */
export async function groqComplete(
  apiKey: string,
  model: string,
  messages: GroqMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  if (!apiKey) {
    throw new Error('Missing Groq API key. Add it in Settings before running AI steps.');
  }

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

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty response.');
  return content as string;
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
