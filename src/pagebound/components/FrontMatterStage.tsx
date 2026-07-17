import { useState } from 'react';
import { PenLine, ArrowRight, Loader2 } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';

export default function FrontMatterStage() {
  const { introduction, generateIntro, setStage, groqApiKey, isProcessing } = useBookStore();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="h-full overflow-y-auto max-w-3xl mx-auto py-12 px-6">
      <p className="font-mono text-[11px] tracking-[0.2em] text-crimson uppercase font-semibold mb-3">No. 04 — Front Matter</p>
      <h1 className="font-display font-bold text-3xl text-ink mb-2">Introduction</h1>
      <p className="font-body text-ink/60 mb-6">
        Generate a draft introduction from your chapters, then edit it to match your voice.
      </p>

      <button
        disabled={!groqApiKey || isProcessing}
        onClick={async () => {
          setError(null);
          try {
            await generateIntro();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
        className="flex items-center gap-2 bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-4 py-2 disabled:opacity-30 mb-4"
      >
        {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <PenLine size={15} />}
        {introduction ? 'Regenerate introduction' : 'Generate introduction'}
      </button>

      {!groqApiKey && (
        <p className="text-sm text-brass-dim mb-4">Add a Groq API key (AI Settings, bottom of the sidebar) to generate a draft.</p>
      )}
      {error && <p className="text-sm text-rust mb-4">{error}</p>}

      <textarea
        value={introduction ?? ''}
        onChange={(e) => useBookStore.setState({ introduction: e.target.value })}
        placeholder="Your introduction will appear here — or write your own directly."
        className="w-full h-[45vh] bg-paper border border-paper-dim p-5 font-display text-[15px] text-ink leading-relaxed resize-none"
      />

      <button
        onClick={() => setStage('index')}
        className="mt-8 flex items-center gap-2 bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold px-5 py-2.5"
      >
        Continue to index <ArrowRight size={16} />
      </button>
    </div>
  );
}
