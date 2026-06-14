import { useState, useEffect, useCallback } from 'react';
import { Snippet, tauriApi } from '../lib/tauri';

export function useSnippets() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

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

  const addSnippet = async (title: string, content: string, groupName: string = '') => {
    await tauriApi.addSnippet(title, content, groupName);
    fetchSnippets();
  };

  const updateSnippet = async (id: string, title?: string, content?: string, groupName?: string) => {
    await tauriApi.updateSnippet(id, title, content, groupName);
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

  const groups = Array.from(new Set(snippets.map(s => s.group_name).filter(Boolean)));
  const groupCounts = groups.reduce((acc, group) => {
    acc[group] = snippets.filter(s => s.group_name === group).length;
    return acc;
  }, {} as Record<string, number>);

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
    addSnippet,
    updateSnippet,
    deleteSnippet,
    applyGroups,
    refresh: fetchSnippets
  };
}
