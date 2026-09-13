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
import { registerHotkey, DEFAULT_HOTKEY } from './lib/hotkey';
import { Search, Plus, Settings } from 'lucide-react';

const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 450;

const DEFAULT_LIST_WIDTH = 320;
const MIN_LIST_WIDTH = 220;
const MAX_LIST_WIDTH = 600;

function getStoredWidth(key: string, defaultVal: number, min: number, max: number): number {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= min && parsed <= max) {
        return parsed;
      }
    }
  } catch {}
  return defaultVal;
}

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  title?: string;
}

function ResizeHandle({ onMouseDown, onDoubleClick, title }: ResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title={title || 'Drag to resize (Double-click to reset)'}
      className="group relative w-1 bg-zinc-800 hover:bg-indigo-500 active:bg-indigo-500 cursor-col-resize transition-colors select-none shrink-0 z-10"
    >
      <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
    </div>
  );
}

function App() {
  const snippetsState = useSnippets();
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [sidebarWidth, setSidebarWidth] = useState(() =>
    getStoredWidth('snippetai_sidebar_width', DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)
  );
  const [listWidth, setListWidth] = useState(() =>
    getStoredWidth('snippetai_list_width', DEFAULT_LIST_WIDTH, MIN_LIST_WIDTH, MAX_LIST_WIDTH)
  );

  const startResizeSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + delta));
      setSidebarWidth(nextWidth);
      try {
        localStorage.setItem('snippetai_sidebar_width', String(nextWidth));
      } catch {}
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startResizeList = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = listWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.max(MIN_LIST_WIDTH, Math.min(MAX_LIST_WIDTH, startWidth + delta));
      setListWidth(nextWidth);
      try {
        localStorage.setItem('snippetai_list_width', String(nextWidth));
      } catch {}
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

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

  useEffect(() => {
    tauriApi.getSetting('global_hotkey').then(hk => {
      registerHotkey(hk || DEFAULT_HOTKEY).catch(() =>
        showToast('Hotkey gagal didaftarkan — mungkin sudah dipakai aplikasi lain.')
      );
    });
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-transparent text-zinc-100">
      <Sidebar 
        groups={snippetsState.groups}
        groupCounts={snippetsState.groupCounts}
        selectedGroup={snippetsState.selectedGroup}
        onSelectGroup={snippetsState.setSelectedGroup}
        width={sidebarWidth}
        onReorderGroups={snippetsState.reorderGroups}
      />

      <ResizeHandle
        onMouseDown={startResizeSidebar}
        onDoubleClick={() => {
          setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
          try {
            localStorage.setItem('snippetai_sidebar_width', String(DEFAULT_SIDEBAR_WIDTH));
          } catch {}
        }}
        title="Drag to resize sidebar (Double-click to reset)"
      />
      
      <div 
        style={{ width: `${listWidth}px` }}
        className="flex flex-col shrink-0 bg-zinc-900/40 overflow-hidden"
      >
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

      <ResizeHandle
        onMouseDown={startResizeList}
        onDoubleClick={() => {
          setListWidth(DEFAULT_LIST_WIDTH);
          try {
            localStorage.setItem('snippetai_list_width', String(DEFAULT_LIST_WIDTH));
          } catch {}
        }}
        title="Drag to resize snippet list (Double-click to reset)"
      />
      
      <div className="flex-1 min-w-0 bg-zinc-950/20 flex flex-col">
        {selectedSnippet ? (
          <DetailView 
            snippet={selectedSnippet}
            allSnippets={snippetsState.snippets}
            onUpdate={(title, content, group, language) => snippetsState.updateSnippet(selectedSnippet.id, title, content, group, language)}
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
          onAdd={async (title, content, group, language) => {
            await snippetsState.addSnippet(title, content, group, language);
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
