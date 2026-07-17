import type { Chapter } from '../types/book';
import { aiComplete } from './aiClient';
import type { AiProviderConfig } from './aiTypes';
import { makeId } from './shared';

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', 39: "'", apos: "'", nbsp: ' ',
};

function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#?\w+);/g, (full, code) => HTML_ENTITIES[code.replace('#', '')] ?? full);
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).trim();
}

/** Converts a fragment of mammoth-generated HTML (a run of <p>/<h*> elements)
 * into plain text with the same blank-line-per-paragraph convention the
 * rest of the pipeline (and cleanManuscriptText) already expects. */
function htmlFragmentToText(html: string): string {
  return html
    .split(/<p[^>]*>|<\/p>/gi)
    .map((chunk) => stripTags(chunk))
    .filter(Boolean)
    .join('\n\n');
}

// Section headings with zero narrative content of their own — always just
// a navigational list — so they're excluded even though they're detected as
// genuine Heading-1 sections. Introduction/Index are NOT excluded here:
// unlike a table of contents, they contain real prose/data a user might
// want kept, and there's no dedicated place to route it to yet, so keeping
// it visible as an odd-but-present chapter beats silently dropping it.
const NON_CHAPTER_HEADINGS = /^(table of contents|contents)$/i;

/**
 * Attempt 1: use the actual Heading-1-styled sections from the source Word
 * document, when available. Mammoth's HTML conversion (unlike its plain-text
 * extraction) preserves heading tags, so a manuscript that already uses
 * Word's "Heading 1" style for chapter titles — a completely standard
 * authoring practice, and exactly what Pagebound's own DOCX export produces
 * — can be split using its real chapter titles instead of falling through
 * to blank-gap detection and generic "Chapter N" placeholders. Confirmed
 * this was previously never attempted: parseUploadedFile extracted this
 * HTML but detectChapters was only ever given the plain-text version.
 */
function splitByHtmlHeadings(html: string): Chapter[] | null {
  if (!html) return null;
  const headingRe = /<h1[^>]*>(.*?)<\/h1>/gis;
  const matches = [...html.matchAll(headingRe)];
  if (matches.length < 2) return null;

  const chapters: Chapter[] = [];
  for (let i = 0; i < matches.length; i++) {
    const title = stripTags(matches[i][1]);
    if (!title || NON_CHAPTER_HEADINGS.test(title)) continue;

    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : html.length;
    const body = htmlFragmentToText(html.slice(start, end));
    if (!body) continue;

    chapters.push({
      id: makeId(),
      number: chapters.length + 1,
      title,
      originalText: body,
      polishedText: null,
      ocrFixedText: null,
      ocrStatus: 'raw',
      status: 'raw',
      wordCount: wordCount(body),
    });
  }
  return chapters.length >= 2 ? chapters : null;
}

