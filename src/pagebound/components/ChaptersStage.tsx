import { ArrowRight } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';

export default function ChaptersStage() {
  const { chapters, setStage } = useBookStore();

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <h1 className="font-display text-3xl text-paper-bright mb-2">Detected chapters</h1>
      <p className="font-body text-paper/60 mb-8">
        Review the chapter breaks below. Edit any title, then continue to polishing.
      </p>

      <div className="space-y-3">
        {chapters.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-4 bg-ink-soft border border-ink-faint rounded-sm px-4 py-3"
          >
            <span className="font-mono text-brass w-10 shrink-0">#{c.number}</span>
            <input
              value={c.title}
              onChange={(e) =>
                useBookStore.setState((s) => ({
                  chapters: s.chapters.map((ch) => (ch.id === c.id ? { ...ch, title: e.target.value } : ch)),
                }))
              }
              className="flex-1 bg-transparent text-paper-bright font-body border-b border-transparent focus:border-brass px-1 py-1"
            />
            <span className="font-mono text-xs text-paper/40 w-24 text-right">{c.wordCount} words</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setStage('polish')}
        className="mt-8 flex items-center gap-2 bg-brass hover:bg-brass-bright text-ink font-semibold px-5 py-2.5 rounded-sm"
      >
        Continue to polishing <ArrowRight size={16} />
      </button>
    </div>
  );
}
