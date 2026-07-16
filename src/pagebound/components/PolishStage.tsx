import { useState } from 'react';
import { Sparkles, ArrowRight, Check, Loader2, AlertCircle } from 'lucide-react';
import { useBookStore, chapterProgressLabel } from '../store/useBookStore';

export default function PolishStage() {
  const { chapters, polishAllChapters, polishOneChapter, updateChapterText, setStage, groqApiKey } =
    useBookStore();
  const [activeId, setActiveId] = useState(chapters[0]?.id ?? null);
  const active = chapters.find((c) => c.id === activeId) ?? chapters[0];
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 border-r border-ink-faint py-6 px-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-xs text-paper/50">{chapterProgressLabel(chapters)}</p>
          <button
            disabled={!groqApiKey}
            onClick={async () => {
              setError(null);
              try {
                await polishAllChapters();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
            className="flex items-center gap-1.5 text-xs bg-brass hover:bg-brass-bright text-ink font-semibold px-3 py-1.5 rounded-sm disabled:opacity-30"
          >
            <Sparkles size={13} /> Polish all
          </button>
        </div>
        <div className="space-y-1">
          {chapters.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-sm text-sm ${
                c.id === active?.id ? 'bg-ink-soft text-paper-bright' : 'text-paper/60 hover:bg-ink-soft/50'
              }`}
            >
              {c.status === 'polished' && <Check size={13} className="text-moss-bright shrink-0" />}
              {c.status === 'polishing' && <Loader2 size={13} className="animate-spin text-brass shrink-0" />}
              {c.status === 'error' && <AlertCircle size={13} className="text-leather-bright shrink-0" />}
              {c.status === 'raw' && <span className="w-[13px] shrink-0" />}
              <span className="truncate">Ch. {c.number}: {c.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-8 px-8">
        {!groqApiKey && (
          <div className="mb-6 border border-brass/40 bg-brass/10 text-brass-bright text-sm font-body px-4 py-3 rounded-sm">
            Add a Groq API key (top right) to run AI polishing. You can still skip ahead and export the
            manuscript as-is.
          </div>
        )}
        {error && <p className="mb-4 text-sm text-leather-bright">{error}</p>}

        {active && (
          <div>
            <h2 className="font-display text-2xl text-paper-bright mb-4">
              Chapter {active.number}: {active.title}
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="font-mono text-xs text-paper/40 mb-2">ORIGINAL</p>
                <div className="bg-ink-soft border border-ink-faint rounded-sm p-4 h-[60vh] overflow-y-auto whitespace-pre-wrap font-body text-sm text-paper/70 leading-relaxed">
                  {active.originalText}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono text-xs text-paper/40">POLISHED (editable)</p>
                  <button
                    disabled={!groqApiKey || active.status === 'polishing'}
                    onClick={async () => {
                      setError(null);
                      try {
                        await polishOneChapter(active.id);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-brass-bright hover:text-brass disabled:opacity-30"
                  >
                    <Sparkles size={12} /> {active.status === 'polishing' ? 'Polishing…' : 'Re-polish'}
                  </button>
                </div>
                <textarea
                  value={active.polishedText ?? ''}
                  placeholder={active.status === 'polished' ? '' : 'Not polished yet — click "Polish all" or "Re-polish".'}
                  onChange={(e) => updateChapterText(active.id, e.target.value)}
                  className="w-full bg-ink-soft border border-ink-faint rounded-sm p-4 h-[60vh] resize-none font-body text-sm text-paper-bright leading-relaxed"
                />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setStage('front-matter')}
          className="mt-8 flex items-center gap-2 bg-brass hover:bg-brass-bright text-ink font-semibold px-5 py-2.5 rounded-sm"
        >
          Continue to introduction <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
