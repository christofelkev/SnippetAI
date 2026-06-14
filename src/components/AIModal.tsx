import { useState, useEffect } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { Snippet, tauriApi } from '../lib/tauri';
import { groupSnippets, AIGroupingResult } from '../lib/ai';

interface AIModalProps {
  onClose: () => void;
  snippets: Snippet[];
  onApplyGroups: (groups: [string, string][]) => void;
}

export default function AIModal({ onClose, snippets, onApplyGroups }: AIModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIGroupingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAI = async () => {
    if (snippets.length === 0) {
      setError("No snippets to group.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const provider = await tauriApi.getSetting('ai_provider') || 'deepseek';
      let apiKey = await tauriApi.getSetting('ai_api_key');
      const model = await tauriApi.getSetting('ai_model');
      
      // Fallback to env if setting is empty
      if (!apiKey && import.meta.env.VITE_AI_API_KEY) {
        apiKey = import.meta.env.VITE_AI_API_KEY;
      }

      if (!apiKey) {
        throw new Error('AI API Key is not set. Please configure it in settings or .env');
      }

      const grouping = await groupSnippets(provider, apiKey, model, snippets);
      setResult(grouping);
    } catch (err: any) {
      setError(err.message || 'An error occurred during AI grouping');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    
    const updates: [string, string][] = [];
    for (const group of result.groups) {
      for (const id of group.snippet_ids) {
        updates.push([id, group.group_name]);
      }
    }
    
    onApplyGroups(updates);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-indigo-400">
            <Sparkles className="w-5 h-5" />
            <h2 className="text-lg font-semibold text-zinc-100">AI Snippet Grouping</h2>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          {!result && !loading && !error && (
            <div className="text-center py-10">
              <Sparkles className="w-12 h-12 text-indigo-500/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-200 mb-2">Organize with AI</h3>
              <p className="text-zinc-400 text-sm max-w-md mx-auto mb-6">
                Send your snippets to the AI to automatically categorize them based on their functionality and content.
              </p>
              <button
                onClick={runAI}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-medium transition-colors"
              >
                Analyze {snippets.length} Snippets
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
              <p>Analyzing and categorizing snippets...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
              <p className="font-semibold mb-1">Error</p>
              <p>{error}</p>
              <button onClick={runAI} className="mt-3 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 transition-colors">
                Try Again
              </button>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400 mb-4">
                AI suggested {result.groups.length} groups. Review them below before applying.
              </p>
              
              <div className="grid gap-4">
                {result.groups.map((group, idx) => (
                  <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-indigo-400 uppercase tracking-wide">{group.group_name}</h4>
                      <span className="text-xs font-medium bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                        {group.snippet_ids.length} items
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-3">{group.reason}</p>
                    <ul className="text-sm text-zinc-300 space-y-1">
                      {group.snippet_ids.map(id => {
                        const snippet = snippets.find(s => s.id === id);
                        return snippet ? <li key={id} className="truncate">• {snippet.title}</li> : null;
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {result && !loading && (
          <div className="p-4 border-t border-zinc-800 flex justify-end gap-2 bg-zinc-950">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
            >
              Apply Groupings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
