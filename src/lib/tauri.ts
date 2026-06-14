import { invoke } from '@tauri-apps/api/core';

export interface Snippet {
  id: string;
  title: string;
  content: string;
  group_name: string;
  created_at: number;
  updated_at: number;
}

export const tauriApi = {
  getSnippets: () => invoke<Snippet[]>('get_snippets'),
  
  addSnippet: (title: string, content: string, groupName?: string) => 
    invoke<Snippet>('add_snippet', { title, content, groupName }),
  
  updateSnippet: (id: string, title?: string, content?: string, groupName?: string) => 
    invoke<Snippet>('update_snippet', { id, title, content, groupName }),
  
  deleteSnippet: (id: string) => invoke<void>('delete_snippet', { id }),
  
  searchSnippets: (query: string) => invoke<Snippet[]>('search_snippets', { query }),
  
  applyGroups: (groups: [string, string][]) => invoke<void>('apply_groups', { groups }),
  
  getSetting: (key: string) => invoke<string | null>('get_setting', { key }),
  
  setSetting: (key: string, value: string) => invoke<void>('set_setting', { key, value }),
};
