import { Snippet } from '../lib/tauri';

interface SnippetListProps {
  snippets: Snippet[];
  selectedId: string | null;
  onSelect: (snippet: Snippet) => void;
  searchQuery: string;
}

export default function SnippetList({ snippets, selectedId, onSelect, searchQuery }: SnippetListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {snippets.length === 0 ? (
        <div className="p-4 text-sm text-zinc-500 text-center mt-10">
          No snippets found.
        </div>
      ) : (
        <div className="flex flex-col">
          {snippets.map(snippet => {
            const isSelected = selectedId === snippet.id;
            return (
              <button
                key={snippet.id}
                onClick={() => onSelect(snippet)}
                className={`text-left p-4 border-b border-zinc-800 transition-colors ${
                  isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-medium text-zinc-200 truncate pr-2">
                    {highlightText(snippet.title, searchQuery)}
                  </h3>
                  {snippet.group_name && (
                    <span className="text-[10px] uppercase tracking-wider bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded flex-shrink-0">
                      {snippet.group_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 line-clamp-2">
                  {highlightText(snippet.content, searchQuery)}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-indigo-500/30 text-indigo-200 rounded-sm">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
}
