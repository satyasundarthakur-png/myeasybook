import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useBookStore } from '../store/useBookStore';

const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'];

export default function AiSettingsPanel() {
  const { groqApiKey, groqModel, setGroqSettings } = useBookStore();
  const [open, setOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState(groqApiKey);
  const [modelDraft, setModelDraft] = useState(groqModel);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-md transition-all group font-mono"
      >
        <Settings className="h-4 w-4 text-slate-500 group-hover:text-amber-500 transition-colors" />
        <span>AI SETTINGS</span>
        {!groqApiKey && <span className="ml-auto text-rust text-[10px] normal-case">not set</span>}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-72 bg-sidebar-raised border border-slate-800 shadow-xl p-4 z-20">
          <p className="font-body text-xs text-slate-400 mb-3">
            Your Groq API key stays in this browser (localStorage) — it is never sent anywhere except
            api.groq.com.
          </p>
          <label className="block text-xs font-mono text-slate-500 mb-1 tracking-wide">API KEY</label>
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="gsk_..."
            className="w-full bg-sidebar border border-slate-800 px-2 py-1.5 text-sm text-white mb-3 focus:border-amber-500/50 focus:outline-none"
          />
          <label className="block text-xs font-mono text-slate-500 mb-1 tracking-wide">MODEL</label>
          <select
            value={modelDraft}
            onChange={(e) => setModelDraft(e.target.value)}
            className="w-full bg-sidebar border border-slate-800 px-2 py-1.5 text-sm text-white mb-3 focus:border-amber-500/50 focus:outline-none"
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
