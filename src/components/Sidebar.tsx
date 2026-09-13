import { useState } from 'react';
import { Folder, FolderOpen, GripVertical } from 'lucide-react';

interface SidebarProps {
  groups: string[];
  groupCounts: Record<string, number>;
  selectedGroup: string | null;
  onSelectGroup: (group: string | null) => void;
  width?: number;
  onReorderGroups?: (newOrder: string[]) => void;
}

export default function Sidebar({
  groups,
  groupCounts,
  selectedGroup,
  onSelectGroup,
  width,
  onReorderGroups,
}: SidebarProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'above' | 'below' } | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number, group: string) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', group);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex === index) {
      setDropTarget(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';

    if (dropTarget?.index !== index || dropTarget?.position !== position) {
      setDropTarget({ index, position });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the element itself, not entering a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === targetIndex || !onReorderGroups) {
      setDraggedIndex(null);
      setDropTarget(null);
      return;
    }

    const reordered = [...groups];
    const [movedItem] = reordered.splice(draggedIndex, 1);

    let targetPos = targetIndex;
    if (dropTarget?.position === 'below') {
      targetPos = draggedIndex < targetIndex ? targetIndex : targetIndex + 1;
    } else {
      targetPos = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    }
    targetPos = Math.max(0, Math.min(reordered.length, targetPos));

    reordered.splice(targetPos, 0, movedItem);
    onReorderGroups(reordered);

    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  return (
    <div
      style={width !== undefined ? { width: `${width}px` } : undefined}
      className={`${width === undefined ? 'w-64' : ''} shrink-0 bg-zinc-950/40 flex flex-col h-full overflow-hidden`}
    >
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

        {groups.map((group, index) => {
          const isSelected = selectedGroup === group;
          const isDragging = draggedIndex === index;
          const isDropAbove = dropTarget?.index === index && dropTarget.position === 'above';
          const isDropBelow = dropTarget?.index === index && dropTarget.position === 'below';

          return (
            <div
              key={group}
              draggable
              onDragStart={e => handleDragStart(e, index, group)}
              onDragOver={e => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative group rounded-md transition-all ${
                isDragging ? 'opacity-40' : 'opacity-100'
              }`}
            >
              {/* Insertion line indicator above */}
              {isDropAbove && (
                <div className="absolute -top-1 left-2 right-2 h-0.5 bg-indigo-500 rounded-full z-20 shadow-[0_0_8px_rgba(99,102,241,0.8)] pointer-events-none" />
              )}

              <button
                onClick={() => onSelectGroup(group)}
                title="Drag to reorder"
                className={`w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-md transition-colors ${
                  isSelected
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 cursor-grab active:cursor-grabbing shrink-0 transition-colors -ml-1" />
                  {isSelected ? (
                    <FolderOpen className="w-4 h-4 shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">{group}</span>
                </div>
                <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full shrink-0 ml-1">
                  {groupCounts[group] ?? 0}
                </span>
              </button>

              {/* Insertion line indicator below */}
              {isDropBelow && (
                <div className="absolute -bottom-1 left-2 right-2 h-0.5 bg-indigo-500 rounded-full z-20 shadow-[0_0_8px_rgba(99,102,241,0.8)] pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

