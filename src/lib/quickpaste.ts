import { Snippet } from './tauri';

export function filterSnippets(snippets: Snippet[], query: string): Snippet[] {
  const q = query.trim().toLowerCase();
  if (!q) return snippets;
  return snippets.filter(
    s => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
  );
}
