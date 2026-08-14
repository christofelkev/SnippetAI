import { useState, useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { Search } from 'lucide-react';
import { tauriApi, Snippet } from '../lib/tauri';
import { filterSnippets } from '../lib/quickpaste';
import { stripImageMarkdown } from '../lib/content';

export default function QuickPaste() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pasteError, setPasteError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const win = getCurrentWebviewWindow();

  const results = filterSnippets(snippets, query);

  const load = async () => {
    try {
      setSnippets(await tauriApi.getSnippets());
    } catch (e) {
      console.error('QuickPaste load failed:', e);
    }
  };

  useEffect(() => {
    load();
    inputRef.current?.focus();
    const unlisten = win.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        load();
        setQuery('');
        setActive(0);
        setPasteError('');
        inputRef.current?.focus();
      } else {
        win.hide();
      }
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  useEffect(() => { setActive(0); setPasteError(''); }, [query]);

  const choose = async (s: Snippet) => {
    try {
      await writeText(stripImageMarkdown(s.content));
    } catch (e) {
      console.error('QuickPaste clipboard write failed:', e);
      setPasteError('Gagal menyalin ke clipboard — coba lagi.');
      return;
    }
    await win.hide();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      win.hide();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-900 text-zinc-100 rounded-lg border border-zinc-700 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-zinc-800">
        <Search className="w-4 h-4 text-zinc-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search snippets… (Enter to copy, Esc to close)"
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder-zinc-600"
        />
      </div>
      {pasteError && (
        <div className="px-3 py-1.5 text-[11px] text-red-400 bg-red-950/30 border-b border-zinc-800">
          {pasteError}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-600">No snippets found</div>
        ) : (
          results.map((s, i) => (
            <button
              key={s.id}
              onClick={() => choose(s)}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-left px-4 py-2.5 border-b border-zinc-800/60 ${
                i === active ? 'bg-indigo-600/20' : 'hover:bg-zinc-800/40'
              }`}
            >
              <div className="text-sm font-medium text-zinc-200 truncate">{s.title}</div>
              <div className="text-xs text-zinc-500 truncate font-mono">
                {stripImageMarkdown(s.content).split('\n')[0]}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
