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

  // Strip trailing page numbers/punctuation, including common Devanagari/Odia
  // digit and punctuation marks, to group "Chapter One 23" with "Chapter One 45".
  const normalize = (line: string) =>
    line.trim().replace(/[\d.\-\s\]\[()।॥०-९୦-୯]+$/g, '').trim();

  const suffixHasDigit = (trimmed: string, key: string) => /[\d०-९୦-୯]/.test(trimmed.slice(key.length));

  const occurrences = new Map<string, { idxs: number[]; digitSuffixCount: number }>();
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > MAX_HEADER_LEN) return;
    const key = normalize(trimmed);
    if (!key || key.length < MIN_KEY_LEN) return;
    if (!occurrences.has(key)) occurrences.set(key, { idxs: [], digitSuffixCount: 0 });
    const entry = occurrences.get(key)!;
    entry.idxs.push(idx);
    if (suffixHasDigit(trimmed, key)) entry.digitSuffixCount++;
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

export function cleanManuscriptText(rawText: string): { text: string; report: CleanupReport } {
  const afterChrome = stripArchiveOrgChrome(rawText);
  const afterHeaders = stripRepeatedRunningHeaders(afterChrome.text);
  return {
    text: afterHeaders.text,
    report: {
      strippedViewerChrome: afterChrome.stripped,
      strippedHeaderLines: afterHeaders.removed,
    },
  };
}
