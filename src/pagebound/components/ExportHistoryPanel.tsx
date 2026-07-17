import { BookMarked, FileType, Printer, Download, FolderClock } from 'lucide-react';
import { saveAs } from 'file-saver';
import { useBookStore } from '../store/useBookStore';
import { buildPrintableHtml } from '../lib/printBuilder';

const FORMAT_ICON = { epub: BookMarked, docx: FileType, pdf: Printer };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ExportHistoryPanel() {
  const exportHistory = useBookStore((s) => s.exportHistory);
  const book = useBookStore();

  const handleRedownload = async (entry: (typeof exportHistory)[number]) => {
    if (entry.blob) {
      saveAs(entry.blob, entry.filename);
      return;
    }
    // Print/PDF has no stored blob (it's a browser print view, not a file
    // object) — re-open it from current book state instead.
    const win = window.open('', '_blank');
    if (!win) return;
    const html = await buildPrintableHtml(book);
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  return (
    <aside className="w-64 shrink-0 bg-rail text-slate-300 h-full flex flex-col border-l border-slate-800">
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <FolderClock size={16} className="text-brass" />
          <h2 className="text-sm font-semibold tracking-wider text-white uppercase">Recent Exports</h2>
        </div>
        <p className="text-[10px] tracking-[0.15em] text-slate-500 font-mono uppercase">
          Last 3 · Older Auto-Cleared
        </p>
      </div>
      <div className="mx-6 border-t border-slate-800" />

      <div className="flex-1 overflow-y-auto p-3">
        {exportHistory.length === 0 ? (
          <p className="px-3 py-6 text-xs text-slate-500 font-mono text-center leading-relaxed">
            No exports yet.
            <br />
            Publish a format to see it here.
          </p>
        ) : (
          <div className="space-y-1">
            {exportHistory.map((entry) => {
              const Icon = FORMAT_ICON[entry.format];
              return (
                <div key={entry.id} className="px-3 py-3 rounded-md hover:bg-slate-800/40 group">
                  <div className="flex items-start gap-2.5">
                    <Icon size={16} className="text-slate-500 group-hover:text-amber-500 transition-colors shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200 truncate font-mono">{entry.filename}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {formatRelativeTime(entry.timestamp)} · {formatSize(entry.sizeBytes)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRedownload(entry)}
                    className="w-full flex items-center justify-center gap-1.5 mt-2 py-1.5 text-[11px] font-mono text-slate-400 hover:text-amber-500 border border-slate-800 hover:border-amber-500/40 rounded-md transition-colors"
                  >
                    <Download size={11} />
                    {entry.blob ? 'Download again' : 'Reopen'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
