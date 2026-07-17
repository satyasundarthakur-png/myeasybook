import type { Chapter } from '../types/book';
import { chunkText, groqComplete } from './groq';
import { sleep } from './shared';

/**
 * OCR error correction, adapted from Dicklesworthstone/llm_aided_ocr
 * (github.com/Dicklesworthstone/llm_aided_ocr) — a well-tested prompt
 * strategy for exactly this problem, rather than written from scratch.
 * The core instructions below are close to their proven prompt structure:
 * fix recognition errors (split words, common OCR misreads) using context,
 * explicitly avoid "improving" or paraphrasing content, preserve structure.
 *
 * Adapted for Pagebound specifically:
 * - Operates per-chapter rather than on arbitrary token-count chunks,
 *   matching the existing Polish/Index pipeline's granularity.
 * - Context continuity uses the previous chapter's own corrected tail
 *   (same "prev_context" idea as the source repo, just chapter-scoped).
 * - Takes book title/author as socio-cultural context for the model, per
 *   CLOCR-C's (github.com/JonnoB/clocrc) finding that giving an LLM
 *   bibliographic context measurably improves correction accuracy versus
 *   giving it the raw text alone.
 */

const OCR_FIX_SYSTEM = `You are an expert at correcting OCR (optical character recognition) errors in scanned documents. You are NOT a proofreader or editor — do not improve, paraphrase, summarize, or rewrite the prose. Your only job is undoing recognition errors introduced by scanning, so a human reading the result gets back what the original page actually said.

Fix only these OCR-specific error types:
- Substitution: a character or word misread as a similar-looking one (e.g. one Devanagari/Odia letter misread as a visually similar one; "rn" misread as "m"; "1" misread as "l").
- Segmentation: words wrongly split across a line break, or two words accidentally fused together with no space.
- Insertion/deletion: stray characters introduced by scan noise, or characters/short words dropped entirely, inferable from context.
- Reading order: text that reads out of order because the scan misjudged column/line layout.

Do NOT:
- Paraphrase, summarize, modernize, or otherwise improve legitimate prose.
- Add content, explanation, or commentary not in the original.
- "Correct" a proper noun, character name, place name, or number unless you are highly confident it's a recognition error, not the actual name — if uncertain, leave it as-is.
- Add periods or punctuation the original didn't have.

Return ONLY the corrected text, with no preamble, no explanation, no markdown fences.`;

export interface OcrFixContext {
  bookTitle: string;
  bookAuthor: string;
}

async function fixOcrChunk(
  chunk: string,
  prevContext: string,
  bookContext: OcrFixContext,
  apiKey: string,
  model: string
): Promise<string> {
  const contextLine = bookContext.bookTitle
    ? `This text is from "${bookContext.bookTitle}"${bookContext.bookAuthor ? ` by ${bookContext.bookAuthor}` : ''}. Use that to judge whether an unusual word is a real proper noun or a scan error.\n\n`
    : '';

  const prompt = `${contextLine}Previous context (for continuity only — do not repeat it in your answer):
${prevContext.slice(-500)}

Text to correct:
${chunk}

Corrected text:`;

  const result = await groqComplete(
    apiKey,
    model,
    [
      { role: 'system', content: OCR_FIX_SYSTEM },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.2, maxTokens: 4096 }
  );
  return result.trim();
}

/**
 * Corrects OCR errors in a single chapter, chunking long chapters the same
 * way polishChapterText does and carrying the previous chunk's corrected
 * tail forward as context, per the source repo's "context preservation"
 * approach.
 */
export async function fixChapterOcrErrors(
  text: string,
  bookContext: OcrFixContext,
  apiKey: string,
  model: string
): Promise<string> {
  const chunks = chunkText(text, 6000);
  const fixed: string[] = [];
  let prevContext = '';

  for (const chunk of chunks) {
    const result = await fixOcrChunk(chunk, prevContext, bookContext, apiKey, model);
    fixed.push(result);
    prevContext = result;
  }

  return fixed.join('\n\n');
}

/**
 * Runs OCR correction across all chapters sequentially (same rate-limit-
 * aware pacing as polishAllChapters), reporting progress via callback so
 * the UI can show a real percentage instead of an indefinite spinner.
 */
export async function fixAllChaptersOcr(
  chapters: Chapter[],
  bookContext: OcrFixContext,
  apiKey: string,
  model: string,
  onChapterDone: (chapterId: string, result: { fixedText: string } | { error: string }) => void
): Promise<void> {
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    try {
      const fixedText = await fixChapterOcrErrors(chapter.originalText, bookContext, apiKey, model);
      onChapterDone(chapter.id, { fixedText });
    } catch (err) {
      onChapterDone(chapter.id, { error: (err as Error).message });
    }
    if (i < chapters.length - 1) await sleep(150);
  }
}
