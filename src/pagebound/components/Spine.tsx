import { Trash2 } from 'lucide-react';
import type { Stage } from '../types/book';
import { useBookStore } from '../store/useBookStore';
import AiSettingsPanel from './AiSettingsPanel';

const STAGES: { id: Stage; label: string; optional?: boolean }[] = [
  { id: 'upload', label: 'Manuscript' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'ocr-fix', label: 'Fix OCR', optional: true },
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
  const { stage, setStage, chapters, groups, reset } = useBookStore();

  const handleReset = () => {
    if (confirm('Are you sure you want to reset your project? This will clear your current manuscript.')) {
      reset();
    }
  };

  return (
    <aside className="w-64 shrink-0 bg-rail text-slate-300 h-full flex flex-col justify-between p-6 border-r border-slate-800">
      <div>
        {/* Brand header */}
        <div className="mb-8">
          <Colophon />
          <h1 className="text-2xl font-display italic font-bold tracking-wide text-white mt-3 leading-none">
            Pagebound
          </h1>
          <p className="text-[10px] tracking-[0.2em] text-slate-500 font-mono mt-1 uppercase">
            International Editions
          </p>
        </div>

        {/* Catalog-style stage list */}
        <nav className="space-y-4">
          {STAGES.map((s, idx) => {
            const isActive = s.id === stage;
            const disabled = s.id !== 'upload' && chapters.length === 0;

            return (
              <button
                key={s.id}
                disabled={disabled}
                onClick={() => setStage(s.id)}
                className={`w-full flex items-center gap-4 text-left group border-l-2 pl-2 -ml-2 ${
                  isActive ? 'border-amber-500' : 'border-transparent'
                } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`text-xs font-mono transition-colors ${
                    isActive ? 'text-amber-500' : 'text-slate-500 group-hover:text-amber-500'
                  }`}
                >
                  {CatalogNumber(idx + 1)}
                </span>
                <span
                  className={`text-sm font-semibold tracking-wider transition-colors ${
                    isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                  }`}
                >
                  {s.label.toUpperCase()}
                </span>
                {s.optional && (
                  <span className="text-[9px] font-mono text-slate-600 tracking-wide">OPT.</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom panel: AI settings + project management actions */}
      <div className="space-y-2 border-t border-slate-800 pt-4">
        <AiSettingsPanel />

        <button
          onClick={handleReset}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-all group font-mono"
        >
          <Trash2 className="h-4 w-4 text-red-500/70 group-hover:text-red-400 transition-colors" />
          <span>RESET PROJECT</span>
        </button>

        <p className="font-mono text-[10px] tracking-[0.15em] text-slate-600 uppercase pt-2">
          {chapters.length === 0
            ? 'No manuscript'
            : groups.length > 1
              ? `${groups.length} sections · ${chapters.length} items`
              : `${chapters.length} chapters`}
        </p>
      </div>
    </aside>
  );
}
