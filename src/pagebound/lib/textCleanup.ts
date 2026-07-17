/**
 * General-purpose cleanup for raw manuscript text before chapter detection
 * runs. Both techniques here are standard practice in OCR/digital-humanities
 * text pipelines (e.g. HathiTrust's DataMunging running-header remover, or
 * the "deterministic cleanup" step used by document-chunking tools before
 * handing text to an LLM) — deliberately kept as general heuristics rather
 * than per-language/per-book special cases, so they help on any future
 * archive.org or scanned-book upload, not just one specific file.
 */

export interface CleanupReport {
  strippedViewerChrome: boolean;
  strippedHeaderLines: number;
  reflowedParagraphs: boolean;
}

/**
 * Archive.org's "Full text of ..." viewer page includes site navigation
 * chrome (menus, login/signup links, etc.) before the actual document
 * text begins. That chrome is always followed by the literal phrase
 * "See other formats" immediately before the real content starts — a
 * distinctive enough marker to strip everything before it with high
 * confidence and effectively no false-positive risk (this phrase has no
 * reason to appear naturally inside a book).
 */
function stripArchiveOrgChrome(text: string): { text: string; stripped: boolean } {
  const marker = 'See other formats';
  const idx = text.indexOf(marker);
  // Only trust this if the marker appears near the very start of the
  // document — if it shows up thousands of characters in, it's more likely
  // coincidental than the archive.org viewer header.
  if (idx === -1 || idx > 2000) return { text, stripped: false };
  return { text: text.slice(idx + marker.length).trimStart(), stripped: true };
}

/**
 * Scanned/OCR'd books commonly repeat a running header (book or chapter
 * title, often with a trailing page number) on every page. Left in place,
 * these pollute chapter detection — a header repeated dozens of times
 * reads as dozens of tiny "chapters" to a blank-gap splitter.
 *
 * Detects short lines that recur several times AND whose trailing
 * characters usually include an actual digit (i.e. they carry a real page
 * number, not just trailing punctuation) — this is the specific signal
 * that distinguishes a genuine running header from an unrelated short line
 * that happens to repeat, like a common short word or a recurring stage
 * direction such as "(exit)". Verified against a real scanned play script:
 * an earlier version of this check (recurring short line + spread across
 * the document, no digit requirement) incorrectly matched both of those
 * false-positive cases while missing the real running headers entirely;
 * requiring a genuine digit suffix fixed both problems.
 */
function stripRepeatedRunningHeaders(text: string): { text: string; removed: number } {
  const lines = text.split(/\r?\n/);
  const MAX_HEADER_LEN = 50;
  const MIN_KEY_LEN = 5;
  const MIN_OCCURRENCES = 5;
  const MIN_DIGIT_SUFFIX_RATIO = 0.5;
  const MIN_LINE_SPREAD = 20; // cheap sanity floor against tightly-clustered false positives

  // Strip trailing AND leading page numbers/punctuation, including common
  // Devanagari/Odia digit and punctuation marks — running headers appear
  // as both "Book Title 23" and "23 Book Title" depending on the source's
  // original page layout (left vs. right page numbering).
  const normalize = (line: string) =>
    line
      .trim()
      .replace(/[\d.\-\s\]\[()।॥०-९୦-୯]+$/g, '')
      .replace(/^[\d.\-\s\]\[()।॥०-९୦-୯]+/g, '')
      .trim();

  const suffixOrPrefixHasDigit = (trimmed: string, key: string) => {
    const keyStart = trimmed.indexOf(key);
    const prefix = keyStart > 0 ? trimmed.slice(0, keyStart) : '';
    const suffix = keyStart >= 0 ? trimmed.slice(keyStart + key.length) : '';
    return /[\d०-९୦-୯]/.test(prefix) || /[\d०-९୦-୯]/.test(suffix);
  };

  const occurrences = new Map<string, { idxs: number[]; digitSuffixCount: number }>();
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > MAX_HEADER_LEN) return;
    const key = normalize(trimmed);
    if (!key || key.length < MIN_KEY_LEN) return;
    if (!occurrences.has(key)) occurrences.set(key, { idxs: [], digitSuffixCount: 0 });
    const entry = occurrences.get(key)!;
    entry.idxs.push(idx);
    if (suffixOrPrefixHasDigit(trimmed, key)) entry.digitSuffixCount++;
  });

  const headerLineIndexes = new Set<number>();
  for (const [, { idxs, digitSuffixCount }] of occurrences) {
    if (idxs.length < MIN_OCCURRENCES) continue;
    if (digitSuffixCount < idxs.length * MIN_DIGIT_SUFFIX_RATIO) continue;
    if (idxs[idxs.length - 1] - idxs[0] < MIN_LINE_SPREAD) continue;
    idxs.forEach((i) => headerLineIndexes.add(i));
  }

  if (headerLineIndexes.size === 0) return { text, removed: 0 };

  const cleaned = lines.filter((_, idx) => !headerLineIndexes.has(idx));
  return { text: cleaned.join('\n'), removed: headerLineIndexes.size };
}

