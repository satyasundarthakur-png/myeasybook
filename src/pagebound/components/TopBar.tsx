import { PenLine, User, Loader2 } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';

export default function TopBar() {
  const { meta, setMeta, isProcessing, processingMessage, polishProgress } = useBookStore();

  const percent = polishProgress && polishProgress.total > 0
    ? Math.round((polishProgress.processed / polishProgress.total) * 100)
    : null;

  return (
    <header className="flex items-center gap-4 px-6 py-4 border-b border-paper-dim bg-paper-bright">
      <div className="flex items-center gap-2 bg-paper border border-paper-dim px-3 py-1.5 focus-within:border-amber-bright/60 w-72">
        <PenLine size={14} className="text-ink/35 shrink-0" />
        <input
          value={meta.title}
          onChange={(e) => setMeta({ title: e.target.value })}
          placeholder="Book title"
          className="bg-transparent font-display italic text-base text-ink placeholder:text-ink/30 w-full focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2 bg-paper border border-paper-dim px-3 py-1.5 focus-within:border-amber-bright/60 w-56">
        <User size={14} className="text-ink/35 shrink-0" />
        <input
          value={meta.author}
          onChange={(e) => setMeta({ author: e.target.value })}
          placeholder="Author"
          className="bg-transparent font-body text-sm text-ink/70 placeholder:text-ink/30 w-full focus:outline-none"
        />
      </div>

      <div className="flex-1" />

      {isProcessing && (
        <div className="flex items-center gap-3 text-crimson text-sm font-mono">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span className="whitespace-nowrap">{processingMessage}</span>
          {percent !== null && (
            <div className="w-32 h-1 bg-paper-dim overflow-hidden shrink-0">
              <div
                className="h-full bg-crimson transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      )}
    </header>
  );
}
