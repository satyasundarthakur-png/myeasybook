import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  TextRun,
} from 'docx';
import type { BookState } from '../types/book';

function bodyParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n\n+/)
    .map((p) => new Paragraph({ children: [new TextRun(p.trim())], spacing: { after: 200 } }));
}

export async function buildDocx(book: BookState): Promise<Blob> {
  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({
      text: book.meta.title || 'Untitled',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 3000, after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: book.meta.author || '', italics: true })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // Introduction
  if (book.introduction) {
    children.push(
      new Paragraph({ text: 'Introduction', heading: HeadingLevel.HEADING_1 }),
      ...bodyParagraphs(book.introduction),
      new Paragraph({ children: [new PageBreak()] })
    );
  }

  // Table of contents (static, since Word's dynamic TOC needs field codes)
  children.push(new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_1 }));
  for (const chapter of book.chapters) {
    children.push(
      new Paragraph({ text: `Chapter ${chapter.number}: ${chapter.title}` })
    );
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Chapters
  for (const chapter of book.chapters) {
    const body = chapter.polishedText ?? chapter.originalText;
    children.push(
      new Paragraph({ text: `Chapter ${chapter.number}`, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        children: [new TextRun({ text: chapter.title, italics: true })],
        spacing: { after: 300 },
      }),
      ...bodyParagraphs(body),
      new Paragraph({ children: [new PageBreak()] })
    );
  }

  // Index
  if (book.indexEntries.length > 0) {
    children.push(new Paragraph({ text: 'Index', heading: HeadingLevel.HEADING_1 }));
    for (const entry of book.indexEntries) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: entry.term, bold: true }),
            new TextRun({ text: ` — ${entry.chapterNumbers.map((n) => `Ch. ${n}`).join(', ')}` }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBlob(doc);
}
