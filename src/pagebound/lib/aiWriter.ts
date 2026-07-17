import type { Chapter, IndexEntry } from '../types/book';
import { chunkText } from './groq';
import { aiComplete } from './aiClient';
import type { AiProviderConfig } from './aiTypes';
import { sleep, resolveChapterText } from './shared';

const POLISH_SYSTEM = `You are a professional line editor preparing a manuscript for publication.
Fix grammar, punctuation, and awkward phrasing. Improve flow and clarity.
Preserve the author's voice, meaning, facts, and structure exactly.
Do not summarize, shorten, add new content, or add commentary.
Return only the polished text, with no preamble, no headings, and no notes.`;

export async function polishChapterText(
  text: string,
  config: AiProviderConfig
): Promise<string> {
  const chunks = chunkText(text, 6000);
  const polished: string[] = [];
  for (const chunk of chunks) {
    const result = await aiComplete(
      config,
      [
        { role: 'system', content: POLISH_SYSTEM },
        { role: 'user', content: chunk },
      ],
      { temperature: 0.3, maxTokens: 4096 }
    );
    polished.push(result.trim());
  }
  return polished.join('\n\n');
}

// Cap how many chapters feed the introduction prompt. For a normal 8-30
// chapter book this is every chapter; for a 2,900-item manuscript this
// samples evenly across the whole book instead of blowing the context
// window (or the token budget) trying to include all of them.
const MAX_INTRO_SAMPLE = 24;

function sampleChapters(chapters: Chapter[], max: number): Chapter[] {
  if (chapters.length <= max) return chapters;
  const step = chapters.length / max;
  const sampled: Chapter[] = [];
  for (let i = 0; i < max; i++) {
    sampled.push(chapters[Math.floor(i * step)]);
  }
  return sampled;
}

export async function generateIntroduction(
  chapters: Chapter[],
  bookTitle: string,
  config: AiProviderConfig
): Promise<string> {
  const sample = sampleChapters(chapters, MAX_INTRO_SAMPLE);
  const excerptChars = sample.length > 12 ? 400 : 900;

  const summarySource = sample
    .map((c) => `Chapter ${c.number} — ${c.title}:\n${(resolveChapterText(c)).slice(0, excerptChars)}`)
    .join('\n\n');

  const coverageNote =
    chapters.length > sample.length
      ? `\n\n(These are ${sample.length} representative excerpts sampled evenly across all ${chapters.length} chapters, not the full manuscript.)`
      : '';

  const prompt = `Write a short, engaging introduction (350-500 words) for a book titled "${bookTitle}", based on the chapter excerpts below.
The introduction should orient the reader to what the book covers and why it matters, in the author's likely voice and register — do not invent biographical claims about the author.
Return only the introduction text, no heading, no markdown.

${summarySource}${coverageNote}`;

  const result = await aiComplete(
    config,
    [
      { role: 'system', content: 'You are a skilled book editor writing front-matter introductions.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.5, maxTokens: 1500 }
  );
  return result.trim();
}

export async function extractIndexEntries(
  chapters: Chapter[],
  config: AiProviderConfig,
  onProgress?: (processed: number, total: number) => void
): Promise<IndexEntry[]> {
  const entriesMap = new Map<string, Set<number>>();

  // Scale batch size to chapter length so short verse-like items get grouped
  // more per call (fewer total requests) while long chapters stay small
  // batches — and pace requests so large manuscripts (hundreds of batches)
  // don't trigger the same rate-limit failure storm polishing did.
  const avgLen =
    chapters.reduce((sum, c) => sum + (resolveChapterText(c)).length, 0) / Math.max(1, chapters.length);
  const batchSize = avgLen < 400 ? 10 : avgLen < 1500 ? 5 : 3;
  const excerptChars = avgLen < 400 ? 400 : 3000;
  const totalBatches = Math.ceil(chapters.length / batchSize);
  let batchesDone = 0;

  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize);
    const source = batch
      .map((c) => `Chapter ${c.number}:\n${(resolveChapterText(c)).slice(0, excerptChars)}`)
      .join('\n\n');

    const prompt = `Extract 8-20 index-worthy terms (people, places, named concepts, technical terms, recurring topics) from the text below, per chapter.
Return ONLY a JSON array of objects: {"term": string, "chapter": number}. No markdown, no commentary.

${source}`;

    try {
      const response = await aiComplete(
        config,
        [
          { role: 'system', content: 'You output strict JSON only.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.2, maxTokens: 2048 }
      );
      const cleaned = response.replace(/```json|```/g, '').trim();
      const parsed: unknown = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) continue;

      for (const entry of parsed) {
        if (typeof entry !== 'object' || entry === null) continue;
        const { term, chapter } = entry as { term?: unknown; chapter?: unknown };

        if (typeof term !== 'string') continue;
        const key = term.trim();
        if (!key || key.length > 80) continue; // sane upper bound against garbage terms

        // Don't trust the model to always return a clean integer here — a
        // malformed response like {"chapter": "7 नों"} (extra text bleeding
        // into the field) was flowing straight through into the rendered
        // index as "Ch. 7 नों" before this validation existed. Extract just
        // the leading digits and reject anything that doesn't parse as a
        // real chapter number within range.
        const chapterNum =
          typeof chapter === 'number'
            ? chapter
            : typeof chapter === 'string'
              ? parseInt(chapter.match(/^\s*(\d+)/)?.[1] ?? '', 10)
              : NaN;
        if (!Number.isInteger(chapterNum) || chapterNum < 1 || chapterNum > chapters.length) continue;

        if (!entriesMap.has(key)) entriesMap.set(key, new Set());
        entriesMap.get(key)!.add(chapterNum);
      }
    } catch {
      // Skip a failed batch rather than aborting the whole index.
    }

    batchesDone++;
    onProgress?.(batchesDone, totalBatches);

    if (i + batchSize < chapters.length) await sleep(150);
  }

  return Array.from(entriesMap.entries())
    .map(([term, chapterSet]) => ({ term, chapterNumbers: Array.from(chapterSet).sort((a, b) => a - b) }))
    .sort((a, b) => a.term.localeCompare(b.term));
}
