import type { BookState } from '../types/book';
import { generateCoverSVG } from './coverGenerator';
import { escapeXml as escapeHtml } from './shared';

function paragraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
    .join('\n');
}

/**
 * Builds a standalone, print-styled HTML document. Opening it and using the
 * browser's "Print to PDF" gives a clean, paginated PDF without a server
 * dependency — kept intentionally simple so it works the same way once
 * deployed on Lovable.
 */
export function buildPrintableHtml(book: BookState): string {
  const coverSvg = generateCoverSVG(book.cover);

  const chapterSections = book.chapters
    .map(
      (c) => `
      <section class="chapter">
        <h1>Chapter ${c.number}</h1>
        <h2 class="subtitle">${escapeHtml(c.title)}</h2>
        ${paragraphs(c.polishedText ?? c.originalText)}
      </section>`
    )
    .join('\n');

  const indexSection =
    book.indexEntries.length > 0
      ? `<section class="chapter">
          <h1>Index</h1>
          ${book.indexEntries
            .map(
              (e) =>
                `<p class="index-line"><strong>${escapeHtml(e.term)}</strong> — ${e.chapterNumbers
                  .map((n) => `Ch. ${n}`)
                  .join(', ')}</p>`
            )
            .join('\n')}
        </section>`
      : '';

  const introSection = book.introduction
    ? `<section class="chapter">
        <h1>Introduction</h1>
        ${paragraphs(book.introduction)}
      </section>`
    : '';

  const tocSection = `<section class="chapter toc">
    <h1>Table of Contents</h1>
    <ol>
      ${book.chapters.map((c) => `<li>Chapter ${c.number}: ${escapeHtml(c.title)}</li>`).join('\n')}
    </ol>
  </section>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(book.meta.title || 'Untitled')}</title>
<style>
  @page { size: 6in 9in; margin: 0.75in; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1c1b19; line-height: 1.65; }
  .cover-page { page-break-after: always; text-align: center; }
  .cover-page svg { width: 100%; max-width: 4.5in; height: auto; }
  h1 { font-size: 1.9em; margin-bottom: 0.1em; }
  h2.subtitle { font-weight: normal; font-style: italic; color: #6b2737; margin-top: 0; }
  .chapter { page-break-before: always; }
  .toc ol { list-style: none; padding: 0; }
  .toc li { padding: 0.3em 0; border-bottom: 1px dotted #ccc; }
  p { text-indent: 1.2em; margin: 0 0 0.9em 0; }
  p:first-of-type { text-indent: 0; }
  .index-line { text-indent: 0; }
  @media print {
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
  <div class="cover-page">${coverSvg}</div>
  ${tocSection}
  ${introSection}
  ${chapterSections}
  ${indexSection}
</body>
</html>`;
}
