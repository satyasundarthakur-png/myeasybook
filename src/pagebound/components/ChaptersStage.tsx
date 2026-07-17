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
      <h1 className="font-display text-3xl text-paper-bright mb-2">Detected chapters</h1>
      <p className="font-body text-paper/60 mb-2">
        {isGrouped
          ? `${chapters.length} items detected, grouped into ${groups.length} chapters for easier navigation. Edit any title, then continue to polishing.`
          : 'Review the chapter breaks below. Edit any title, then continue to polishing.'}
      </p>
      {isGrouped && (
        <p className="font-mono text-xs text-brass-bright mb-6">
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
            <div key={group.id} className="border border-ink-faint rounded-sm overflow-hidden">
              {isGrouped && (
                <button
                  onClick={() => setExpandedId(expanded ? null : group.id)}
                  className="w-full flex items-center gap-3 bg-ink-soft hover:bg-ink-faint px-4 py-3 text-left"
                >
                  {expanded ? <ChevronDown size={16} className="text-brass" /> : <ChevronRight size={16} className="text-brass" />}
                  <span className="font-body text-paper-bright flex-1">{group.title}</span>
                  <span className="font-mono text-xs text-paper/40">
                    {groupChapters.length} items · {wordTotal.toLocaleString()} words
                  </span>
                </button>
              )}

              {expanded && (
                <div className="space-y-2 p-3 bg-ink">
                  {groupChapters.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-4 bg-ink-soft border border-ink-faint rounded-sm px-4 py-2.5"
                    >
                      <span className="font-mono text-brass w-12 shrink-0 text-sm">#{c.number}</span>
                      <input
                        value={c.title}
                        onChange={(e) => renameChapter(c.id, e.target.value)}
                        className="flex-1 bg-transparent text-paper-bright font-body text-sm border-b border-transparent focus:border-brass px-1 py-1"
                      />
                      <span className="font-mono text-xs text-paper/40 w-20 text-right shrink-0">
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
        className="mt-8 flex items-center gap-2 bg-brass hover:bg-brass-bright text-ink font-semibold px-5 py-2.5 rounded-sm"
      >
        Continue to polishing <ArrowRight size={16} />
      </button>
    </div>
  );
}