/**
 * Scanned books are frequently OCR'd/extracted with one Word paragraph per
 * physical printed line, rather than per logical paragraph — mammoth (the
 * .docx text extractor used here) always joins consecutive paragraphs with
 * a blank line, so this produces long runs of very short "paragraphs" (one
 * per original page line) with no way to tell them apart from genuine
 * paragraph breaks just by looking at blank-line spacing.
 *
 * Left alone, every export (DOCX/EPUB/print) renders each of these as its
 * own short paragraph — confirmed directly against a real export: 100% of
 * paragraphs under 80 characters, median 59 — which is what produces a
 * page that looks like text stacked down the left side with the right
 * two-thirds empty on every line, since none of them are long enough to
 * wrap.
 *
 * This is the standard "line rejoining" step from OCR post-processing
 * tooling (e.g. OCRnormalizer's "rejoins words broken across a linebreak").
 * Merges consecutive short chunks into flowing paragraphs, using sentence-
 * final punctuation as the signal for a genuine paragraph boundary, and
 * additionally treating a "Speaker--" style prefix as a boundary (common in
 * play/dialogue scripts, where a new speaker's line should start a new
 * paragraph even if the previous line technically lacked closing
 * punctuation due to an OCR gap).
 *
 * Deliberately preserves any run of 4+ newlines untouched — that's the
 * same threshold chapterDetector's blank-gap splitter uses for genuine
 * structural boundaries (acts, sections, chapters), so this only reflows
 * the noise *within* a section, never merges across a real one.
 */
function reflowParagraphs(text: string): string {
  const HARD_BREAK = /\n{4,}/;
  const TERMINAL_PUNCTUATION = /[।॥.!?:"')\u2019\u201d]\s*$/;
  const NEW_SPEAKER = /^[^\s\-–—]{1,30}\s*[-–—]{2,}/;

  const reflowSection = (section: string): string => {
    const chunks = section
      .split(/\n\n+/)
      .map((c) => c.trim())
      .filter(Boolean);

    const paragraphs: string[] = [];
    let buffer = '';
    for (const chunk of chunks) {
      const bufferEndsSentence = TERMINAL_PUNCTUATION.test(buffer);
      const chunkStartsNewSpeaker = NEW_SPEAKER.test(chunk);
      if (buffer && (bufferEndsSentence || chunkStartsNewSpeaker)) {
        paragraphs.push(buffer);
        buffer = chunk;
      } else {
        buffer = buffer ? `${buffer} ${chunk}` : chunk;
      }
    }
    if (buffer) paragraphs.push(buffer);
    return paragraphs.join('\n\n');
  };

  return text
    .split(HARD_BREAK)
    .map(reflowSection)
    .join('\n\n\n\n');
}

export function cleanManuscriptText(rawText: string): { text: string; report: CleanupReport } {
  const afterChrome = stripArchiveOrgChrome(rawText);
  const afterHeaders = stripRepeatedRunningHeaders(afterChrome.text);
  const beforeReflowParagraphCount = afterHeaders.text.split(/\n\n+/).filter((c) => c.trim()).length;
  const reflowedText = reflowParagraphs(afterHeaders.text);
  const afterReflowParagraphCount = reflowedText.split(/\n\n+/).filter((c) => c.trim()).length;

  return {
    text: reflowedText,
    report: {
      strippedViewerChrome: afterChrome.stripped,
      strippedHeaderLines: afterHeaders.removed,
      reflowedParagraphs: afterReflowParagraphCount < beforeReflowParagraphCount * 0.8,
    },
  };
}
