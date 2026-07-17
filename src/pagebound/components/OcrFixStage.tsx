import { useState } from 'react';
import {
  Wand2,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RotateCw,
} from 'lucide-react';
import { useBookStore } from '../store/useBookStore';
import type { Chapter } from '../types/book';

export default function OcrFixStage() {
  const { chapters, groups, fixAllChaptersOcr, fixSingleChapterOcr, updateChapterOcrFixedText, setStage, groqApiKey, ocrFixProgress, lastBatchError } =
    useBookStore();
  const [activeId, setActiveId] = useState(chapters[0]?.id ?? null);
  const active = chapters.find((c) => c.id === activeId) ?? chapters[0];
  const [error, setError] = useState<string | null>(null);

  const isGrouped = groups.length > 1;
  const activeGroup = groups.find((g) => g.chapterIds.includes(active?.id ?? ''));
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(activeGroup?.id ?? groups[0]?.id ?? null);

  const chapterById = new Map<string, Chapter>(chapters.map((c) => [c.id, c]));

  const percent = ocrFixProgress && ocrFixProgress.total > 0
    ? Math.round((ocrFixProgress.processed / ocrFixProgress.total) * 100)
    : null;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r border-paper-dim flex flex-col h-full bg-paper">
        <div className="p-4 border-b border-paper-dim shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs text-ink/50">
              {ocrFixProgress
                ? `${ocrFixProgress.succeeded}/${ocrFixProgress.total} fixed${ocrFixProgress.failed ? ` · ${ocrFixProgress.failed} failed` : ''}`
                : `${chapters.filter((c) => c.ocrStatus === 'fixed').length}/${chapters.length} fixed`}
            </p>
            <button
              disabled={!groqApiKey}
              onClick={async () => {
                setError(null);
                try {
                  await fixAllChaptersOcr();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
              className="flex items-center gap-1.5 text-xs bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-3 py-1.5 disabled:opacity-30"
            >
              <Wand2 size={13} /> Fix all
            </button>
          </div>
          {percent !== null && (
            <div className="w-full h-1 bg-paper-dim overflow-hidden">
              <div className="h-full bg-crimson transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {groups.map((group) => {
            const groupChapters = group.chapterIds
              .map((id) => chapterById.get(id))
              .filter((c): c is Chapter => Boolean(c));
            const fixedCount = groupChapters.filter((c) => c.ocrStatus === 'fixed').length;
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
                      {fixedCount}/{groupChapters.length}
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
                          {c.ocrStatus === 'fixed' && <Check size={13} className="text-moss shrink-0" />}
                          {c.ocrStatus === 'fixing' && <Loader2 size={13} className="animate-spin text-crimson shrink-0" />}
                          {c.ocrStatus === 'error' && <AlertCircle size={13} className="text-rust shrink-0" />}
                          {c.ocrStatus === 'raw' && <span className="w-[13px] shrink-0" />}
                          <span className="truncate">
                            {c.number}. {c.title}
                          </span>
                        </button>
                        {c.ocrStatus !== 'fixing' && (
                          <button
                            disabled={!groqApiKey}
                            title={c.ocrStatus === 'fixed' ? 'Re-fix this chapter' : 'Fix this chapter'}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setError(null);
                              try {
                                await fixSingleChapterOcr(c.id);
                              } catch (err) {
                                setError((err as Error).message);
                              }
                            }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-ink/35 hover:text-crimson opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 transition-opacity"
                          >
                            {c.ocrStatus === 'fixed' ? <RotateCw size={13} /> : <Wand2 size={13} />}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-paper-bright">
        <div className="flex-1 overflow-hidden flex flex-col px-8 py-6 min-h-0">
          <div className="mb-4 border border-brass/40 bg-brass/5 text-brass-dim text-sm font-body px-4 py-3 shrink-0">
            <strong className="text-ink">Optional.</strong> If this manuscript came from a scan or OCR (old book,
            archive.org, etc.), this step corrects recognition errors — misread characters, words split across line
            breaks — using surrounding context. It does not rewrite or improve your prose; that's what Polish does
            next. If your source text is already clean, skip straight to Polish.
          </div>
          {!groqApiKey && (
            <div className="mb-4 border border-brass/40 bg-brass/5 text-brass-dim text-sm font-body px-4 py-3 shrink-0">
              Add a Groq API key (AI Settings, bottom of the sidebar) to run this step.
            </div>
          )}
          {error && <p className="mb-4 text-sm text-rust shrink-0">{error}</p>}
          {!error && lastBatchError && (
            <p className="mb-4 text-sm text-rust shrink-0">
              "Fix all" ran into a problem: {lastBatchError}
            </p>
          )}

          {active && (
            <div className="flex-1 flex flex-col min-h-0">
              <h2 className="font-display font-bold text-2xl text-ink truncate mb-4 shrink-0">
                {active.number}. {active.title}
              </h2>

              <div className="flex-1 min-h-0 grid grid-cols-2 gap-6">
                <div className="flex flex-col min-h-0">
                  <p className="font-mono text-xs text-ink/40 mb-2 shrink-0 tracking-wide">ORIGINAL (AS SCANNED)</p>
                  <div className="flex-1 min-h-0 bg-paper border border-paper-dim p-4 overflow-y-auto whitespace-pre-wrap font-display text-[15px] text-ink/75 leading-relaxed">
                    {active.originalText}
                  </div>
                </div>
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <p className="font-mono text-xs text-ink/40 tracking-wide">CORRECTED (EDITABLE)</p>
                    <button
                      disabled={!groqApiKey || active.ocrStatus === 'fixing'}
                      onClick={async () => {
                        setError(null);
                        try {
                          await fixSingleChapterOcr(active.id);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                      className="flex items-center gap-1 text-xs text-crimson hover:text-crimson-bright disabled:opacity-30"
                    >
                      <Wand2 size={12} />
                      {active.ocrStatus === 'fixing'
                        ? 'Fixing…'
                        : active.ocrStatus === 'fixed'
                          ? 'Re-fix'
                          : 'Fix Chapter'}
                    </button>
                  </div>
                  <textarea
                    value={active.ocrFixedText ?? ''}
                    placeholder={
                      active.ocrStatus === 'fixed'
                        ? ''
                        : active.ocrStatus === 'error'
                          ? 'Fixing failed — click "Fix Chapter" to try again, or edit directly.'
                          : 'Not fixed yet — click "Fix all" or "Fix Chapter". Or skip this step entirely if the source is already clean.'
                    }
                    onChange={(e) => updateChapterOcrFixedText(active.id, e.target.value)}
                    className="flex-1 min-h-0 w-full bg-paper border border-paper-dim p-4 resize-none font-display text-[15px] text-ink leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-paper-dim px-8 py-4 flex items-center gap-3">
          <button
            onClick={() => setStage('polish')}
            className="flex items-center gap-2 bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-5 py-2.5"
          >
            Continue to polish <ArrowRight size={16} />
          </button>
          <button
            onClick={() => setStage('polish')}
            className="text-sm text-ink/50 hover:text-ink px-3 py-2.5"
          >
            Skip this step
          </button>
        </div>
      </div>
    </div>
  );
}
