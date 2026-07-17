import { useCallback, useState } from 'react';
import { FileText } from 'lucide-react';
import { useBookStore, useActiveAiKeyPresent } from '../store/useBookStore';

export default function UploadStage() {
  const uploadFile = useBookStore((s) => s.uploadFile);
  const hasAiKey = useActiveAiKeyPresent();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const ok = /\.(docx|pdf|txt)$/i.test(file.name);
      if (!ok) {
        setError('Please upload a .docx, .pdf, or .txt file.');
        return;
      }
      setError(null);
      try {
        await uploadFile(file);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [uploadFile]
  );

  return (
    <div className="h-full overflow-y-auto max-w-2xl mx-auto py-16 px-6 font-display">
      <span className="text-crimson font-mono tracking-widest text-xs uppercase font-semibold">
        No. 01 — Manuscript
      </span>

      <h1 className="text-4xl font-bold mt-2 mb-4 text-ink">Bring your manuscript</h1>

      <p className="text-ink/65 text-lg leading-relaxed max-w-2xl mb-8 font-body">
        Upload a Word document, PDF, or plain text file. Pagebound detects your chapters, then walks you
        through polishing the prose, writing an introduction, building an index, designing a cover,
        and exporting a publish-ready EPUB, DOCX, or print PDF.
      </p>

      {!hasAiKey && (
        <div className="mb-6 border border-brass/40 bg-brass/5 text-brass-dim text-sm font-body px-4 py-3">
          Tip: add an AI provider API key (AI Settings, bottom of the sidebar) before uploading — it improves
          chapter detection for manuscripts without clear "Chapter" headings, and unlocks polishing, the
          introduction, and the index later.
        </div>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`block border-2 border-dashed rounded-lg p-12 text-center cursor-pointer max-w-2xl transition-all duration-200 ${
          dragOver
            ? 'border-amber-500 bg-amber-500/10 scale-[1.02] shadow-lg'
            : 'border-parchment-border bg-parchment hover:bg-parchment-hover'
        }`}
      >
        <div className={`text-4xl mb-4 ${dragOver ? 'text-amber-500 animate-pulse' : 'text-crimson'}`}>✍️</div>
        <p className="text-ink/85 font-semibold text-lg font-body">
          Drop your manuscript here, or click to browse
        </p>
        <p className="text-parchment-muted text-sm mt-2 font-mono">.DOCX · .PDF · .TXT</p>
        <input
          type="file"
          accept=".docx,.pdf,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      {error && (
        <p className="mt-4 text-sm text-rust font-body flex items-center gap-2">
          <FileText size={14} /> {error}
        </p>
      )}
    </div>
  );
}
