import type { BookState, Chapter } from '../types/book';

export interface ExportUnit {
  number: number;
  title: string;
  body: string;
}

/**
 * Resolves what a "chapter" means for export purposes.
 *
 * For a normal manuscript (groups.length <= 1, i.e. ungrouped/flat), this is
 * just the chapters array as detected — one export unit per chapter, same
 * as always.
 *
 * For a large manuscript that got batched into synthetic sections or
 * detected Adhyaya-style groups (groups.length > 1), every export builder
 * was previously iterating book.chapters directly — completely ignoring
 * the grouping — which meant a manuscript grouped into 50 navigable
 * sections in the UI still exported as ~1,200 separate "chapters," each
 * getting its own heading and a forced page break. For content this
 * granular (often a sentence or two per raw chapter, from blank-gap
 * detection), the result was a document that was mostly forced page
 * breaks with barely any text before the next one — confirmed directly
 * against a real export: 1,213 page breaks in a 211K-character document.
 *
 * This concatenates each group's constituent chapters into one continuous
 * export unit, so the exported book's chapter structure matches what the
 * reader actually sees in the app.
 */
export function buildExportUnits(book: BookState): ExportUnit[] {
  if (book.groups.length <= 1) {
    return book.chapters.map((c) => ({
      number: c.number,
      title: c.title,
      body: c.polishedText ?? c.originalText,
    }));
  }

  const chapterById = new Map<string, Chapter>(book.chapters.map((c) => [c.id, c]));

  return book.groups.map((g, idx) => {
    const body = g.chapterIds
      .map((id) => chapterById.get(id))
      .filter((c): c is Chapter => Boolean(c))
      .map((c) => c.polishedText ?? c.originalText)
      .join('\n\n');
    return {
      number: idx + 1,
      title: g.title,
      body,
    };
  });
}
