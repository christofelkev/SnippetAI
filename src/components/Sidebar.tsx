import { Folder, FolderOpen } from 'lucide-react';

interface SidebarProps {
  groups: string[];
  groupCounts: Record<string, number>;
  selectedGroup: string | null;
  onSelectGroup: (group: string | null) => void;
}

export default function Sidebar({ groups, groupCounts, selectedGroup, onSelectGroup }: SidebarProps) {
  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold tracking-wider text-zinc-500 uppercase">Groups</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <button
          onClick={() => onSelectGroup(null)}
          className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
            selectedGroup === null ? 'bg-indigo-600/20 text-indigo-400' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {selectedGroup === null ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
            <span>All Snippets</span>
          </div>
        </button>
        {groups.map(group => (
          <button
            key={group}
            onClick={() => onSelectGroup(group)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
              selectedGroup === group ? 'bg-indigo-600/20 text-indigo-400' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {selectedGroup === group ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
              <span className="truncate">{group}</span>
            </div>
            <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full">{groupCounts[group]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
