import { useState } from 'react';
import { X } from 'lucide-react';
import { handleImagePaste } from '../lib/imagePaste';

interface AddPanelProps {
  onClose: () => void;
  onAdd: (title: string, content: string, group: string) => void;
  groups: string[];
}

export default function AddPanel({ onClose, onAdd, groups }: AddPanelProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [group, setGroup] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Add New Snippet</h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g. Docker build command"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              onPaste={async (e) => {
                const newContent = await handleImagePaste(e, content);
                if (newContent !== null) setContent(newContent);
              }}
              className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 font-mono text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              placeholder="docker build -t my-app . (or paste an image!)"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Group (Optional)</label>
            <input
              type="text"
              value={group}
              onChange={e => setGroup(e.target.value)}
              list="group-list"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors uppercase"
              placeholder="e.g. DOCKER"
            />
            <datalist id="group-list">
              {groups.map(g => (
                <option key={g} value={g} />
              ))}
            </datalist>
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
            onClick={() => onAdd(title, content, group)}
            disabled={!title || !content}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Snippet
          </button>
        </div>
      </div>
    </div>
  );
}
