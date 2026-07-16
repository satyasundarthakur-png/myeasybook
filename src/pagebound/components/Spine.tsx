import { BookOpen, ScrollText, Sparkles, PenLine, ListTree, Palette, Download } from 'lucide-react';
import type { Stage } from '../types/book';
import { useBookStore } from '../store/useBookStore';

const STAGES: { id: Stage; label: string; icon: React.ReactNode }[] = [
  { id: 'upload', label: 'Manuscript', icon: <ScrollText size={16} /> },
  { id: 'chapters', label: 'Chapters', icon: <BookOpen size={16} /> },
  { id: 'polish', label: 'Polish', icon: <Sparkles size={16} /> },
  { id: 'front-matter', label: 'Introduction', icon: <PenLine size={16} /> },
  { id: 'index', label: 'Index', icon: <ListTree size={16} /> },
  { id: 'cover', label: 'Cover', icon: <Palette size={16} /> },
  { id: 'export', label: 'Publish', icon: <Download size={16} /> },
];

export default function Spine() {
  const { stage, setStage, chapters } = useBookStore();
  const currentIdx = STAGES.findIndex((s) => s.id === stage);

  return (
    <aside className="w-[220px] shrink-0 bg-leather relative flex flex-col py-8 shadow-[6px_0_24px_rgba(0,0,0,0.35)]">
      {/* foil-stamped title, running along the spine */}
      <div className="px-5 mb-8">
        <p className="font-display text-2xl font-semibold text-brass-bright leading-none">Pagebound</p>
        <p className="font-mono text-[10px] tracking-[0.2em] text-paper/60 mt-1">MANUSCRIPT → BOOK</p>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3">
        {STAGES.map((s, idx) => {
          const isActive = s.id === stage;
          const isDone = idx < currentIdx;
          const disabled = s.id !== 'upload' && chapters.length === 0;
          return (
            <button
              key={s.id}
              disabled={disabled}
              onClick={() => setStage(s.id)}
              className={`group flex items-center gap-3 px-3 py-3 rounded-sm text-left transition-colors border-l-2 ${
                isActive
                  ? 'bg-leather-bright border-brass text-paper-bright'
                  : isDone
                  ? 'border-brass/40 text-paper/80 hover:bg-leather-bright/50'
                  : 'border-transparent text-paper/40 hover:text-paper/70'
              } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={isActive ? 'text-brass-bright' : ''}>{s.icon}</span>
              <span className="font-body text-sm">{s.label}</span>
              {isDone && <span className="ml-auto text-brass text-xs">●</span>}
            </button>
          );
        })}
      </nav>

      <div className="px-5 pt-6 border-t border-paper/10 mt-4">
        <p className="font-mono text-[10px] text-paper/40 leading-relaxed">
          {chapters.length > 0 ? `${chapters.length} chapters loaded` : 'No manuscript yet'}
        </p>
      </div>
    </aside>
  );
}
