export type Stage =
  | 'upload'
  | 'chapters'
  | 'ocr-fix'
  | 'polish'
  | 'front-matter'
  | 'index'
  | 'cover'
  | 'export';

export interface Chapter {
  id: string;
  number: number;
  title: string;
  originalText: string;
  /** Result of the optional OCR-error-correction pass. When present, this
   * (not originalText) is what Polish and every export actually use — the
   * original stays untouched so the user can always compare against it. */
  ocrFixedText: string | null;
  ocrStatus: 'raw' | 'fixing' | 'fixed' | 'error';
  polishedText: string | null;
  status: 'raw' | 'polishing' | 'polished' | 'error';
  wordCount: number;
}

/**
 * A group of chapters shown together in the UI (e.g. "Chapter 3" containing
 * 40 verses, or a synthesized "Section 5" batch for manuscripts with no
 * natural higher-level structure). Every Chapter belongs to exactly one
 * group; flat manuscripts get a single implicit group.
 */
export interface ChapterGroup {
  id: string;
  number: number;
  title: string;
  chapterIds: string[];
}

export interface PolishProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
}

export interface IndexEntry {
  term: string;
  chapterNumbers: number[];
}

export interface CoverConfig {
  title: string;
  subtitle: string;
  author: string;
  palette: 'leather' | 'brass' | 'moss' | 'ink';
  layout: 'classic' | 'modern' | 'literary';
  /** Data URL of an author-uploaded cover image. When set, this replaces
   * the procedurally generated SVG cover in every export. */
  customImage: string | null;
  /** Back-cover blurb/synopsis text. Rendered on a procedurally generated
   * back cover unless backCoverImage is set. */
  backCoverText: string;
  /** Author-uploaded back-cover image, taking priority over the generated
   * one — same pattern as customImage for the front cover. */
  backCoverImage: string | null;
}

/**
 * A record of a completed export, kept in memory only (not persisted
 * across page reloads) so the last few can be re-downloaded without
 * regenerating. EPUB/DOCX keep the actual generated Blob for a byte-
 * identical re-download; print-to-PDF has no discrete file object (it
 * opens a browser print view), so it re-opens that view from current
 * book state instead.
 */
export interface ExportHistoryEntry {
  id: string;
  filename: string;
  format: 'epub' | 'docx' | 'pdf';
  sizeBytes: number;
  timestamp: number;
  blob: Blob | null;
}

export interface BookMeta {
  title: string;
  author: string;
  language: string;
  description: string;
}

export interface BookState {
  stage: Stage;
  meta: BookMeta;
  chapters: Chapter[];
  groups: ChapterGroup[];
  introduction: string | null;
  indexEntries: IndexEntry[];
  cover: CoverConfig;
  aiProvider: 'groq' | 'gemini';
  groqApiKey: string;
  groqModel: string;
  geminiApiKey: string;
  geminiModel: string;
  isProcessing: boolean;
  processingMessage: string;
  polishProgress: PolishProgress | null;
  ocrFixProgress: PolishProgress | null;
  indexProgress: { total: number; processed: number } | null;
  lastBatchError: string | null;
  lastCleanupNote: string | null;
  exportHistory: ExportHistoryEntry[];
}
