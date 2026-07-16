import mammoth from 'mammoth';

export interface ParsedDocument {
  rawText: string;
  html: string;
}

/**
 * Reads an uploaded .docx or .txt/.md file and returns plain text (with
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

  // Plain text / markdown fallback
  const text = await file.text();
  return { rawText: text, html: '' };
}
