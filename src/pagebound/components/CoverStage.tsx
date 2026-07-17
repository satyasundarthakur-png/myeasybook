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
        <h1 className="font-display text-3xl text-paper-bright mb-6">Cover</h1>

        <label className="block font-mono text-xs text-paper/40 mb-1">TITLE</label>
        <input
          value={cover.title}
          onChange={(e) => setCover({ title: e.target.value })}
          className="w-full bg-ink-soft border border-ink-faint rounded-sm px-3 py-2 text-paper-bright mb-4"
        />

        <label className="block font-mono text-xs text-paper/40 mb-1">SUBTITLE (optional)</label>
        <input
          value={cover.subtitle}
          onChange={(e) => setCover({ subtitle: e.target.value })}
          className="w-full bg-ink-soft border border-ink-faint rounded-sm px-3 py-2 text-paper-bright mb-4"
        />

        <label className="block font-mono text-xs text-paper/40 mb-1">AUTHOR</label>
        <input
          value={cover.author}
          onChange={(e) => setCover({ author: e.target.value })}
          className="w-full bg-ink-soft border border-ink-faint rounded-sm px-3 py-2 text-paper-bright mb-4"
        />

        <label className="block font-mono text-xs text-paper/40 mb-2">PALETTE</label>
        <div className="flex gap-2 mb-4">
          {PALETTES.map((p) => (
            <button
              key={p}
              onClick={() => setCover({ palette: p })}
              className={`flex-1 py-2 rounded-sm text-xs font-body capitalize border ${
                cover.palette === p ? 'border-brass text-brass-bright' : 'border-ink-faint text-paper/50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <label className="block font-mono text-xs text-paper/40 mb-2">LAYOUT</label>
        <div className="flex gap-2 mb-6">
          {LAYOUTS.map((l) => (
            <button
              key={l}
              onClick={() => setCover({ layout: l })}
              className={`flex-1 py-2 rounded-sm text-xs font-body capitalize border ${
                cover.layout === l ? 'border-brass text-brass-bright' : 'border-ink-faint text-paper/50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <button
          onClick={() => setStage('export')}
          className="w-full flex items-center justify-center gap-2 bg-brass hover:bg-brass-bright text-ink font-semibold px-5 py-2.5 rounded-sm"
        >
          Continue to publish <ArrowRight size={16} />
        </button>
      </div>

      <div className="flex items-center justify-center">
        <div
          className="w-[320px] shadow-2xl rounded-sm overflow-hidden border border-ink-faint"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
