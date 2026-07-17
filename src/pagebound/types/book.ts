export type Stage =
  | 'upload'
  | 'chapters'
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
  groqApiKey: string;
  groqModel: string;
  isProcessing: boolean;
  processingMessage: string;
  polishProgress: PolishProgress | null;
  indexProgress: { total: number; processed: number } | null;
}
