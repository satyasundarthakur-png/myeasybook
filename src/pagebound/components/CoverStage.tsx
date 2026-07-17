import { useRef, useState } from 'react';
import { ArrowRight, Upload, X } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';
import { generateCoverSVG } from '../lib/coverGenerator';
import type { CoverConfig } from '../types/book';

const PALETTES: CoverConfig['palette'][] = ['leather', 'brass', 'moss', 'ink'];
const LAYOUTS: CoverConfig['layout'][] = ['classic', 'modern', 'literary'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a cover, small enough to keep in localStorage/state comfortably

export default function CoverStage() {
  const { cover, setCover, setStage } = useBookStore();
  const svg = generateCoverSVG(cover);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleImageUpload = (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError('That image is larger than 8MB — please use a smaller file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCover({ customImage: reader.result as string });
    reader.onerror = () => setUploadError('Could not read that image file.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-full overflow-y-auto max-w-4xl mx-auto py-12 px-6 grid grid-cols-[280px_1fr] gap-10">
      <div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-crimson uppercase font-semibold mb-3">No. 06 — Jacket Design</p>
        <h1 className="font-display font-bold text-3xl text-ink mb-6">Cover</h1>

        <label className="block font-mono text-xs text-ink/40 mb-2 tracking-wide">YOUR OWN COVER ART</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageUpload(e.target.files?.[0])}
        />
        {cover.customImage ? (
          <button
            onClick={() => setCover({ customImage: null })}
            className="w-full flex items-center justify-center gap-2 border border-paper-dim text-ink/60 hover:text-rust hover:border-rust py-2 text-xs font-body mb-2"
          >
            <X size={13} /> Remove uploaded image
          </button>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-paper-dim text-ink/60 hover:border-crimson hover:text-crimson py-3 text-xs font-body mb-2"
          >
            <Upload size={14} /> Upload cover image
          </button>
        )}
        {uploadError && <p className="text-xs text-rust mb-2">{uploadError}</p>}
        <p className="font-mono text-[10px] text-ink/35 mb-6 leading-relaxed">
          {cover.customImage
            ? 'Using your uploaded image. Remove it to go back to the designed cover below.'
            : 'JPG, PNG, or WebP, ideally a 2:3 portrait ratio (e.g. 1600×2400px). If you skip this, the designed cover below is used instead.'}
        </p>

        <fieldset disabled={Boolean(cover.customImage)} className={cover.customImage ? 'opacity-40' : ''}>
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
        </fieldset>

        <button
          onClick={() => setStage('export')}
          className="w-full flex items-center justify-center gap-2 bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-5 py-2.5"
        >
          Continue to publish <ArrowRight size={16} />
        </button>
      </div>

      <div className="flex items-center justify-center">
        {cover.customImage ? (
          <img
            src={cover.customImage}
            alt="Uploaded cover"
            className="w-[320px] shadow-2xl overflow-hidden border border-paper-dim object-cover aspect-[2/3]"
          />
        ) : (
          <div
            className="w-[320px] shadow-2xl overflow-hidden border border-paper-dim"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
    </div>
  );
}
