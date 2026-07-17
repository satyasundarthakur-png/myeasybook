import type { BookState } from '../types/book';
import { resolveCoverImageDataUrl, resolveBackCoverImageDataUrl } from './coverGenerator';
import { escapeXml as escapeHtml } from './shared';
import { buildExportUnits } from './exportUnits';

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
export async function buildPrintableHtml(book: BookState): Promise<string> {
  const coverDataUrl = await resolveCoverImageDataUrl(book.cover);
  const backCoverDataUrl = await resolveBackCoverImageDataUrl(book.cover);
  const units = buildExportUnits(book);

  const chapterSections = units
    .map(
      (u) => `
      <section class="chapter">
        <h1>${escapeHtml(u.title)}</h1>
        ${paragraphs(u.body)}
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
      ${units.map((u) => `<li>${u.number}. ${escapeHtml(u.title)}</li>`).join('\n')}
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
  /* Cover pages bleed to the true page edge — offsetting the @page margin
     with a matching negative margin, rather than being confined to the
     0.75in content box like the rest of the book. Confirmed this was the
     cause of "cover doesn't fill the page": at max-width 4.5in inside a
     4.5x7.5in content area, the cover never reached the actual page edge. */
  .cover-page {
    page-break-after: always;
    margin: -0.75in;
    width: 6in;
    height: 9in;
    overflow: hidden;
  }
  .cover-page img { display: block; width: 6in; height: 9in; object-fit: cover; }
  .back-cover-page {
    margin: -0.75in;
    width: 6in;
    height: 9in;
    overflow: hidden;
  }
  .back-cover-page img { display: block; width: 6in; height: 9in; object-fit: cover; }
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
  <div class="cover-page"><img src="${coverDataUrl}" alt="Cover" /></div>
  ${tocSection}
  ${introSection}
  ${chapterSections}
  ${indexSection}
  <div class="chapter back-cover-page"><img src="${backCoverDataUrl}" alt="Back cover" /></div>
</body>
</html>`;
}
