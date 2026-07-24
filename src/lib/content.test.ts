import { describe, it, expect } from 'vitest';
import { stripImageMarkdown } from './content';

describe('stripImageMarkdown', () => {
  it('removes a single image markdown', () => {
    expect(
      stripImageMarkdown('a\n![Pasted Image](http://asset.localhost/x.png)\nb')
    ).toBe('a\n\nb');
  });

  it('collapses extra blank lines left behind', () => {
    expect(stripImageMarkdown('code\n\n![i](u)\n\nmore')).toBe('code\n\nmore');
  });

  it('leaves plain code untouched', () => {
    expect(stripImageMarkdown('docker build -t app .')).toBe('docker build -t app .');
  });

  it('removes multiple images', () => {
    expect(stripImageMarkdown('![a](1)x![b](2)y')).toBe('xy');
  });
});
