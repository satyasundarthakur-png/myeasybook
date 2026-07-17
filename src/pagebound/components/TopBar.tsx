import { useState } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';

const MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
];

export default function TopBar() {
  const { meta, setMeta, groqApiKey, groqModel, setGroqSettings, isProcessing, processingMessage, polishProgress } =
    useBookStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState(groqApiKey);
  const [modelDraft, setModelDraft] = useState(groqModel);

  const percent = polishProgress && polishProgress.total > 0
    ? Math.round((polishProgress.processed / polishProgress.total) * 100)
    : null;

  return (
    <header className="flex items-center gap-4 px-6 py-4 border-b border-paper-dim bg-paper-bright">
      <input
        value={meta.title}
        onChange={(e) => setMeta({ title: e.target.value })}
        placeholder="Book title"
        className="bg-transparent font-display italic text-lg text-ink placeholder:text-ink/25 border-b border-transparent focus:border-crimson px-1 py-0.5 w-64"
      />
      <input
        value={meta.author}
        onChange={(e) => setMeta({ author: e.target.value })}
        placeholder="Author"
        className="bg-transparent font-body text-sm text-ink/60 placeholder:text-ink/25 border-b border-transparent focus:border-crimson px-1 py-0.5 w-48"
      />

      <div className="flex-1" />

      {isProcessing && (
        <div className="flex items-center gap-3 text-crimson text-sm font-mono">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span className="whitespace-nowrap">{processingMessage}</span>
          {percent !== null && (
            <div className="w-32 h-1 bg-paper-dim overflow-hidden shrink-0">
              <div
                className="h-full bg-crimson transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 border border-paper-dim text-ink/70 hover:text-crimson hover:border-crimson text-sm"
        >
          <Settings size={15} />
          Groq {groqApiKey ? '' : '(not set)'}
        </button>
        {settingsOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-paper-bright border border-paper-dim shadow-xl p-4 z-20">
            <p className="font-body text-xs text-ink/60 mb-2">
              Your Groq API key stays in this browser (localStorage) — it is never sent anywhere except
              api.groq.com.
            </p>
            <label className="block text-xs font-mono text-ink/50 mb-1">API KEY</label>
            <input
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="gsk_..."
              className="w-full bg-paper border border-paper-dim px-2 py-1.5 text-sm text-ink mb-3"
            />
            <label className="block text-xs font-mono text-ink/50 mb-1">MODEL</label>
            <select
              value={modelDraft}
              onChange={(e) => setModelDraft(e.target.value)}
              className="w-full bg-paper border border-paper-dim px-2 py-1.5 text-sm text-ink mb-3"
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
              className="w-full bg-crimson hover:bg-crimson-bright text-paper-bright font-semibold text-sm py-2"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
