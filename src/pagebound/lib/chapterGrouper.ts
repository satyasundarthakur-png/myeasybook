import type { Chapter, ChapterGroup } from '../types/book';
import { makeId } from './shared';

// Below this count, a flat list is still perfectly navigable — don't force
// grouping on a normal 8-30 chapter novel/nonfiction manuscript.
const FLAT_THRESHOLD = 40;

// Target size for synthesized groups when no natural chapter numbering
// exists at all (pure verse-by-verse or scene-by-scene manuscripts).
const TARGET_GROUP_SIZE = 25;
const MAX_SYNTHETIC_GROUPS = 60;

/**
 * Tries to read an embedded "major chapter" number out of a detected
 * item's title, e.g. "Chapter 3, Verse 12" -> 3, or "3.12" -> 3.
 * Returns null if no such reference is found.
 */
function extractMajorChapterNumber(title: string): number | null {
  const named = title.match(/\bchapter\s+(\d+)\b/i);
  if (named) return parseInt(named[1], 10);
  const dotted = title.match(/^\s*(\d+)\.\d+/);
  if (dotted) return parseInt(dotted[1], 10);
  return null;
}

/**
 * Groups a flat list of detected chapters/verses into navigable buckets.
 *
 * - Manuscripts with <= 40 items: single implicit group, list stays flat.
 * - Manuscripts with embedded chapter references in most item titles
 *   (e.g. a Gita-style "Chapter N, Verse M" convention repeated on every
 *   verse): grouped by that extracted chapter number.
 * - Everything else large: synthesized into equal-sized sections purely
 *   for navigability, since the source has no natural higher-level
 *   structure to key off of.
 */
export function groupChapters(chapters: Chapter[]): ChapterGroup[] {
  if (chapters.length <= FLAT_THRESHOLD) {
    return [
      {
        id: makeId(),
        number: 1,
        title: 'All chapters',
        chapterIds: chapters.map((c) => c.id),
      },
    ];
  }

  const extracted = chapters.map((c) => extractMajorChapterNumber(c.title));
  const validCount = extracted.filter((n) => n !== null).length;

  if (validCount / chapters.length > 0.7) {
    const groupsByNumber = new Map<number, string[]>();
    let fallbackCounter = 0;
    chapters.forEach((c, i) => {
      const num = extracted[i] ?? ++fallbackCounter;
      if (!groupsByNumber.has(num)) groupsByNumber.set(num, []);
      groupsByNumber.get(num)!.push(c.id);
    });
    return Array.from(groupsByNumber.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([num, ids]) => ({
        id: makeId(),
        number: num,
        title: `Chapter ${num}`,
        chapterIds: ids,
      }));
  }

  // No natural structure found — synthesize equal-sized sections so the
  // list stays navigable regardless of how the source manuscript was formatted.
  const groupCount = Math.min(
    MAX_SYNTHETIC_GROUPS,
    Math.max(2, Math.ceil(chapters.length / TARGET_GROUP_SIZE))
  );
  const perGroup = Math.ceil(chapters.length / groupCount);
  const groups: ChapterGroup[] = [];
  for (let i = 0; i < chapters.length; i += perGroup) {
    const slice = chapters.slice(i, i + perGroup);
    const first = slice[0]?.number ?? i + 1;
    const last = slice[slice.length - 1]?.number ?? i + slice.length;
    groups.push({
      id: makeId(),
      number: groups.length + 1,
      title: `Section ${groups.length + 1} (${first}\u2013${last})`,
      chapterIds: slice.map((c) => c.id),
    });
  }
  return groups;
}
