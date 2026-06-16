import { useState, useEffect } from 'react';
import { useSnippets } from './hooks/useSnippets';
import Sidebar from './components/Sidebar';
import SnippetList from './components/SnippetList';
import DetailView from './components/DetailView';
import AddPanel from './components/AddPanel';
import AIModal from './components/AIModal';
import Toast from './components/Toast';
import SettingsModal from './components/SettingsModal';
import { Snippet, tauriApi } from './lib/tauri';
import { Search, Plus, Settings } from 'lucide-react';

function App() {
  const snippetsState = useSnippets();
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const loadTheme = async () => {
    const theme = await tauriApi.getSetting('app_theme');
    document.body.className = theme || 'theme-default';
  };

  useEffect(() => {
    loadTheme();
  }, [isSettingsOpen]); // Reload theme when settings might have changed

  // Handle global shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setIsAddPanelOpen(true);
      }
      if (e.key === 'Escape') {
        setIsAddPanelOpen(false);
        setIsAIModalOpen(false);
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2000);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-transparent text-zinc-100">
      <Sidebar 
        groups={snippetsState.groups}
        groupCounts={snippetsState.groupCounts}
        selectedGroup={snippetsState.selectedGroup}
        onSelectGroup={snippetsState.setSelectedGroup}
      />
      
      <div className="flex flex-col w-1/3 border-r border-zinc-800 bg-zinc-900/60 backdrop-blur-sm">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              id="search-input"
              type="text" 
              placeholder="Search (Ctrl+K)" 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              value={snippetsState.searchQuery}
              onChange={(e) => snippetsState.setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsAddPanelOpen(true)}
            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors text-white"
            title="Add Snippet (Ctrl+N)"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        <SnippetList 
          snippets={snippetsState.snippets}
          selectedId={selectedSnippet?.id || null}
          onSelect={setSelectedSnippet}
          searchQuery={snippetsState.searchQuery}
        />
        
        <div className="p-3 border-t border-zinc-800 flex justify-between items-center bg-zinc-900">
          <button
            onClick={() => setIsAIModalOpen(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center gap-1"
          >
            <span className="text-indigo-400">✨</span> AI Grouping
          </button>
          
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 bg-zinc-950/30 backdrop-blur-sm flex flex-col">
        {selectedSnippet ? (
          <DetailView 
            snippet={selectedSnippet}
            allSnippets={snippetsState.snippets}
            onUpdate={(title, content, group) => snippetsState.updateSnippet(selectedSnippet.id, title, content, group)}
            onDelete={() => {
              snippetsState.deleteSnippet(selectedSnippet.id);
              setSelectedSnippet(null);
              showToast("Snippet deleted");
            }}
            onCopy={() => showToast("Copied!")}
            onSelectSnippet={setSelectedSnippet}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600">
            Select a snippet or create a new one
          </div>
        )}
      </div>

      {isAddPanelOpen && (
        <AddPanel 
          onClose={() => setIsAddPanelOpen(false)}
          onAdd={async (title, content, group) => {
            await snippetsState.addSnippet(title, content, group);
            setIsAddPanelOpen(false);
            showToast("Snippet added");
          }}
          groups={snippetsState.groups}
        />
      )}

      {isAIModalOpen && (
        <AIModal 
          onClose={() => setIsAIModalOpen(false)}
          snippets={snippetsState.allSnippets}
          onApplyGroups={async (groups) => {
            await snippetsState.applyGroups(groups);
            setIsAIModalOpen(false);
            showToast("Groups applied successfully!");
          }}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      {toastMsg && <Toast message={toastMsg} />}
    </div>
  );
}

export default App;
