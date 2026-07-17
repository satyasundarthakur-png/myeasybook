import type { Stage } from '../types/book';
import { useBookStore } from '../store/useBookStore';

const STAGES: { id: Stage; label: string }[] = [
  { id: 'upload', label: 'Manuscript' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'polish', label: 'Polish' },
  { id: 'front-matter', label: 'Introduction' },
  { id: 'index', label: 'Index' },
  { id: 'cover', label: 'Cover' },
  { id: 'export', label: 'Publish' },
];

function CatalogNumber(n: number): string {
  return String(n).padStart(2, '0');
}

/** Minimal line-mark colophon: an open book seen from above, rendered as two
 * arcing strokes meeting a spine — deliberately plain so it reads at 28px. */
function Colophon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="12.5" stroke="#B8935A" strokeWidth="1" />
      <path d="M14 8 C10.5 8.8 8 10.5 7 13 C9 13.4 11.5 13 14 14" stroke="#F5F3EE" strokeWidth="1" strokeLinecap="round" />
      <path d="M14 8 C17.5 8.8 20 10.5 21 13 C19 13.4 16.5 13 14 14" stroke="#F5F3EE" strokeWidth="1" strokeLinecap="round" />
      <line x1="14" y1="8" x2="14" y2="20" stroke="#A3312A" strokeWidth="1" />
    </svg>
  );
}

export default function Spine() {
  const { stage, setStage, chapters } = useBookStore();
  const currentIdx = STAGES.findIndex((s) => s.id === stage);

  return (
    <aside className="w-64 shrink-0 bg-ink relative flex flex-col shadow-[2px_0_16px_rgba(0,0,0,0.25)]">
      {/* Imprint mark */}
      <div className="px-6 pt-8 pb-6">
        <Colophon />
        <p className="font-display italic text-2xl text-paper-bright mt-3 leading-none">Pagebound</p>
        <p className="font-mono text-[10px] tracking-[0.25em] text-paper/40 mt-2 uppercase">
          International Editions
        </p>
      </div>
      <div className="mx-6 border-t border-ink-faint" />

      {/* Catalog-style stage list */}
      <nav className="flex-1 px-3 py-4">
        {STAGES.map((s, idx) => {
          const isActive = s.id === stage;
          const isDone = idx < currentIdx;
          const disabled = s.id !== 'upload' && chapters.length === 0;

          return (
            <button
              key={s.id}
              disabled={disabled}
              onClick={() => setStage(s.id)}
              className={`group w-full flex items-baseline gap-3 px-3 py-3 text-left border-l-2 transition-colors ${
                isActive
                  ? 'border-crimson bg-ink-soft/60'
                  : 'border-transparent hover:bg-ink-soft/30'
              } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  isActive ? 'text-crimson-bright' : isDone ? 'text-brass' : 'text-paper/35'
                }`}
              >
                {CatalogNumber(idx + 1)}
              </span>
              <span
                className={`font-body text-[13px] tracking-wide uppercase ${
                  isActive ? 'text-paper-bright' : isDone ? 'text-paper/75' : 'text-paper/45'
                }`}
              >
                {s.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Publisher's imprint line */}
      <div className="mx-6 border-t border-ink-faint" />
      <div className="px-6 py-5">
        <p className="font-mono text-[10px] tracking-[0.15em] text-paper/35 uppercase">
          Pagebound Editions
          <span className="mx-1.5 text-paper/20">·</span>
          {chapters.length > 0 ? `${chapters.length} chapters` : 'No manuscript'}
        </p>
      </div>
    </aside>
  );
}
