import { useCallback, useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';

export default function UploadStage() {
  const uploadFile = useBookStore((s) => s.uploadFile);
  const groqApiKey = useBookStore((s) => s.groqApiKey);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const ok = /\.(docx|txt|md)$/i.test(file.name);
      if (!ok) {
        setError('Please upload a .docx, .txt, or .md file.');
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
    <div className="h-full overflow-y-auto max-w-2xl mx-auto py-16 px-6">
      <p className="font-mono text-[11px] tracking-[0.2em] text-crimson uppercase mb-3">No. 01 — Manuscript</p>
      <h1 className="font-display italic text-4xl text-ink mb-3">Bring your manuscript</h1>
      <p className="font-body text-ink/60 mb-10 leading-relaxed">
        Upload a Word document or plain text file. Pagebound detects your chapters, then walks you
        through polishing the prose, writing an introduction, building an index, designing a cover,
        and exporting a publish-ready EPUB, DOCX, or print PDF.
      </p>

      {!groqApiKey && (
        <div className="mb-6 border border-brass/40 bg-brass/5 text-brass-dim text-sm font-body px-4 py-3">
          Tip: add your Groq API key (top right) before uploading — it improves chapter detection for
          manuscripts without clear "Chapter" headings, and unlocks polishing, the introduction, and
          the index later.
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
        className={`flex flex-col items-center justify-center gap-3 border border-dashed py-20 cursor-pointer transition-colors ${
          dragOver ? 'border-crimson bg-crimson/5' : 'border-paper-dim hover:border-crimson/50'
        }`}
      >
        <UploadCloud size={36} className="text-crimson" strokeWidth={1.25} />
        <p className="font-body text-ink">Drop your manuscript here, or click to browse</p>
        <p className="font-mono text-xs text-ink/35 tracking-wide">.DOCX · .TXT · .MD</p>
        <input
          type="file"
          accept=".docx,.txt,.md"
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
