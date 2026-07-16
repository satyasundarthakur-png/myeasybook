import type { Chapter } from '../types/book';
import { groqComplete } from './groq';

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const CHAPTER_HEADING_RE =
  /^\s*(chapter|part|section)\s+([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b[:.\-\s]*(.*)$/i;

/**
 * Attempt 1: split on lines that look like "Chapter 1: Title" / "CHAPTER ONE".
 */
function splitByHeadingPattern(rawText: string): Chapter[] | null {
  const lines = rawText.split(/\r?\n/);
  const breakpoints: { line: number; title: string }[] = [];

  lines.forEach((line, idx) => {
    const m = line.match(CHAPTER_HEADING_RE);
    if (m) {
      const titleTail = m[3]?.trim();
      breakpoints.push({ line: idx, title: titleTail || `Chapter ${breakpoints.length + 1}` });
    }
  });

  if (breakpoints.length < 2) return null;

  const chapters: Chapter[] = [];
  for (let i = 0; i < breakpoints.length; i++) {
    const start = breakpoints[i].line + 1;
    const end = i + 1 < breakpoints.length ? breakpoints[i + 1].line : lines.length;
    const body = lines.slice(start, end).join('\n').trim();
    if (!body) continue;
    chapters.push({
      id: makeId(),
      number: chapters.length + 1,
      title: breakpoints[i].title || `Chapter ${chapters.length + 1}`,
      originalText: body,
      polishedText: null,
      status: 'raw',
      wordCount: wordCount(body),
    });
  }
  return chapters.length >= 2 ? chapters : null;
}

/**
 * Attempt 2: split on 3+ consecutive blank lines or a "***"/"---" scene-break
 * style marker, treating each block as a chapter. Used when no explicit
 * "Chapter N" headings exist but the manuscript still has clear breaks.
 */
function splitByBlankGaps(rawText: string): Chapter[] | null {
  const blocks = rawText
    .split(/\n\s*(?:\*{3,}|-{3,}|_{3,})\s*\n|\n{4,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length < 2) return null;

  return blocks.map((body, idx) => ({
    id: makeId(),
    number: idx + 1,
    title: `Chapter ${idx + 1}`,
    originalText: body,
    polishedText: null,
    status: 'raw' as const,
    wordCount: wordCount(body),
  }));
}

/**
 * Attempt 3 (fallback, requires an API key): ask Groq to propose chapter
 * break points for manuscripts with no structural markers at all. Returns
 * an array of 0-indexed character offsets, one per chapter start.
 */
async function splitWithAI(
  rawText: string,
  apiKey: string,
  model: string
): Promise<Chapter[]> {
  // Work on a compact outline: first ~200 chars of every paragraph, indexed.
  const paragraphs = rawText.split(/\n\n+/);
  const outline = paragraphs
    .map((p, i) => `[${i}] ${p.slice(0, 160).replace(/\n/g, ' ')}`)
    .join('\n');

  const prompt = `You are structuring a raw manuscript into chapters. Below is a numbered list of paragraph previews from the manuscript, in order.

Return ONLY a JSON array of objects like {"paragraphIndex": number, "title": string}, one per chapter, marking the paragraph index where each new chapter should START (the first entry should be paragraphIndex 0). Choose sensible break points based on topic or scene shifts, aiming for roughly 6-14 chapters depending on length. Do not include any text besides the JSON array.

Paragraph previews:
${outline}`;

  const response = await groqComplete(
    apiKey,
    model,
    [
      { role: 'system', content: 'You output strict JSON only, no markdown fences, no commentary.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.2, maxTokens: 2048 }
  );

  const cleaned = response.replace(/```json|```/g, '').trim();
  const marks: { paragraphIndex: number; title: string }[] = JSON.parse(cleaned);
  marks.sort((a, b) => a.paragraphIndex - b.paragraphIndex);

  const chapters: Chapter[] = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].paragraphIndex;
    const end = i + 1 < marks.length ? marks[i + 1].paragraphIndex : paragraphs.length;
    const body = paragraphs.slice(start, end).join('\n\n').trim();
    if (!body) continue;
    chapters.push({
      id: makeId(),
      number: chapters.length + 1,
      title: marks[i].title || `Chapter ${chapters.length + 1}`,
      originalText: body,
      polishedText: null,
      status: 'raw',
      wordCount: wordCount(body),
    });
  }
  return chapters;
}

export async function detectChapters(
  rawText: string,
  aiFallback: { apiKey: string; model: string } | null
): Promise<{ chapters: Chapter[]; method: 'headings' | 'blank-gaps' | 'ai' | 'single' }> {
  const byHeading = splitByHeadingPattern(rawText);
  if (byHeading) return { chapters: byHeading, method: 'headings' };

  const byGaps = splitByBlankGaps(rawText);
  if (byGaps && byGaps.length >= 3) return { chapters: byGaps, method: 'blank-gaps' };

  if (aiFallback?.apiKey) {
    try {
      const aiChapters = await splitWithAI(rawText, aiFallback.apiKey, aiFallback.model);
      if (aiChapters.length >= 2) return { chapters: aiChapters, method: 'ai' };
    } catch {
      // fall through to single-chapter fallback below
    }
  }

  // Last resort: the whole manuscript as one chapter, so the pipeline never blocks.
  return {
    chapters: [
      {
        id: makeId(),
        number: 1,
        title: 'Chapter 1',
        originalText: rawText.trim(),
        polishedText: null,
        status: 'raw',
        wordCount: wordCount(rawText),
      },
    ],
    method: 'single',
  };
}
