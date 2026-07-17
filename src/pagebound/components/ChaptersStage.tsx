import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';
import type { Chapter } from '../types/book';

export default function ChaptersStage() {
  const { chapters, groups, setStage } = useBookStore();
  const isGrouped = groups.length > 1;
  const [expandedId, setExpandedId] = useState<string | null>(groups[0]?.id ?? null);

  const chapterById = new Map<string, Chapter>(chapters.map((c) => [c.id, c]));

  const renameChapter = (id: string, title: string) => {
    useBookStore.setState((s) => ({
      chapters: s.chapters.map((ch) => (ch.id === id ? { ...ch, title } : ch)),
    }));
  };

  return (
    <div className="h-full overflow-y-auto max-w-3xl mx-auto py-12 px-6">
      <p className="font-mono text-[11px] tracking-[0.2em] text-crimson uppercase mb-3">No. 02 — Table of Contents</p>
      <h1 className="font-display italic text-3xl text-ink mb-2">Detected chapters</h1>
      <p className="font-body text-ink/60 mb-2">
        {isGrouped
          ? `${chapters.length} items detected, grouped into ${groups.length} chapters for easier navigation. Edit any title, then continue to polishing.`
          : 'Review the chapter breaks below. Edit any title, then continue to polishing.'}
      </p>
      {isGrouped && (
        <p className="font-mono text-xs text-brass-dim mb-6">
          Large manuscript detected — showing grouped view. Click a group to expand it.
        </p>
      )}

      <div className="space-y-3">
        {groups.map((group) => {
          const groupChapters = group.chapterIds
            .map((id) => chapterById.get(id))
            .filter((c): c is Chapter => Boolean(c));
          const wordTotal = groupChapters.reduce((sum, c) => sum + c.wordCount, 0);
          const expanded = !isGrouped || expandedId === group.id;

          return (
            <div key={group.id} className="border border-paper-dim overflow-hidden">
              {isGrouped && (
                <button
                  onClick={() => setExpandedId(expanded ? null : group.id)}
                  className="w-full flex items-center gap-3 bg-paper hover:bg-paper-dim/60 px-4 py-3 text-left"
                >
                  {expanded ? <ChevronDown size={16} className="text-crimson" /> : <ChevronRight size={16} className="text-crimson" />}
                  <span className="font-body text-ink flex-1">{group.title}</span>
                  <span className="font-mono text-xs text-ink/40">
                    {groupChapters.length} items · {wordTotal.toLocaleString()} words
                  </span>
                </button>
              )}

              {expanded && (
                <div className="space-y-2 p-3 bg-paper-bright">
                  {groupChapters.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-4 bg-paper border border-paper-dim px-4 py-2.5"
                    >
                      <span className="font-mono text-crimson w-12 shrink-0 text-sm">{c.number}</span>
                      <input
                        value={c.title}
                        onChange={(e) => renameChapter(c.id, e.target.value)}
                        className="flex-1 bg-transparent text-ink font-body text-sm border-b border-transparent focus:border-crimson px-1 py-1"
                      />
                      <span className="font-mono text-xs text-ink/40 w-20 text-right shrink-0">
                        {c.wordCount} words
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setStage('polish')}
        className="mt-8 flex items-center gap-2 bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-5 py-2.5"
      >
        Continue to polishing <ArrowRight size={16} />
      </button>
    </div>
  );
}
