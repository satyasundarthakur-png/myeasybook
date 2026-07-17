import { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Columns2,
  Rows2,
  RotateCw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useBookStore } from '../store/useBookStore';
import type { Chapter } from '../types/book';

export default function PolishStage() {
  const { chapters, groups, polishAllChapters, polishSingleChapter, updateChapterText, setStage, groqApiKey, polishProgress } =
    useBookStore();
  const [activeId, setActiveId] = useState(chapters[0]?.id ?? null);
  const active = chapters.find((c) => c.id === activeId) ?? chapters[0];
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<'side-by-side' | 'stacked'>('side-by-side');
  const [focusedPanel, setFocusedPanel] = useState<'original' | 'polished' | null>(null);

  const isGrouped = groups.length > 1;
  const activeGroup = groups.find((g) => g.chapterIds.includes(active?.id ?? ''));
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(activeGroup?.id ?? groups[0]?.id ?? null);

  const chapterById = new Map<string, Chapter>(chapters.map((c) => [c.id, c]));

  const percent = polishProgress && polishProgress.total > 0
    ? Math.round((polishProgress.processed / polishProgress.total) * 100)
    : null;

  return (
    <div className="flex h-full">
      {/* Sidebar: owns its own scroll, grouped for large manuscripts */}
      <div className="w-72 shrink-0 border-r border-paper-dim flex flex-col h-full bg-paper">
        <div className="p-4 border-b border-paper-dim shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs text-ink/50">
              {polishProgress
                ? `${polishProgress.succeeded}/${polishProgress.total} polished${polishProgress.failed ? ` · ${polishProgress.failed} failed` : ''}`
                : `${chapters.filter((c) => c.status === 'polished').length}/${chapters.length} polished`}
            </p>
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
              className="flex items-center gap-1.5 text-xs bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-3 py-1.5 disabled:opacity-30"
            >
              <Sparkles size={13} /> Polish all
            </button>
          </div>
          {percent !== null && (
            <div className="w-full h-1 bg-paper-dim overflow-hidden">
              <div
                className="h-full bg-crimson transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {groups.map((group) => {
            const groupChapters = group.chapterIds
              .map((id) => chapterById.get(id))
              .filter((c): c is Chapter => Boolean(c));
            const polishedCount = groupChapters.filter((c) => c.status === 'polished').length;
            const expanded = !isGrouped || expandedGroupId === group.id;

            return (
              <div key={group.id} className="mb-1">
                {isGrouped && (
                  <button
                    onClick={() => setExpandedGroupId(expanded ? null : group.id)}
                    className="w-full flex items-center gap-2 text-left px-2 py-2 text-sm text-ink/70 hover:bg-paper-dim/40"
                  >
                    {expanded ? <ChevronDown size={14} className="text-crimson shrink-0" /> : <ChevronRight size={14} className="text-crimson shrink-0" />}
                    <span className="truncate flex-1">{group.title}</span>
                    <span className="font-mono text-[10px] text-ink/40 shrink-0">
                      {polishedCount}/{groupChapters.length}
                    </span>
                  </button>
                )}
                {expanded && (
                  <div className={isGrouped ? 'pl-3 space-y-0.5' : 'space-y-0.5'}>
                    {groupChapters.map((c) => (
                      <div key={c.id} className="group relative">
                        <button
                          onClick={() => setActiveId(c.id)}
                          className={`w-full flex items-center gap-2 text-left pl-3 pr-8 py-1.5 text-sm ${
                            c.id === active?.id ? 'bg-paper-dim/60 text-ink' : 'text-ink/60 hover:bg-paper-dim/30'
                          }`}
                        >
                          {c.status === 'polished' && <Check size={13} className="text-moss shrink-0" />}
                          {c.status === 'polishing' && <Loader2 size={13} className="animate-spin text-crimson shrink-0" />}
                          {c.status === 'error' && <AlertCircle size={13} className="text-rust shrink-0" />}
                          {c.status === 'raw' && <span className="w-[13px] shrink-0" />}
                          <span className="truncate">
                            {c.number}. {c.title}
                          </span>
                        </button>
                        {c.status !== 'polishing' && (
                          <button
                            disabled={!groqApiKey}
                            title={c.status === 'polished' ? 'Re-polish this chapter' : 'Polish this chapter'}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setError(null);
                              try {
                                await polishSingleChapter(c.id);
                              } catch (err) {
                                setError((err as Error).message);
                              }
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-ink/35 hover:text-crimson opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 transition-opacity"
                          >
                            {c.status === 'polished' ? <RotateCw size={13} /> : <Sparkles size={13} />}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content: header + panels (each owns its own scroll) + pinned footer */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-paper-bright">
        <div className="flex-1 overflow-hidden flex flex-col px-8 py-6 min-h-0">
          {!groqApiKey && (
            <div className="mb-4 border border-brass/40 bg-brass/5 text-brass-dim text-sm font-body px-4 py-3 shrink-0">
              Add a Groq API key (AI Settings, bottom of the sidebar) to run AI polishing. You can still skip ahead and export the
              manuscript as-is.
            </div>
          )}
          {error && <p className="mb-4 text-sm text-rust shrink-0">{error}</p>}

          {active && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h2 className="font-display font-bold text-2xl text-ink truncate">
                  {active.number}. {active.title}
                </h2>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <button
                    onClick={() => {
                      setLayout('side-by-side');
                      setFocusedPanel(null);
                    }}
                    title="Side by side"
                    className={`p-1.5 border ${layout === 'side-by-side' && !focusedPanel ? 'border-crimson text-crimson' : 'border-paper-dim text-ink/40'}`}
                  >
                    <Columns2 size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setLayout('stacked');
                      setFocusedPanel(null);
                    }}
                    title="Stacked"
                    className={`p-1.5 border ${layout === 'stacked' && !focusedPanel ? 'border-crimson text-crimson' : 'border-paper-dim text-ink/40'}`}
                  >
                    <Rows2 size={15} />
                  </button>
                </div>
              </div>

              <div
                className={`flex-1 min-h-0 grid gap-6 ${
                  focusedPanel
                    ? 'grid-cols-1'
                    : layout === 'side-by-side'
                      ? 'grid-cols-2'
                      : 'grid-cols-1 grid-rows-2'
                }`}
              >
                {focusedPanel !== 'polished' && (
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <p className="font-mono text-xs text-ink/40 tracking-wide">ORIGINAL</p>
                    <button
                      onClick={() => setFocusedPanel(focusedPanel === 'original' ? null : 'original')}
                      title={focusedPanel === 'original' ? 'Restore split view' : 'Expand this panel'}
                      className="text-ink/35 hover:text-crimson"
                    >
                      {focusedPanel === 'original' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 bg-paper border border-paper-dim p-4 overflow-y-auto whitespace-pre-wrap font-display text-[15px] text-ink/75 leading-relaxed">
                    {active.originalText}
                  </div>
                </div>
                )}
                {focusedPanel !== 'original' && (
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <p className="font-mono text-xs text-ink/40 tracking-wide">POLISHED (EDITABLE)</p>
                    <div className="flex items-center gap-3">
                      <button
                        disabled={!groqApiKey || active.status === 'polishing'}
                        onClick={async () => {
                          setError(null);
                          try {
                            await polishSingleChapter(active.id);
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                        className="flex items-center gap-1 text-xs text-crimson hover:text-crimson-bright disabled:opacity-30"
                      >
                        <Sparkles size={12} />
                        {active.status === 'polishing'
                          ? 'Polishing…'
                          : active.status === 'polished'
                            ? 'Re-polish'
                            : 'Polish Chapter'}
                      </button>
                      <button
                        onClick={() => setFocusedPanel(focusedPanel === 'polished' ? null : 'polished')}
                        title={focusedPanel === 'polished' ? 'Restore split view' : 'Expand this panel'}
                        className="text-ink/35 hover:text-crimson"
                      >
                        {focusedPanel === 'polished' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={active.polishedText ?? ''}
                    placeholder={
                      active.status === 'polished'
                        ? ''
                        : active.status === 'error'
                          ? 'Polishing failed — click "Polish Chapter" to try again, or edit directly.'
                          : 'Not polished yet — click "Polish all" or "Polish Chapter".'
                    }
                    onChange={(e) => updateChapterText(active.id, e.target.value)}
                    className="flex-1 min-h-0 w-full bg-paper border border-paper-dim p-4 resize-none font-display text-[15px] text-ink leading-relaxed"
                  />
                </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-paper-dim px-8 py-4">
          <button
            onClick={() => setStage('front-matter')}
            className="flex items-center gap-2 bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-5 py-2.5"
          >
            Continue to introduction <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
