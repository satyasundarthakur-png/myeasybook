import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export interface ParsedDocument {
  rawText: string;
  html: string;
}

/**
 * Extracts raw text from a PDF, page by page. pdf.js returns individual
 * positioned text fragments per page rather than paragraphs, so fragments
 * are joined with spaces within a page and pages are separated with a
 * blank-line gap — close enough to mammoth's own paragraph-per-blank-line
 * convention that the existing cleanup pipeline (running-header stripping,
 * paragraph reflow) handles the result the same way it handles a scanned
 * .docx, including stripping repeated PDF page headers/footers.
 */
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) pageTexts.push(pageText);
  }

  return pageTexts.join('\n\n\n\n');
}

/**
 * Reads an uploaded .docx, .pdf, or .txt file and returns plain text (with
 * paragraph breaks preserved) plus an HTML version for .docx files, which
 * keeps heading tags around so chapter detection can use them.
 */
export async function parseUploadedFile(file: File): Promise<ParsedDocument> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    const textResult = await mammoth.extractRawText({ arrayBuffer });
    return { rawText: textResult.value, html: htmlResult.value };
  }

  if (name.endsWith('.pdf')) {
    const rawText = await extractPdfText(file);
    return { rawText, html: '' };
  }

  // Plain text fallback
  const text = await file.text();
  return { rawText: text, html: '' };
}
