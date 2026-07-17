import { create } from 'zustand';
import type { AiProviderId } from '../lib/aiTypes';
import type { BookState, Stage, ExportHistoryEntry } from '../types/book';
import { parseUploadedFile } from '../lib/docParser';
import { detectChapters } from '../lib/chapterDetector';
import { cleanManuscriptText } from '../lib/textCleanup';
import { groupChapters } from '../lib/chapterGrouper';
import { extractIndexEntries, generateIntroduction, polishChapterText } from '../lib/aiWriter';
import { fixChapterOcrErrors } from '../lib/ocrFix';
import { sleep, makeId } from '../lib/shared';

interface BookActions {
  setStage: (s: Stage) => void;
  setMeta: (patch: Partial<BookState['meta']>) => void;
  setAiProvider: (provider: AiProviderId) => void;
  setGroqSettings: (apiKey: string, model: string) => void;
  setGeminiSettings: (apiKey: string, model: string) => void;
  setCover: (patch: Partial<BookState['cover']>) => void;
  uploadFile: (file: File) => Promise<void>;
  fixSingleChapterOcr: (id: string) => Promise<void>;
  fixAllChaptersOcr: () => Promise<void>;
  polishAllChapters: () => Promise<void>;
  polishSingleChapter: (id: string) => Promise<void>;
  updateChapterText: (id: string, text: string) => void;
  updateChapterOcrFixedText: (id: string, text: string) => void;
  generateIntro: () => Promise<void>;
  buildIndex: () => Promise<void>;
  addExportHistoryEntry: (entry: Omit<ExportHistoryEntry, 'id' | 'timestamp'>) => void;
  reset: () => void;
}

// Kept as its own key (not folded into a combined settings object) so
// existing saved Groq keys from before Gemini support was added keep
// working without any migration step.
const GROQ_STORAGE_KEY = 'pagebound-groq-settings';
const GEMINI_STORAGE_KEY = 'pagebound-gemini-settings';
const PROVIDER_STORAGE_KEY = 'pagebound-ai-provider';

