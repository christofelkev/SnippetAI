/**
 * Build a map from the index of every opening delimiter to the index of its
 * matching closing delimiter, using a single linear stack-based pass. A
 * delimiter that never closes (or a close with nothing open) is simply
 * absent from the map. Because matching is resolved via a LIFO stack, the
 * match found for a given open index depends only on the characters after
 * it, so this is equivalent to (but far cheaper than) re-scanning from every
 * candidate start position and counting nesting depth from scratch.
 */
function buildMatches(content: string, open: string, close: string): Map<number, number> {
  const stack: number[] = [];
  const matches = new Map<number, number>();
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === open) {
      stack.push(i);
    } else if (ch === close && stack.length > 0) {
      matches.set(stack.pop() as number, i);
    }
  }
  return matches;
}

/**
 * Scan the string once and drop every well-formed image markdown
 * (`![...](...)`), at any nesting depth of `[...]`/`(...)` inside the alt
 * text or URL. Anything that isn't a fully-balanced image (unbalanced
 * brackets/parens, no closing `)`, etc.) is left completely untouched.
 */
function removeImageMarkdown(content: string): string {
  const bracketMatches = buildMatches(content, '[', ']');
  const parenMatches = buildMatches(content, '(', ')');

  let result = '';
  let i = 0;
  while (i < content.length) {
    if (content[i] === '!' && content[i + 1] === '[') {
      const altClose = bracketMatches.get(i + 1);
      if (altClose !== undefined && content[altClose + 1] === '(') {
        const urlClose = parenMatches.get(altClose + 1);
        if (urlClose !== undefined) {
          i = urlClose + 1;
          continue;
        }
      }
    }
    result += content[i];
    i++;
  }
  return result;
}

/** Remove inline image markdown so only code lands on the clipboard. */
export function stripImageMarkdown(content: string): string {
  return removeImageMarkdown(content)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
