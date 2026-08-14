import { describe, it, expect } from 'vitest';
import { withEditableGaps, type ContentBlock } from './ContentEditor';

const text = (value: string): ContentBlock => ({ type: 'text', value });
const image = (value = 'asset://img'): ContentBlock => ({ type: 'image', alt: 'Image', value });

describe('withEditableGaps', () => {
  it('gives an empty block list a single empty text block', () => {
    expect(withEditableGaps([])).toEqual([text('')]);
  });

  it('wraps a lone image with empty text blocks on both sides', () => {
    expect(withEditableGaps([image()])).toEqual([text(''), image(), text('')]);
  });

  it('inserts an empty text block between two adjacent images, and at both ends', () => {
    expect(withEditableGaps([image('a'), image('b')])).toEqual([
      text(''),
      image('a'),
      text(''),
      image('b'),
      text(''),
    ]);
  });

  it('leaves an already-well-formed [text, image, text] unchanged', () => {
    const blocks = [text('before'), image(), text('after')];
    expect(withEditableGaps(blocks)).toEqual(blocks);
  });

  it('adds only a trailing empty text block to [text, image]', () => {
    expect(withEditableGaps([text('before'), image()])).toEqual([
      text('before'),
      image(),
      text(''),
    ]);
  });
});
