import { create } from 'zustand';
import type { BookState, Chapter, Stage } from '../types/book';
import { parseUploadedFile } from '../lib/docParser';
import { detectChapters } from '../lib/chapterDetector';
import { extractIndexEntries, generateIntroduction, polishChapterText } from '../lib/aiWriter';

interface BookActions {
  setStage: (s: Stage) => void;
  setMeta: (patch: Partial<BookState['meta']>) => void;
  setGroqSettings: (apiKey: string, model: string) => void;
  setCover: (patch: Partial<BookState['cover']>) => void;
  uploadFile: (file: File) => Promise<void>;
  polishAllChapters: () => Promise<void>;
  polishOneChapter: (id: string) => Promise<void>;
  updateChapterText: (id: string, text: string) => void;
  generateIntro: () => Promise<void>;
  buildIndex: () => Promise<void>;
  reset: () => void;
}

const STORAGE_KEY = 'pagebound-groq-settings';

function loadGroqSettings(): { apiKey: string; model: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { apiKey: '', model: 'llama-3.3-70b-versatile' };
}

function saveGroqSettings(apiKey: string, model: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey, model }));
  } catch {
    // ignore
  }
}

const initialGroq = loadGroqSettings();

const initialState: BookState = {
  stage: 'upload',
  meta: { title: '', author: '', language: 'en', description: '' },
  chapters: [],
  introduction: null,
  indexEntries: [],
  cover: { title: '', subtitle: '', author: '', palette: 'leather', layout: 'classic' },
  groqApiKey: initialGroq.apiKey,
  groqModel: initialGroq.model,
  isProcessing: false,
  processingMessage: '',
};

export const useBookStore = create<BookState & BookActions>((set, get) => ({
  ...initialState,

  setStage: (stage) => set({ stage }),

  setMeta: (patch) =>
    set((s) => ({
      meta: { ...s.meta, ...patch },
      cover: { ...s.cover, title: patch.title ?? s.cover.title, author: patch.author ?? s.cover.author },
    })),

  setGroqSettings: (apiKey, model) => {
    saveGroqSettings(apiKey, model);
    set({ groqApiKey: apiKey, groqModel: model });
  },

  setCover: (patch) => set((s) => ({ cover: { ...s.cover, ...patch } })),

  uploadFile: async (file: File) => {
    set({ isProcessing: true, processingMessage: 'Reading uploaded file…' });
    try {
      const parsed = await parseUploadedFile(file);
      set({ processingMessage: 'Detecting chapters…' });
      const { apiKey, model } = { apiKey: get().groqApiKey, model: get().groqModel };
      const { chapters } = await detectChapters(parsed.rawText, apiKey ? { apiKey, model } : null);

      const guessedTitle = file.name.replace(/\.(docx|txt|md)$/i, '').replace(/[_-]+/g, ' ');
      set((s) => ({
        chapters,
        meta: { ...s.meta, title: s.meta.title || guessedTitle },
        cover: { ...s.cover, title: s.cover.title || guessedTitle },
        stage: 'chapters',
        isProcessing: false,
        processingMessage: '',
      }));
    } catch (err) {
      set({ isProcessing: false, processingMessage: '' });
      throw err;
    }
  },

  polishOneChapter: async (id: string) => {
    const { chapters, groqApiKey, groqModel } = get();
    const chapter = chapters.find((c) => c.id === id);
    if (!chapter) return;

    set({
      chapters: chapters.map((c) => (c.id === id ? { ...c, status: 'polishing' } : c)),
    });

    try {
      const polished = await polishChapterText(chapter.originalText, groqApiKey, groqModel);
      set((s) => ({
        chapters: s.chapters.map((c) =>
          c.id === id ? { ...c, polishedText: polished, status: 'polished' } : c
        ),
      }));
    } catch (err) {
      set((s) => ({
        chapters: s.chapters.map((c) => (c.id === id ? { ...c, status: 'error' } : c)),
      }));
      throw err;
    }
  },

  polishAllChapters: async () => {
    const { chapters } = get();
    set({ isProcessing: true });
    for (const chapter of chapters) {
      set({ processingMessage: `Polishing Chapter ${chapter.number} of ${chapters.length}…` });
      try {
        await get().polishOneChapter(chapter.id);
      } catch {
        // continue with remaining chapters even if one fails
      }
    }
    set({ isProcessing: false, processingMessage: '' });
  },

  updateChapterText: (id, text) =>
    set((s) => ({
      chapters: s.chapters.map((c) => (c.id === id ? { ...c, polishedText: text } : c)),
    })),

  generateIntro: async () => {
    const { chapters, meta, groqApiKey, groqModel } = get();
    set({ isProcessing: true, processingMessage: 'Writing introduction…' });
    try {
      const intro = await generateIntroduction(chapters, meta.title || 'this book', groqApiKey, groqModel);
      set({ introduction: intro, isProcessing: false, processingMessage: '' });
    } catch (err) {
      set({ isProcessing: false, processingMessage: '' });
      throw err;
    }
  },

  buildIndex: async () => {
    const { chapters, groqApiKey, groqModel } = get();
    set({ isProcessing: true, processingMessage: 'Extracting index terms…' });
    try {
      const entries = await extractIndexEntries(chapters, groqApiKey, groqModel);
      set({ indexEntries: entries, isProcessing: false, processingMessage: '' });
    } catch (err) {
      set({ isProcessing: false, processingMessage: '' });
      throw err;
    }
  },

  reset: () => set({ ...initialState, groqApiKey: get().groqApiKey, groqModel: get().groqModel }),
}));

export function chapterProgressLabel(chapters: Chapter[]): string {
  const polished = chapters.filter((c) => c.status === 'polished').length;
  return `${polished}/${chapters.length} polished`;
}
