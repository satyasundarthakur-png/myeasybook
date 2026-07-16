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
  introduction: string | null;
  indexEntries: IndexEntry[];
  cover: CoverConfig;
  groqApiKey: string;
  groqModel: string;
  isProcessing: boolean;
  processingMessage: string;
}
