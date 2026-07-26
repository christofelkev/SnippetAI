const IMAGE_MARKDOWN =
  /!\[(?:[^[\]]|\[[^[\]]*\])*\]\((?:[^()]|\([^()]*\))*\)/g;

/** Remove inline image markdown so only code lands on the clipboard. */
export function stripImageMarkdown(content: string): string {
  return content
    .replace(IMAGE_MARKDOWN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
