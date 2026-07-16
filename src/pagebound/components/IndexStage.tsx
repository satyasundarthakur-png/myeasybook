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
    <div className="max-w-3xl mx-auto py-12 px-6">
      <h1 className="font-display text-3xl text-paper-bright mb-2">Index</h1>
      <p className="font-body text-paper/60 mb-6">
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
        className="flex items-center gap-2 bg-brass hover:bg-brass-bright text-ink font-semibold px-4 py-2 rounded-sm disabled:opacity-30 mb-4"
      >
        {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <ListTree size={15} />}
        {indexEntries.length > 0 ? 'Rebuild index' : 'Build index'}
      </button>

      {!groqApiKey && (
        <p className="text-sm text-brass-bright mb-4">Add a Groq API key (top right) to build the index.</p>
      )}
      {error && <p className="text-sm text-leather-bright mb-4">{error}</p>}

      <div className="bg-ink-soft border border-ink-faint rounded-sm p-5 max-h-[45vh] overflow-y-auto">
        {indexEntries.length === 0 ? (
          <p className="text-sm text-paper/40 font-body">No index entries yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
            {indexEntries.map((e) => (
              <li key={e.term} className="flex items-center justify-between text-sm text-paper/80 py-1 border-b border-ink-faint/50">
                <span>
                  <strong className="text-paper-bright">{e.term}</strong>{' '}
                  <span className="font-mono text-xs text-paper/40">
                    {e.chapterNumbers.map((n) => `Ch.${n}`).join(', ')}
                  </span>
                </span>
                <button onClick={() => removeEntry(e.term)} className="text-paper/30 hover:text-leather-bright">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => setStage('cover')}
        className="mt-8 flex items-center gap-2 bg-brass hover:bg-brass-bright text-ink font-semibold px-5 py-2.5 rounded-sm"
      >
        Continue to cover design <ArrowRight size={16} />
      </button>
    </div>
  );
}
