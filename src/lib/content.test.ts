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

  it('removes an image whose alt text has one level of nested brackets', () => {
    expect(
      stripImageMarkdown('x ![Pasted [Image]](http://foo/bar.png) y')
    ).toBe('x  y');
  });

  it('removes an image whose URL has a parenthesis, without leaving a stray paren', () => {
    expect(
      stripImageMarkdown(
        'before ![alt](https://en.wikipedia.org/wiki/Foo_(bar)) after'
      )
    ).toBe('before  after');
  });

  it('removes multiple images with nested brackets/parens independently', () => {
    expect(
      stripImageMarkdown(
        '![a [x]](http://a/(1).png)mid![b](http://b/(2)/y.png)end'
      )
    ).toBe('midend');
  });

  it('removes an image whose alt text has two levels of nested brackets', () => {
    expect(
      stripImageMarkdown('x ![a [b [c]] d](http://foo/bar.png) y')
    ).toBe('x  y');
  });

  it('removes an image whose URL has two levels of nested parens', () => {
    expect(
      stripImageMarkdown('before ![alt](http://foo/(a(b)c)) after')
    ).toBe('before  after');
  });

  it('removes an image with three levels of nested brackets and parens', () => {
    expect(
      stripImageMarkdown(
        'A ![t1 [t2 [t3]]](http://host/(p1(p2(p3)))) B'
      )
    ).toBe('A  B');
  });

  it('leaves an unbalanced/malformed image untouched with no partial deletion', () => {
    expect(stripImageMarkdown('![a](http://foo/bar(baz')).toBe(
      '![a](http://foo/bar(baz'
    );
  });
});
