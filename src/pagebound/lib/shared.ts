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
