import { useState } from 'react';
import { ListTree, ArrowRight, Loader2, X } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';

export default function IndexStage() {
  const { indexEntries, buildIndex, setStage, groqApiKey, isProcessing } = useBookStore();
  const [error, setError] = useState<string | null>(null);

  const removeEntry = (term: string) => {
    useBookStore.setState((s) => ({ indexEntries: s.indexEntries.filter((e) => e.term !== term) }));
  };

  return (
    <div className="h-full overflow-y-auto max-w-3xl mx-auto py-12 px-6">
      <p className="font-mono text-[11px] tracking-[0.2em] text-crimson uppercase font-semibold mb-3">No. 05 — Back Matter</p>
      <h1 className="font-display font-bold text-3xl text-ink mb-2">Index</h1>
      <p className="font-body text-ink/60 mb-6">
        Extract a back-of-book index of names, places, and recurring terms with their chapter references.
      </p>

      <button
        disabled={!groqApiKey || isProcessing}
        onClick={async () => {
          setError(null);
          try {
            await buildIndex();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
        className="flex items-center gap-2 bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-4 py-2 disabled:opacity-30 mb-4"
      >
        {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <ListTree size={15} />}
        {indexEntries.length > 0 ? 'Rebuild index' : 'Build index'}
      </button>

      {!groqApiKey && (
        <p className="text-sm text-brass-dim mb-4">Add a Groq API key (AI Settings, bottom of the sidebar) to build the index.</p>
      )}
      {error && <p className="text-sm text-rust mb-4">{error}</p>}

      <div className="bg-paper border border-paper-dim p-5 max-h-[45vh] overflow-y-auto">
        {indexEntries.length === 0 ? (
          <p className="text-sm text-ink/40 font-body">No index entries yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
            {indexEntries.map((e) => (
              <li key={e.term} className="flex items-center justify-between text-sm text-ink/80 py-1 border-b border-paper-dim/70">
                <span>
                  <strong className="text-ink">{e.term}</strong>{' '}
                  <span className="font-mono text-xs text-ink/40">
                    {e.chapterNumbers.map((n) => `Ch.${n}`).join(', ')}
                  </span>
                </span>
                <button onClick={() => removeEntry(e.term)} className="text-ink/30 hover:text-rust">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => setStage('cover')}
        className="mt-8 flex items-center gap-2 bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-5 py-2.5"
      >
        Continue to cover design <ArrowRight size={16} />
      </button>
    </div>
  );
}
