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
import { resolveCoverImageDataUrl, resolveBackCoverImageDataUrl, mimeTypeFromDataUrl } from './coverGenerator';
import { buildExportUnits } from './exportUnits';

// Traditional book typesetting: first-line indent instead of a gap between
// paragraphs, with the first paragraph of each section un-indented — the
// same convention epubBuilder.ts and printBuilder.ts already use via CSS
// (text-indent: 1.2em; p:first-of-type { text-indent: 0 }). DOCX previously
// had neither: paragraphs used a spacing-after gap and no indent at all,
// which reads as block/business-document formatting rather than a
// typeset book page — confirmed directly in a real exported file's XML
// (every paragraph had <w:spacing w:after="200"/> and no <w:ind> at all).
function bodyParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n\n+/)
    .map(
      (p, i) =>
        new Paragraph({
          children: [new TextRun(p.trim())],
          indent: i === 0 ? undefined : { firstLine: 432 }, // 0.3in, matching the ~1.2em used elsewhere
          spacing: { after: 0 },
        })
    );
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

// A dedicated 6x9in trade-book page size (the cover images are generated at
// a matching 2:3 ratio) with zero margins, so the cover image fills the
// entire page edge-to-edge instead of appearing as a small picture centered
// on a default 8.5x11in Letter page with 1in margins — confirmed directly
// as the cause of "cover doesn't fill the page": a 400x600px image on a
// 6.5x9in content area (Letter minus margins) left most of the page blank.
const COVER_PAGE = {
  size: { width: 8640, height: 12960 }, // 6in x 9in, in twips (1440/in)
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
};
const COVER_IMAGE_PX = { width: 576, height: 864 }; // 6x9in at 96dpi, filling COVER_PAGE exactly

async function buildCoverPageChildren(dataUrl: string): Promise<Paragraph[]> {
  return [
    new Paragraph({
      children: [
        new ImageRun({
          type: docxImageType(mimeTypeFromDataUrl(dataUrl)),
          data: dataUrlToUint8Array(dataUrl),
          transformation: COVER_IMAGE_PX,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
    }),
  ];
}

export async function buildDocx(book: BookState): Promise<Blob> {
  const mainChildren: Paragraph[] = [];

  // Introduction
  if (book.introduction) {
    mainChildren.push(
      new Paragraph({ text: 'Introduction', heading: HeadingLevel.HEADING_1 }),
      ...bodyParagraphs(book.introduction),
      new Paragraph({ children: [new PageBreak()] })
    );
  }

  // Table of contents (static, since Word's dynamic TOC needs field codes)
  const units = buildExportUnits(book);
  mainChildren.push(new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_1 }));
  for (const unit of units) {
    mainChildren.push(new Paragraph({ text: `${unit.number}. ${unit.title}` }));
  }
  mainChildren.push(new Paragraph({ children: [new PageBreak()] }));

  // Chapters
  for (const unit of units) {
    mainChildren.push(
      new Paragraph({ text: unit.title, heading: HeadingLevel.HEADING_1 }),
      ...bodyParagraphs(unit.body),
      new Paragraph({ children: [new PageBreak()] })
    );
  }

  // Index
  if (book.indexEntries.length > 0) {
    mainChildren.push(new Paragraph({ text: 'Index', heading: HeadingLevel.HEADING_1 }));
    for (const entry of book.indexEntries) {
      mainChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: entry.term, bold: true }),
            new TextRun({ text: ` — ${entry.chapterNumbers.map((n) => `Ch. ${n}`).join(', ')}` }),
          ],
        })
      );
    }
  }

  const frontCoverDataUrl = await resolveCoverImageDataUrl(book.cover);
  const backCoverDataUrl = await resolveBackCoverImageDataUrl(book.cover);

  const doc = new Document({
    sections: [
      { properties: { page: COVER_PAGE }, children: await buildCoverPageChildren(frontCoverDataUrl) },
      { properties: {}, children: mainChildren },
      { properties: { page: COVER_PAGE }, children: await buildCoverPageChildren(backCoverDataUrl) },
    ],
  });

  return Packer.toBlob(doc);
}
