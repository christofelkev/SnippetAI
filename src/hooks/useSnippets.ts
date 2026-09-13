import { useState, useEffect, useCallback, useMemo } from 'react';
import { Snippet, tauriApi } from '../lib/tauri';

const GROUP_ORDER_KEY = 'snippetai_group_order';

function getStoredGroupOrder(): string[] {
  try {
    const saved = localStorage.getItem(GROUP_ORDER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => typeof item === 'string');
      }
    }
  } catch {}
  return [];
}

export function useSnippets() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupOrder, setGroupOrder] = useState<string[]>(getStoredGroupOrder);

  const reorderGroups = useCallback((newOrder: string[]) => {
    setGroupOrder(newOrder);
    try {
      localStorage.setItem(GROUP_ORDER_KEY, JSON.stringify(newOrder));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchSnippets = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim() === '') {
        const data = await tauriApi.getSnippets();
        setSnippets(data);
      } else {
        const data = await tauriApi.searchSnippets(searchQuery);
        setSnippets(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchSnippets();
  }, [fetchSnippets]);

  const addSnippet = async (title: string, content: string, groupName: string = '', language: string = '') => {
    await tauriApi.addSnippet(title, content, groupName, language);
    fetchSnippets();
  };

  const updateSnippet = async (id: string, title?: string, content?: string, groupName?: string, language?: string) => {
    await tauriApi.updateSnippet(id, title, content, groupName, language);
    fetchSnippets();
  };

  const deleteSnippet = async (id: string) => {
    await tauriApi.deleteSnippet(id);
    fetchSnippets();
  };

  const applyGroups = async (groups: [string, string][]) => {
    await tauriApi.applyGroups(groups);
    fetchSnippets();
  };

  const filteredSnippets = selectedGroup 
    ? snippets.filter(s => s.group_name === selectedGroup)
    : snippets;

  const rawGroups = useMemo(
    () => Array.from(new Set(snippets.map(s => s.group_name).filter(Boolean))),
    [snippets]
  );

  const groups = useMemo(() => {
    const orderMap = new Map<string, number>();
    groupOrder.forEach((name, index) => {
      orderMap.set(name, index);
    });

    return [...rawGroups].sort((a, b) => {
      const indexA = orderMap.has(a) ? orderMap.get(a)! : Number.MAX_SAFE_INTEGER;
      const indexB = orderMap.has(b) ? orderMap.get(b)! : Number.MAX_SAFE_INTEGER;
      if (indexA !== indexB) {
        return indexA - indexB;
      }
      return a.localeCompare(b);
    });
  }, [rawGroups, groupOrder]);

  const groupCounts = useMemo(() => {
    return groups.reduce((acc, group) => {
      acc[group] = snippets.filter(s => s.group_name === group).length;
      return acc;
    }, {} as Record<string, number>);
  }, [groups, snippets]);

  return {
    snippets: filteredSnippets,
    allSnippets: snippets, // For AI grouping
    loading,
    searchQuery,
    setSearchQuery,
    selectedGroup,
    setSelectedGroup,
    groups,
    groupCounts,
    reorderGroups,
    addSnippet,
    updateSnippet,
    deleteSnippet,
    applyGroups,
    refresh: fetchSnippets
  };
}
