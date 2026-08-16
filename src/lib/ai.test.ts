import { describe, it, expect } from 'vitest';
import { parseJsonResponse, normalizeMetadata } from './ai';

describe('parseJsonResponse', () => {
  it('parses a pure JSON object', () => {
    expect(parseJsonResponse('{"title":"a"}')).toEqual({ title: 'a' });
  });

  it('extracts JSON from surrounding prose', () => {
    expect(parseJsonResponse('Sure, here you go:\n{"title":"a"}\nHope that helps!')).toEqual({ title: 'a' });
  });

  it('throws on text with no JSON object', () => {
    expect(() => parseJsonResponse('no json here')).toThrow();
  });
});

describe('normalizeMetadata', () => {
  it('trims title and uppercases group', () => {
    expect(normalizeMetadata({ title: '  Docker build  ', group: 'docker' })).toEqual({
      title: 'Docker build',
      group: 'DOCKER',
    });
  });

  it('defaults missing fields to empty strings', () => {
    expect(normalizeMetadata({})).toEqual({ title: '', group: '' });
  });

  it('defaults non-string fields to empty strings', () => {
    expect(normalizeMetadata({ title: 42, group: null })).toEqual({ title: '', group: '' });
  });

  it('leaves an empty group as-is rather than uppercasing garbage', () => {
    expect(normalizeMetadata({ title: 'x', group: '' })).toEqual({ title: 'x', group: '' });
  });
});