function loadGroqSettings(): { apiKey: string; model: string } {
  try {
    const raw = localStorage.getItem(GROQ_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { apiKey: '', model: 'openai/gpt-oss-120b' };
}

function saveGroqSettings(apiKey: string, model: string) {
  try {
    localStorage.setItem(GROQ_STORAGE_KEY, JSON.stringify({ apiKey, model }));
  } catch {
    // ignore
  }
}

function loadGeminiSettings(): { apiKey: string; model: string } {
  try {
    const raw = localStorage.getItem(GEMINI_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { apiKey: '', model: 'gemini-2.5-flash-lite' };
}

function saveGeminiSettings(apiKey: string, model: string) {
  try {
    localStorage.setItem(GEMINI_STORAGE_KEY, JSON.stringify({ apiKey, model }));
  } catch {
    // ignore
  }
}

function loadAiProvider(): AiProviderId {
  try {
    const raw = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (raw === 'gemini' || raw === 'groq') return raw;
  } catch {
    // ignore
  }
  return 'groq'; // Groq is the default/primary provider
}

function saveAiProvider(provider: AiProviderId) {
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  } catch {
    // ignore
  }
}

const initialGroq = loadGroqSettings();
const initialGemini = loadGeminiSettings();
const initialProvider = loadAiProvider();

const initialState: BookState = {
  stage: 'upload',
  meta: { title: '', author: '', language: 'en', description: '' },
  chapters: [],
  groups: [],
  introduction: null,
  indexEntries: [],
  cover: { title: '', subtitle: '', author: '', palette: 'leather', layout: 'classic', customImage: null, backCoverText: '', backCoverImage: null },
  aiProvider: initialProvider,
  groqApiKey: initialGroq.apiKey,
  groqModel: initialGroq.model,
  geminiApiKey: initialGemini.apiKey,
  geminiModel: initialGemini.model,
  isProcessing: false,
  processingMessage: '',
  polishProgress: null,
  ocrFixProgress: null,
  indexProgress: null,
  lastCleanupNote: null,
  lastBatchError: null,
  exportHistory: [],
};

export const useBookStore = create<BookState & BookActions>((set, get) => ({
  ...initialState,

  setStage: (stage) => set({ stage }),

  setMeta: (patch) =>
    set((s) => ({
      meta: { ...s.meta, ...patch },
      cover: { ...s.cover, title: patch.title ?? s.cover.title, author: patch.author ?? s.cover.author },
    })),

  setAiProvider: (provider) => {
    saveAiProvider(provider);
    set({ aiProvider: provider });
  },

  setGroqSettings: (apiKey, model) => {
    saveGroqSettings(apiKey, model);
    set({ groqApiKey: apiKey, groqModel: model });
  },

  setGeminiSettings: (apiKey, model) => {
    saveGeminiSettings(apiKey, model);
    set({ geminiApiKey: apiKey, geminiModel: model });
  },

  setCover: (patch) => set((s) => ({ cover: { ...s.cover, ...patch } })),

  uploadFile: async (file: File) => {
    set({ isProcessing: true, processingMessage: 'Reading uploaded file…' });
    try {
      const parsed = await parseUploadedFile(file);
      const { text: cleanedText, report } = cleanManuscriptText(parsed.rawText);

      let cleanupNote: string | null = null;
      if (report.strippedViewerChrome || report.strippedHeaderLines > 0 || report.reflowedParagraphs) {
        const parts: string[] = [];
        if (report.strippedViewerChrome) parts.push('removed web page navigation text');
        if (report.strippedHeaderLines > 0) parts.push(`removed ${report.strippedHeaderLines} repeated running-header lines`);
        if (report.reflowedParagraphs) parts.push('merged scanned-line fragments into flowing paragraphs');
        cleanupNote = `Cleaned up the manuscript before detecting chapters: ${parts.join(', ')}.`;
      }

      set({ processingMessage: 'Detecting chapters…' });
      const config = getActiveAiConfig(get());
      const { chapters: detected } = await detectChapters(cleanedText, config.apiKey ? config : null, parsed.html);

      // A source manuscript that already has its own "Introduction" heading
      // (e.g. a book re-uploaded after a previous Pagebound export) was
      // showing up twice: once correctly as front matter, once again as a
      // numbered chapter — confirmed in a real re-uploaded file. Route it
      // into the dedicated introduction field instead of leaving both.
      const introIdx = detected.findIndex((c) => /^introduction$/i.test(c.title.trim()));
      const extractedIntro = introIdx >= 0 ? detected[introIdx].originalText : null;
      const chapters =
        introIdx >= 0
          ? detected.filter((_, i) => i !== introIdx).map((c, i) => ({ ...c, number: i + 1 }))
          : detected;

      const groups = groupChapters(chapters);

      const guessedTitle = file.name.replace(/\.(docx|pdf|txt)$/i, '').replace(/[_-]+/g, ' ');
      set((s) => ({
        chapters,
        groups,
        introduction: s.introduction || extractedIntro,
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

  fixSingleChapterOcr: async (id: string) => {
    const { chapters, meta } = get();
    const chapter = chapters.find((c) => c.id === id);
    if (!chapter) return;

    set({
      chapters: get().chapters.map((c) => (c.id === id ? { ...c, ocrStatus: 'fixing' } : c)),
    });

    try {
      const fixedText = await fixChapterOcrErrors(
        chapter.originalText,
        { bookTitle: meta.title, bookAuthor: meta.author },
        getActiveAiConfig(get())
      );
      set((s) => ({
        chapters: s.chapters.map((c) =>
          c.id === id ? { ...c, ocrFixedText: fixedText, ocrStatus: 'fixed' } : c
        ),
      }));
    } catch (err) {
      set((s) => ({
        chapters: s.chapters.map((c) => (c.id === id ? { ...c, ocrStatus: 'error' } : c)),
      }));
      throw err;
    }
  },

  fixAllChaptersOcr: async () => {
    const { chapters } = get();
    const total = chapters.length;
    set({
      isProcessing: true,
      ocrFixProgress: { total, processed: 0, succeeded: 0, failed: 0 },
      lastBatchError: null,
    });

    const MAX_CONSECUTIVE_FAILURES = 5;
    let consecutiveFailures = 0;
    let stoppedEarly = false;

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const progressSoFar = get().ocrFixProgress!;
      const percent = total > 0 ? Math.round((progressSoFar.processed / total) * 100) : 0;
      set({
        processingMessage: `Fixing OCR errors ${progressSoFar.processed}/${total} (${percent}%) — ${progressSoFar.failed} failed so far`,
      });

      let succeeded = false;
      try {
        await get().fixSingleChapterOcr(chapter.id);
        succeeded = true;
        consecutiveFailures = 0;
      } catch (err) {
        succeeded = false;
        consecutiveFailures++;
        set({ lastBatchError: (err as Error).message });
      }

      set((s) => ({
        ocrFixProgress: s.ocrFixProgress
          ? {
              ...s.ocrFixProgress,
              processed: s.ocrFixProgress.processed + 1,
              succeeded: s.ocrFixProgress.succeeded + (succeeded ? 1 : 0),
              failed: s.ocrFixProgress.failed + (succeeded ? 0 : 1),
            }
          : null,
      }));

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        stoppedEarly = true;
        break;
      }

      if (i < chapters.length - 1) await sleep(150);
    }

    const final = get().ocrFixProgress;
    const lastError = get().lastBatchError;
    set({
      isProcessing: false,
      processingMessage: stoppedEarly
        ? `Stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row — likely a systemic issue, not per-chapter. Last error: ${lastError}`
        : final
          ? `Done: ${final.succeeded}/${final.total} fixed, ${final.failed} failed`
          : '',
    });
  },

  polishSingleChapter: async (id: string) => {
    const { chapters } = get();
    const chapter = chapters.find((c) => c.id === id);
    if (!chapter) return;

    set({
      chapters: get().chapters.map((c) => (c.id === id ? { ...c, status: 'polishing' } : c)),
    });

    try {
      const sourceText = chapter.ocrFixedText ?? chapter.originalText;
      const polished = await polishChapterText(sourceText, getActiveAiConfig(get()));
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
      lastBatchError: null,
    });

    const MAX_CONSECUTIVE_FAILURES = 5;
    let consecutiveFailures = 0;
    let stoppedEarly = false;

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
        consecutiveFailures = 0;
      } catch (err) {
        succeeded = false;
        consecutiveFailures++;
        set({ lastBatchError: (err as Error).message });
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

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        stoppedEarly = true;
        break;
      }

      // Small pacing delay between requests. groq.ts already retries
      // individual 429s with backoff; this just avoids triggering the
      // rate limit in the first place on very large manuscripts.
      if (i < chapters.length - 1) await sleep(150);
    }

    const final = get().polishProgress;
    const lastError = get().lastBatchError;
    set({
      isProcessing: false,
      processingMessage: stoppedEarly
        ? `Stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row — likely a systemic issue, not per-chapter. Last error: ${lastError}`
        : final
          ? `Done: ${final.succeeded}/${final.total} polished, ${final.failed} failed`
          : '',
    });
  },

  updateChapterText: (id, text) =>
    set((s) => ({
      chapters: s.chapters.map((c) => (c.id === id ? { ...c, polishedText: text } : c)),
    })),

  updateChapterOcrFixedText: (id: string, text: string) =>
    set((s) => ({
      chapters: s.chapters.map((c) =>
        c.id === id ? { ...c, ocrFixedText: text, ocrStatus: text.trim() ? 'fixed' : c.ocrStatus } : c
      ),
    })),

  generateIntro: async () => {
    const { chapters, meta } = get();
    set({ isProcessing: true, processingMessage: 'Writing introduction…' });
    try {
      const intro = await generateIntroduction(chapters, meta.title || 'this book', getActiveAiConfig(get()));
      set({ introduction: intro, isProcessing: false, processingMessage: '' });
    } catch (err) {
      set({ isProcessing: false, processingMessage: '' });
      throw err;
    }
  },

  buildIndex: async () => {
    const { chapters } = get();
    const total = chapters.length;
    set({
      isProcessing: true,
      processingMessage: `Extracting index terms… (0/${total})`,
      indexProgress: { total, processed: 0 },
    });
    try {
      const entries = await extractIndexEntries(chapters, getActiveAiConfig(get()), (processed, totalBatches) => {
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

  /** Records a completed export, keeping only the 3 most recent — older
   * ones are dropped automatically rather than accumulating indefinitely. */
  addExportHistoryEntry: (entry) =>
    set((s) => ({
      exportHistory: [
        { ...entry, id: makeId(), timestamp: Date.now() },
        ...s.exportHistory,
      ].slice(0, 3),
    })),

  reset: () =>
    set({
      ...initialState,
      aiProvider: get().aiProvider,
      groqApiKey: get().groqApiKey,
      groqModel: get().groqModel,
      geminiApiKey: get().geminiApiKey,
      geminiModel: get().geminiModel,
    }),
}));

/** Resolves the active provider's config from whichever fields are actually
 * populated — every AI call site uses this instead of picking groq/gemini
 * fields directly, so adding a third provider later only needs updating
 * this one function. */
function getActiveAiConfig(state: BookState): { provider: AiProviderId; apiKey: string; model: string } {
  if (state.aiProvider === 'gemini') {
    return { provider: 'gemini', apiKey: state.geminiApiKey, model: state.geminiModel };
  }
  return { provider: 'groq', apiKey: state.groqApiKey, model: state.groqModel };
}

/** True if the currently-selected provider has an API key saved. Every
 * stage's "add a key to unlock this" hint uses this instead of checking
 * groqApiKey directly, which would show a false warning when Gemini is
 * the active provider (and vice versa). */
export function useActiveAiKeyPresent(): boolean {
  return useBookStore((s) => Boolean(getActiveAiConfig(s).apiKey));
}
