import { create } from 'zustand';
import type { BookState, Stage } from '../types/book';
import { parseUploadedFile } from '../lib/docParser';
import { detectChapters } from '../lib/chapterDetector';
import { cleanManuscriptText } from '../lib/textCleanup';
import { groupChapters } from '../lib/chapterGrouper';
import { extractIndexEntries, generateIntroduction, polishChapterText } from '../lib/aiWriter';
import { sleep } from '../lib/shared';

interface BookActions {
  setStage: (s: Stage) => void;
  setMeta: (patch: Partial<BookState['meta']>) => void;
  setGroqSettings: (apiKey: string, model: string) => void;
  setCover: (patch: Partial<BookState['cover']>) => void;
  uploadFile: (file: File) => Promise<void>;
  polishAllChapters: () => Promise<void>;
  polishSingleChapter: (id: string) => Promise<void>;
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
  return { apiKey: '', model: 'openai/gpt-oss-120b' };
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
  groups: [],
  introduction: null,
  indexEntries: [],
  cover: { title: '', subtitle: '', author: '', palette: 'leather', layout: 'classic', customImage: null },
  groqApiKey: initialGroq.apiKey,
  groqModel: initialGroq.model,
  isProcessing: false,
  processingMessage: '',
  polishProgress: null,
  indexProgress: null,
  lastCleanupNote: null,
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
      const { text: cleanedText, report } = cleanManuscriptText(parsed.rawText);

      let cleanupNote: string | null = null;
      if (report.strippedViewerChrome || report.strippedHeaderLines > 0) {
        const parts: string[] = [];
        if (report.strippedViewerChrome) parts.push('removed web page navigation text');
        if (report.strippedHeaderLines > 0) parts.push(`removed ${report.strippedHeaderLines} repeated running-header lines`);
        cleanupNote = `Cleaned up the manuscript before detecting chapters: ${parts.join(' and ')}.`;
      }

      set({ processingMessage: 'Detecting chapters…' });
      const { apiKey, model } = { apiKey: get().groqApiKey, model: get().groqModel };
      const { chapters } = await detectChapters(cleanedText, apiKey ? { apiKey, model } : null);
      const groups = groupChapters(chapters);

      const guessedTitle = file.name.replace(/\.(docx|txt|md)$/i, '').replace(/[_-]+/g, ' ');
      set((s) => ({
        chapters,
        groups,
        meta: { ...s.meta, title: s.meta.title || guessedTitle },
        cover: { ...s.cover, title: s.cover.title || guessedTitle },
        stage: 'chapters',
        isProcessing: false,
        processingMessage: '',
        lastCleanupNote: cleanupNote,
      }));
    } catch (err) {
      set({ isProcessing: false, processingMessage: '' });
      throw err;
    }
  },

  polishSingleChapter: async (id: string) => {
    const { chapters, groqApiKey, groqModel } = get();
    const chapter = chapters.find((c) => c.id === id);
    if (!chapter) return;

    set({
      chapters: get().chapters.map((c) => (c.id === id ? { ...c, status: 'polishing' } : c)),
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

  /**
   * Processes chapters sequentially (Groq's per-minute rate limits make
   * concurrent bursts counterproductive on large manuscripts) with a small
   * pacing delay between calls, and reports progress as processed/succeeded/
   * failed counts rather than the chapter's own (possibly non-sequential,
   * possibly per-group) number — that mismatch was the source of the
   * "chapter 740 of 2914 but only 19 polished" confusion.
   */
  polishAllChapters: async () => {
    const { chapters } = get();
    const total = chapters.length;
    set({
      isProcessing: true,
      polishProgress: { total, processed: 0, succeeded: 0, failed: 0 },
    });

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const progressSoFar = get().polishProgress!;
      const percent = total > 0 ? Math.round((progressSoFar.processed / total) * 100) : 0;
      set({
        processingMessage: `Polishing ${progressSoFar.processed}/${total} (${percent}%) — ${progressSoFar.failed} failed so far`,
      });

      let succeeded = false;
      try {
        await get().polishSingleChapter(chapter.id);
        succeeded = true;
      } catch {
        succeeded = false;
      }

      set((s) => ({
        polishProgress: s.polishProgress
          ? {
              ...s.polishProgress,
              processed: s.polishProgress.processed + 1,
              succeeded: s.polishProgress.succeeded + (succeeded ? 1 : 0),
              failed: s.polishProgress.failed + (succeeded ? 0 : 1),
            }
          : null,
      }));

      // Small pacing delay between requests. groq.ts already retries
      // individual 429s with backoff; this just avoids triggering the
      // rate limit in the first place on very large manuscripts.
      if (i < chapters.length - 1) await sleep(150);
    }

    const final = get().polishProgress;
    set({
      isProcessing: false,
      processingMessage: final ? `Done: ${final.succeeded}/${final.total} polished, ${final.failed} failed` : '',
    });
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
    const total = chapters.length;
    set({
      isProcessing: true,
      processingMessage: `Extracting index terms… (0/${total})`,
      indexProgress: { total, processed: 0 },
    });
    try {
      const entries = await extractIndexEntries(chapters, groqApiKey, groqModel, (processed, totalBatches) => {
        const percent = totalBatches > 0 ? Math.round((processed / totalBatches) * 100) : 0;
        set({
          processingMessage: `Extracting index terms… ${percent}% (${processed}/${totalBatches} batches)`,
          indexProgress: { total: totalBatches, processed },
        });
      });
      set({ indexEntries: entries, isProcessing: false, processingMessage: '', indexProgress: null });
    } catch (err) {
      set({ isProcessing: false, processingMessage: '', indexProgress: null });
      throw err;
    }
  },

  reset: () =>
    set({
      ...initialState,
      groqApiKey: get().groqApiKey,
      groqModel: get().groqModel,
    }),
}));
