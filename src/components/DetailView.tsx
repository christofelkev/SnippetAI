import { useState, useEffect } from 'react';
import { Snippet } from '../lib/tauri';
import ContentEditor from './ContentEditor';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { Copy, Trash2, Check } from 'lucide-react';

interface DetailViewProps {
  snippet: Snippet;
  allSnippets: Snippet[];
  onUpdate: (title: string, content: string, group: string) => void;
  onDelete: () => void;
  onCopy: () => void;
  onSelectSnippet: (snippet: Snippet) => void;
}

export default function DetailView({ snippet, allSnippets, onUpdate, onDelete, onCopy, onSelectSnippet }: DetailViewProps) {
  const [title, setTitle] = useState(snippet.title);
  const [content, setContent] = useState(snippet.content);
  const [group, setGroup] = useState(snippet.group_name);
  const [isCopied, setIsCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setTitle(snippet.title);
    setContent(snippet.content);
    setGroup(snippet.group_name);
  }, [snippet]);

  const handleSave = () => {
    if (title !== snippet.title || content !== snippet.content || group !== snippet.group_name) {
      onUpdate(title, content, group);
    }
  };

  const handleCopy = async () => {
    await writeText(content);
    setIsCopied(true);
    onCopy();
    setTimeout(() => setIsCopied(false), 2000);
  };


  // Find related snippets offline based on simple token overlap
  const relatedSnippets = allSnippets
    .filter(s => s.id !== snippet.id)
    .map(s => {
      const tokensA = new Set(content.toLowerCase().split(/\W+/).filter(t => t.length > 2));
      const tokensB = new Set(s.content.toLowerCase().split(/\W+/).filter(t => t.length > 2));
      let intersection = 0;
      for (const t of tokensB) if (tokensA.has(t)) intersection++;
      const score = intersection / (tokensA.size + tokensB.size - intersection || 1);
      return { snippet: s, score };
    })
    .filter(x => x.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="p-6 border-b border-zinc-800 flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleSave}
            className="w-full bg-transparent text-2xl font-semibold text-zinc-100 placeholder-zinc-700 border-none focus:outline-none focus:ring-0 p-0"
            placeholder="Snippet Title"
          />
          <input
            type="text"
            value={group}
            onChange={e => setGroup(e.target.value)}
            onBlur={handleSave}
            className="w-1/3 bg-transparent text-xs font-medium text-zinc-500 uppercase tracking-wider placeholder-zinc-700 border-none focus:outline-none focus:ring-0 p-0"
            placeholder="Group (e.g. DOCKER)"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
            title="Delete Snippet"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto">
        <ContentEditor
          content={content}
          onChange={setContent}
          onSave={handleSave}
        />
      </div>

      {relatedSnippets.length > 0 && (
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/30">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Related Snippets</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedSnippets.map(({ snippet: s, score }) => (
              <button
                key={s.id}
                onClick={() => onSelectSnippet(s)}
                className="text-left p-3 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="font-medium text-sm text-zinc-300 truncate mb-1">{s.title}</div>
                <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(score * 100, 100)}%` }} />
                </div>
              </button>
            ))}
      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Delete Snippet</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Are you sure you want to delete <span className="text-zinc-300 font-medium">"{title}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-md transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
