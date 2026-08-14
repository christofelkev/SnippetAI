import { describe, it, expect } from 'vitest';
import { filterSnippets } from './quickpaste';
import { Snippet } from './tauri';

const mk = (id: string, title: string, content: string): Snippet => ({
  id, title, content, group_name: '', language: '', created_at: 0, updated_at: 0,
});

const data = [
  mk('1', 'Docker build', 'docker build -t app .'),
  mk('2', 'Git reset', 'git reset --hard'),
];

describe('filterSnippets', () => {
  it('returns all snippets for an empty query', () => {
    expect(filterSnippets(data, '  ')).toHaveLength(2);
  });
  it('matches on title, case-insensitively', () => {
    expect(filterSnippets(data, 'DOCKER').map(s => s.id)).toEqual(['1']);
  });
  it('matches on content', () => {
    expect(filterSnippets(data, '--hard').map(s => s.id)).toEqual(['2']);
  });
  it('returns [] when nothing matches', () => {
    expect(filterSnippets(data, 'kubernetes')).toEqual([]);
  });
});
