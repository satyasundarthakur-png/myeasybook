import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  TextRun,
  ImageRun,
} from 'docx';
import type { BookState } from '../types/book';
import { resolveCoverImageDataUrl, mimeTypeFromDataUrl } from './coverGenerator';
import { buildExportUnits } from './exportUnits';

function bodyParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n\n+/)
    .map((p) => new Paragraph({ children: [new TextRun(p.trim())], spacing: { after: 200 } }));
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// docx's ImageRun only accepts a fixed set of type strings. Map the actual
// resolved mime type to the closest one instead of assuming every cover is
// a PNG (previously true only because the generator always produced PNG;
// now the generated cover is JPEG, and an author-uploaded cover could be
// PNG, JPEG, GIF, BMP, or WebP).
function docxImageType(mime: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('bmp')) return 'bmp';
  return 'png'; // covers png and anything else (e.g. webp — docx has no native
  // webp support, but browsers will still have re-encoded the canvas output
  // as one of the above via resolveCoverImageDataUrl for generated covers;
  // an uploaded webp is a known edge case worth revisiting if it comes up)
}

export async function buildDocx(book: BookState): Promise<Blob> {
  const children: Paragraph[] = [];

  // Cover page — embeds the actual designed/uploaded cover image, not just
  // plain text. Previously this section only wrote the title and author as
  // text, silently dropping whatever cover the author designed or uploaded.
  const coverDataUrl = await resolveCoverImageDataUrl(book.cover);
  children.push(
    new Paragraph({
      children: [
        new ImageRun({
          type: docxImageType(mimeTypeFromDataUrl(coverDataUrl)),
          data: dataUrlToUint8Array(coverDataUrl),
          transformation: { width: 400, height: 600 },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
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
  const units = buildExportUnits(book);
  children.push(new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_1 }));
  for (const unit of units) {
    children.push(
      new Paragraph({ text: `${unit.number}. ${unit.title}` })
    );
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Chapters
  for (const unit of units) {
    children.push(
      new Paragraph({ text: unit.title, heading: HeadingLevel.HEADING_1 }),
      ...bodyParagraphs(unit.body),
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
