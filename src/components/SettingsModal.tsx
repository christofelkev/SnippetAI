import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { tauriApi } from '../lib/tauri';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [appTheme, setAppTheme] = useState('theme-default');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      tauriApi.getSetting('ai_provider'),
      tauriApi.getSetting('ai_api_key'),
      tauriApi.getSetting('ai_model'),
      tauriApi.getSetting('app_theme')
    ]).then(([p, k, m, t]) => {
      setProvider(p || 'deepseek');
      setApiKey(k || '');
      setModel(m || '');
      setAppTheme(t || 'theme-default');
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    await tauriApi.setSetting('ai_provider', provider);
    await tauriApi.setSetting('ai_api_key', apiKey);
    await tauriApi.setSetting('ai_model', model);
    await tauriApi.setSetting('app_theme', appTheme);
    onClose();
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">App Theme</label>
            <select
              value={appTheme}
              onChange={e => setAppTheme(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
            >
              <option value="theme-default">Default Dark</option>
              <option value="theme-hacker-red">Hacker Red</option>
              <option value="theme-ocean-blue">Ocean Blue (Light)</option>
              <option value="theme-cyberpunk">Cyberpunk</option>
            </select>
          </div>
          
          <hr className="border-zinc-800" />
          
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">AI Provider</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="sk-..."
            />
            <p className="text-[10px] text-zinc-500 mt-1">Key is stored locally in SQLite database.</p>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Model Override (Optional)</label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g. gpt-4, claude-3-opus..."
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-zinc-800 flex justify-end gap-2 bg-zinc-950/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
