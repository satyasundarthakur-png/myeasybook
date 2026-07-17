import { useState } from 'react';
import { saveAs } from 'file-saver';
import { FileDown, BookMarked, FileType, Printer } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';
import { buildEpub } from '../lib/epubBuilder';
import { buildDocx } from '../lib/docxBuilder';
import { buildPrintableHtml } from '../lib/printBuilder';

function slug(s: string): string {
  return (s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function ExportStage() {
  const book = useBookStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filename = slug(book.meta.title);

  const handleEpub = async () => {
    setBusy('epub');
    setError(null);
    try {
      const blob = await buildEpub(book);
      saveAs(blob, `${filename}.epub`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleDocx = async () => {
    setBusy('docx');
    setError(null);
    try {
      const blob = await buildDocx(book);
      saveAs(blob, `${filename}.docx`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = () => {
    setError(null);
    const html = buildPrintableHtml(book);
    const win = window.open('', '_blank');
    if (!win) {
      setError('Please allow pop-ups to open the print-ready view.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const totalWords = book.chapters.reduce((sum, c) => sum + c.wordCount, 0);

  return (
    <div className="h-full overflow-y-auto max-w-2xl mx-auto py-12 px-6">
      <p className="font-mono text-[11px] tracking-[0.2em] text-crimson uppercase font-semibold mb-3">No. 07 — Publication</p>
      <h1 className="font-display font-bold text-3xl text-ink mb-2">Publish</h1>
      <p className="font-body text-ink/60 mb-8">
        Your book is ready. Export in the format you need for your platform of choice.
      </p>

      <div className="bg-paper border border-paper-dim p-5 mb-8 font-mono text-sm text-ink/60 grid grid-cols-2 gap-y-1">
        <span>Chapters</span>
        <span className="text-ink text-right">{book.chapters.length}</span>
        <span>Total words</span>
        <span className="text-ink text-right">{totalWords.toLocaleString()}</span>
        <span>Introduction</span>
        <span className="text-ink text-right">{book.introduction ? 'Yes' : 'No'}</span>
        <span>Index entries</span>
        <span className="text-ink text-right">{book.indexEntries.length}</span>
      </div>

      {error && <p className="text-sm text-rust mb-4">{error}</p>}

      <div className="grid gap-3">
        <button
          onClick={handleEpub}
          disabled={busy === 'epub'}
          className="flex items-center gap-3 bg-paper hover:bg-paper-dim/50 border border-paper-dim px-5 py-4 text-left"
        >
          <BookMarked size={20} className="text-crimson shrink-0" />
          <span>
            <span className="block font-body text-ink">Export EPUB</span>
            <span className="block font-mono text-xs text-ink/40">
              For Kindle/KDP, Apple Books, Kobo — includes cover, TOC, and index
            </span>
          </span>
          <FileDown size={16} className="ml-auto text-ink/40" />
        </button>

        <button
          onClick={handleDocx}
          disabled={busy === 'docx'}
          className="flex items-center gap-3 bg-paper hover:bg-paper-dim/50 border border-paper-dim px-5 py-4 text-left"
        >
          <FileType size={20} className="text-crimson shrink-0" />
          <span>
            <span className="block font-body text-ink">Export DOCX</span>
            <span className="block font-mono text-xs text-ink/40">
              Editable Word document for further editing or print layout software
            </span>
          </span>
          <FileDown size={16} className="ml-auto text-ink/40" />
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-3 bg-paper hover:bg-paper-dim/50 border border-paper-dim px-5 py-4 text-left"
        >
          <Printer size={20} className="text-crimson shrink-0" />
          <span>
            <span className="block font-body text-ink">Print-ready PDF</span>
            <span className="block font-mono text-xs text-ink/40">
              Opens a paginated 6×9in layout — use your browser's "Print to PDF"
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
