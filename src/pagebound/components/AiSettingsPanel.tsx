import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';
import type { AiProviderId } from '../lib/aiTypes';

const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'];
const GEMINI_MODELS = ['gemini-2.5-flash-lite'];

// Groq listed first — it's the default/primary provider; Gemini is an
// additional option, not a replacement.
const PROVIDERS: { id: AiProviderId; label: string }[] = [
  { id: 'groq', label: 'Groq' },
  { id: 'gemini', label: 'Google Gemini' },
];

export default function AiSettingsPanel() {
  const { aiProvider, groqApiKey, groqModel, geminiApiKey, geminiModel, setAiProvider, setGroqSettings, setGeminiSettings } =
    useBookStore();
  const [open, setOpen] = useState(false);

  const [providerDraft, setProviderDraft] = useState<AiProviderId>(aiProvider);
  const [groqKeyDraft, setGroqKeyDraft] = useState(groqApiKey);
  const [groqModelDraft, setGroqModelDraft] = useState(groqModel);
  const [geminiKeyDraft, setGeminiKeyDraft] = useState(geminiApiKey);
  const [geminiModelDraft, setGeminiModelDraft] = useState(geminiModel);

  const activeKeySet = aiProvider === 'gemini' ? Boolean(geminiApiKey) : Boolean(groqApiKey);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-md transition-all group font-mono"
      >
        <Settings className="h-4 w-4 text-slate-500 group-hover:text-amber-500 transition-colors" />
        <span>AI SETTINGS</span>
        {!activeKeySet && <span className="ml-auto text-rust text-[10px] normal-case">not set</span>}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-72 bg-rail-raised border border-slate-800 shadow-xl p-4 z-20">
          <p className="font-body text-xs text-slate-400 mb-3">
            Your API key stays in this browser (localStorage) — it is never sent anywhere except the
            provider's own API.
          </p>

          <label className="block text-xs font-mono text-slate-500 mb-1 tracking-wide">PROVIDER</label>
          <select
            value={providerDraft}
            onChange={(e) => setProviderDraft(e.target.value as AiProviderId)}
            className="w-full bg-rail border border-slate-800 px-2 py-1.5 text-sm text-white mb-3 focus:border-amber-500/50 focus:outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          {providerDraft === 'groq' ? (
            <>
              <label className="block text-xs font-mono text-slate-500 mb-1 tracking-wide">GROQ API KEY</label>
              <input
                type="password"
                value={groqKeyDraft}
                onChange={(e) => setGroqKeyDraft(e.target.value)}
                placeholder="gsk_..."
                className="w-full bg-rail border border-slate-800 px-2 py-1.5 text-sm text-white mb-3 focus:border-amber-500/50 focus:outline-none"
              />
              <label className="block text-xs font-mono text-slate-500 mb-1 tracking-wide">MODEL</label>
              <select
                value={groqModelDraft}
                onChange={(e) => setGroqModelDraft(e.target.value)}
                className="w-full bg-rail border border-slate-800 px-2 py-1.5 text-sm text-white mb-3 focus:border-amber-500/50 focus:outline-none"
              >
                {GROQ_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="block text-xs font-mono text-slate-500 mb-1 tracking-wide">GEMINI API KEY</label>
              <input
                type="password"
                value={geminiKeyDraft}
                onChange={(e) => setGeminiKeyDraft(e.target.value)}
                placeholder="AIza..."
                className="w-full bg-rail border border-slate-800 px-2 py-1.5 text-sm text-white mb-3 focus:border-amber-500/50 focus:outline-none"
              />
              <label className="block text-xs font-mono text-slate-500 mb-1 tracking-wide">MODEL</label>
              <select
                value={geminiModelDraft}
                onChange={(e) => setGeminiModelDraft(e.target.value)}
                className="w-full bg-rail border border-slate-800 px-2 py-1.5 text-sm text-white mb-3 focus:border-amber-500/50 focus:outline-none"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            onClick={() => {
              setGroqSettings(groqKeyDraft, groqModelDraft);
              setGeminiSettings(geminiKeyDraft, geminiModelDraft);
              setAiProvider(providerDraft);
              setOpen(false);
            }}
            className="w-full bg-crimson hover:bg-crimson-bright text-white font-semibold text-sm py-2 rounded-md"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
