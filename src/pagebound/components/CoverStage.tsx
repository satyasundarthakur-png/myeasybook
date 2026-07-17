import { ArrowRight } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';
import { generateCoverSVG } from '../lib/coverGenerator';
import type { CoverConfig } from '../types/book';

const PALETTES: CoverConfig['palette'][] = ['leather', 'brass', 'moss', 'ink'];
const LAYOUTS: CoverConfig['layout'][] = ['classic', 'modern', 'literary'];

export default function CoverStage() {
  const { cover, setCover, setStage } = useBookStore();
  const svg = generateCoverSVG(cover);

  return (
    <div className="h-full overflow-y-auto max-w-4xl mx-auto py-12 px-6 grid grid-cols-[280px_1fr] gap-10">
      <div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-crimson uppercase mb-3">No. 06 — Jacket Design</p>
        <h1 className="font-display italic text-3xl text-ink mb-6">Cover</h1>

        <label className="block font-mono text-xs text-ink/40 mb-1 tracking-wide">TITLE</label>
        <input
          value={cover.title}
          onChange={(e) => setCover({ title: e.target.value })}
          className="w-full bg-paper border border-paper-dim px-3 py-2 text-ink mb-4"
        />

        <label className="block font-mono text-xs text-ink/40 mb-1 tracking-wide">SUBTITLE (OPTIONAL)</label>
        <input
          value={cover.subtitle}
          onChange={(e) => setCover({ subtitle: e.target.value })}
          className="w-full bg-paper border border-paper-dim px-3 py-2 text-ink mb-4"
        />

        <label className="block font-mono text-xs text-ink/40 mb-1 tracking-wide">AUTHOR</label>
        <input
          value={cover.author}
          onChange={(e) => setCover({ author: e.target.value })}
          className="w-full bg-paper border border-paper-dim px-3 py-2 text-ink mb-4"
        />

        <label className="block font-mono text-xs text-ink/40 mb-2 tracking-wide">PALETTE</label>
        <div className="flex gap-2 mb-4">
          {PALETTES.map((p) => (
            <button
              key={p}
              onClick={() => setCover({ palette: p })}
              className={`flex-1 py-2 text-xs font-body capitalize border ${
                cover.palette === p ? 'border-crimson text-crimson' : 'border-paper-dim text-ink/50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <label className="block font-mono text-xs text-ink/40 mb-2 tracking-wide">LAYOUT</label>
        <div className="flex gap-2 mb-6">
          {LAYOUTS.map((l) => (
            <button
              key={l}
              onClick={() => setCover({ layout: l })}
              className={`flex-1 py-2 text-xs font-body capitalize border ${
                cover.layout === l ? 'border-crimson text-crimson' : 'border-paper-dim text-ink/50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <button
          onClick={() => setStage('export')}
          className="w-full flex items-center justify-center gap-2 bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-5 py-2.5"
        >
          Continue to publish <ArrowRight size={16} />
        </button>
      </div>

      <div className="flex items-center justify-center">
        <div
          className="w-[320px] shadow-2xl overflow-hidden border border-paper-dim"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