const CHAPTER_HEADING_RE =
  /^\s*(chapter|part|section|adhyaya)\s+([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b[:.\-\s]*(.*)$/i;

/**
 * Attempt 2: split on lines that look like "Chapter 1: Title" / "CHAPTER ONE".
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
      ocrFixedText: null,
      ocrStatus: 'raw',
      status: 'raw',
      wordCount: wordCount(body),
    });
  }
  return chapters.length >= 2 ? chapters : null;
}

/**
 * Attempt 3: detect genuine Adhyaya (chapter) boundaries in Odia/Sanskrit
 * texts via the traditional closing-colophon convention — a line naming
 * the chapter and declaring it complete, e.g. "'Karmayoga' named third
 * chapter completed" (ତୃତୀୟ ଅଧ୍ୟାୟ ସମାପ୍ତ) — rather than mechanical blank-line
 * spacing between verses.
 *
 * Deliberately does NOT trust "chapter begins" narrative asides (ଆରମ୍ଭ) —
 * commentary discussing an earlier chapter's opening from a later vantage
 * point reads identically to a real boundary and is a genuine false-positive
 * risk; the closing colophon convention is far more reliably formulaic.
 *
 * Requires a reasonable minimum number of distinct chapters found before
 * trusting this at all: many devotional/commentary editions don't mark
 * every single chapter boundary consistently, and a confidently-wrong
 * partial split (silently merging several real chapters together where
 * markers are missing) is worse than falling through to the blank-gap
 * splitter and the synthetic grouping fallback after it.
 */
const ADHYAYA_ORDINALS_ODIA = [
  'ପ୍ରଥମ', 'ଦ୍ୱିତୀୟ', 'ତୃତୀୟ', 'ଚତୁର୍ଥ', 'ପଞ୍ଚମ', 'ଷଷ୍ଠ', 'ସପ୍ତମ', 'ଅଷ୍ଟମ',
  'ନବମ', 'ଦଶମ', 'ଏକାଦଶ', 'ଦ୍ୱାଦଶ', 'ତ୍ରୟୋଦଶ', 'ଚତୁର୍ଦ୍ଦଶ', 'ପଞ୍ଚଦଶ', 'ଷୋଡ଼ଶ',
  'ସପ୍ତଦଶ', 'ଅଷ୍ଟାଦଶ',
];
const ADHYAYA_COLLOQUIAL_ODIA: Record<string, number> = { ପନ୍ଦର: 15, ସତର: 17, ଛଠ: 6, ବାର: 12 };
const ODIA_DIGIT_CHARS = '୦୧୨୩୪୫୬୭୮୯';
const MIN_ADHYAYA_MARKERS = 8;

function odiaDigitsToInt(s: string): number | null {
  const converted = [...s].map((ch) => {
    const i = ODIA_DIGIT_CHARS.indexOf(ch);
    return i >= 0 ? String(i) : ch;
  }).join('');
  const n = parseInt(converted, 10);
  return Number.isFinite(n) ? n : null;
}

function findAdhyayaEndMarkers(lines: string[]): { line: number; num: number }[] {
  const found: { line: number; num: number }[] = [];
  lines.forEach((raw, idx) => {
    const t = raw.trim();
    if (!t.includes('ଅଧ୍ୟାୟ')) return;
    if (t.includes('ଶ୍ଳୋକ') || t.includes('ଶ୍ଲୋକ')) return; // exclude verse cross-references
    if (!/ସମାପ୍ତ/.test(t)) return; // closing colophon only, not narrative "begins" asides

    let num: number | null = null;
    const ordIdx = ADHYAYA_ORDINALS_ODIA.findIndex((o) => t.includes(o));
    if (ordIdx >= 0) num = ordIdx + 1;
    if (!num) {
      const digitMatch = t.match(/ଅଧ୍ୟାୟ[-\s]*([୦-୯0-9]+)/);
      if (digitMatch) num = odiaDigitsToInt(digitMatch[1]);
    }
    if (!num) {
      for (const [word, n] of Object.entries(ADHYAYA_COLLOQUIAL_ODIA)) {
        if (t.includes(word)) {
          num = n;
          break;
        }
      }
    }
    if (num) found.push({ line: idx, num });
  });
  return found;
}

function splitByAdhyayaMarkers(rawText: string): Chapter[] | null {
  const lines = rawText.split(/\r?\n/);
  const markers = findAdhyayaEndMarkers(lines);

  // Dedupe: keep the first (earliest) occurrence per chapter number.
  const byNum = new Map<number, number>();
  for (const m of markers) {
    if (!byNum.has(m.num)) byNum.set(m.num, m.line);
  }

  if (byNum.size < MIN_ADHYAYA_MARKERS) return null;

  const boundaries = Array.from(byNum.entries())
    .map(([num, line]) => ({ num, line }))
    .sort((a, b) => a.line - b.line);

  const chapters: Chapter[] = [];
  let prevLine = 0;
  for (const { num, line } of boundaries) {
    const body = lines.slice(prevLine, line + 1).join('\n').trim();
    if (body) {
      chapters.push({
        id: makeId(),
        number: num,
        title: `Adhyaya ${num}`,
        originalText: body,
        polishedText: null,
        ocrFixedText: null,
      ocrStatus: 'raw',
      status: 'raw',
        wordCount: wordCount(body),
      });
    }
    prevLine = line + 1;
  }

  // Trailing content after the last detected boundary (closing verses, etc.)
  const tail = lines.slice(prevLine).join('\n').trim();
  if (tail) {
    chapters.push({
      id: makeId(),
      number: (chapters[chapters.length - 1]?.number ?? 0) + 1,
      title: 'Closing',
      originalText: tail,
      polishedText: null,
      ocrFixedText: null,
      ocrStatus: 'raw',
      status: 'raw',
      wordCount: wordCount(tail),
    });
  }

  return chapters.length >= MIN_ADHYAYA_MARKERS ? chapters : null;
}

/**
 * Attempt 4: split on 3+ consecutive blank lines or a "***"/"---" scene-break
 * style marker, treating each block as a chapter. Used when no explicit
 * "Chapter N" headings or Adhyaya colophons exist but the manuscript still
 * has clear breaks.
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
    ocrFixedText: null,
    ocrStatus: 'raw' as const,
    status: 'raw' as const,
    wordCount: wordCount(body),
  }));
}

/**
 * Attempt 5 (fallback, requires an API key): ask Groq to propose chapter
 * break points for manuscripts with no structural markers at all. Returns
 * an array of 0-indexed character offsets, one per chapter start.
 */
async function splitWithAI(
  rawText: string,
  config: AiProviderConfig
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

  const response = await aiComplete(
    config,
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
      ocrFixedText: null,
      ocrStatus: 'raw',
      status: 'raw',
      wordCount: wordCount(body),
    });
  }
  return chapters;
}

export async function detectChapters(
  rawText: string,
  aiFallback: AiProviderConfig | null,
  html: string = ''
): Promise<{ chapters: Chapter[]; method: 'html-headings' | 'headings' | 'adhyaya-markers' | 'blank-gaps' | 'ai' | 'single' }> {
  const byHtmlHeadings = splitByHtmlHeadings(html);
  if (byHtmlHeadings) return { chapters: byHtmlHeadings, method: 'html-headings' };

  const byHeading = splitByHeadingPattern(rawText);
  if (byHeading) return { chapters: byHeading, method: 'headings' };

  const byAdhyaya = splitByAdhyayaMarkers(rawText);
  if (byAdhyaya) return { chapters: byAdhyaya, method: 'adhyaya-markers' };

  const byGaps = splitByBlankGaps(rawText);
  if (byGaps && byGaps.length >= 3) return { chapters: byGaps, method: 'blank-gaps' };

  if (aiFallback?.apiKey) {
    try {
      const aiChapters = await splitWithAI(rawText, aiFallback);
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
        ocrFixedText: null,
      ocrStatus: 'raw',
      status: 'raw',
        wordCount: wordCount(rawText),
      },
    ],
    method: 'single',
  };
}
