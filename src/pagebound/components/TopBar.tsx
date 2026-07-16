import { useState } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';

const MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

export default function TopBar() {
  const { meta, setMeta, groqApiKey, groqModel, setGroqSettings, isProcessing, processingMessage } =
    useBookStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState(groqApiKey);
  const [modelDraft, setModelDraft] = useState(groqModel);

  return (
    <header className="flex items-center gap-4 px-6 py-4 border-b border-ink-faint bg-ink-soft">
      <input
        value={meta.title}
        onChange={(e) => setMeta({ title: e.target.value })}
        placeholder="Book title"
        className="bg-transparent font-display text-lg text-paper-bright placeholder:text-paper/30 border-b border-transparent focus:border-brass px-1 py-0.5 w-64"
      />
      <input
        value={meta.author}
        onChange={(e) => setMeta({ author: e.target.value })}
        placeholder="Author"
        className="bg-transparent font-body text-sm text-paper/70 placeholder:text-paper/30 border-b border-transparent focus:border-brass px-1 py-0.5 w-48"
      />

      <div className="flex-1" />

      {isProcessing && (
        <span className="flex items-center gap-2 text-brass-bright text-sm font-mono">
          <Loader2 size={14} className="animate-spin" /> {processingMessage}
        </span>
      )}

      <div className="relative">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-sm border border-ink-faint text-paper/70 hover:text-brass-bright hover:border-brass text-sm"
        >
          <Settings size={15} />
          Groq {groqApiKey ? '' : '(not set)'}
        </button>
        {settingsOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-ink-soft border border-ink-faint rounded-sm shadow-xl p-4 z-20">
            <p className="font-body text-xs text-paper/60 mb-2">
              Your Groq API key stays in this browser (localStorage) — it is never sent anywhere except
              api.groq.com.
            </p>
            <label className="block text-xs font-mono text-paper/50 mb-1">API KEY</label>
            <input
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="gsk_..."
              className="w-full bg-ink border border-ink-faint rounded-sm px-2 py-1.5 text-sm text-paper-bright mb-3"
            />
            <label className="block text-xs font-mono text-paper/50 mb-1">MODEL</label>
            <select
              value={modelDraft}
              onChange={(e) => setModelDraft(e.target.value)}
              className="w-full bg-ink border border-ink-faint rounded-sm px-2 py-1.5 text-sm text-paper-bright mb-3"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setGroqSettings(keyDraft, modelDraft);
                setSettingsOpen(false);
              }}
              className="w-full bg-brass hover:bg-brass-bright text-ink font-semibold text-sm rounded-sm py-2"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
