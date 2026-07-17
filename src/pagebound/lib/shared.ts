/**
 * Small helpers shared across Pagebound's lib/store files. Consolidated
 * here after they'd been independently copy-pasted into groq.ts, aiWriter.ts,
 * useBookStore.ts (sleep), chapterDetector.ts, chapterGrouper.ts (makeId),
 * and coverGenerator.ts, epubBuilder.ts, printBuilder.ts (XML/HTML escaping).
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Resolves the "current" text for a chapter: polished text if it exists,
 * otherwise OCR-corrected text if that ran, otherwise the original as
 * detected. Every consumer downstream of Polish/Index/export uses this
 * instead of its own ad-hoc fallback chain, so adding the OCR-fix stage
 * only had to change this in one place.
 */
export function resolveChapterText(chapter: { polishedText: string | null; ocrFixedText: string | null; originalText: string }): string {
  return chapter.polishedText ?? chapter.ocrFixedText ?? chapter.originalText;
}

/** Decodes a base64 data URL into raw bytes, used by both the DOCX and
 * EPUB builders to embed images from resolveCoverImageDataUrl's output. */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
