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
      language: '',
    });
  });

  it('defaults missing fields to empty strings', () => {
    expect(normalizeMetadata({})).toEqual({ title: '', group: '', language: '' });
  });

  it('defaults non-string fields to empty strings', () => {
    expect(normalizeMetadata({ title: 42, group: null, language: 7 })).toEqual({
      title: '',
      group: '',
      language: '',
    });
  });

  it('leaves an empty group as-is rather than uppercasing garbage', () => {
    expect(normalizeMetadata({ title: 'x', group: '' })).toEqual({ title: 'x', group: '', language: '' });
  });

  it('lowercases a valid language', () => {
    expect(normalizeMetadata({ language: 'JavaScript' })).toEqual({ title: '', group: '', language: 'javascript' });
  });

  it('keeps an already-lowercase valid language', () => {
    expect(normalizeMetadata({ language: 'python' })).toEqual({ title: '', group: '', language: 'python' });
  });

  it('drops a language outside the supported set', () => {
    expect(normalizeMetadata({ language: 'cobol' })).toEqual({ title: '', group: '', language: '' });
  });

  it('drops a language that is only whitespace', () => {
    expect(normalizeMetadata({ language: '   ' })).toEqual({ title: '', group: '', language: '' });
  });
});
