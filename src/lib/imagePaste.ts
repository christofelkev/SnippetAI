import { invoke, convertFileSrc } from '@tauri-apps/api/core';

/**
 * Handles pasting images from clipboard into a textarea.
 * Saves the image via Tauri backend then inserts an asset:// URL as markdown.
 * 
 * @returns The new content string if an image was pasted, or null if no image was found.
 */
export async function handleImagePaste(
  e: React.ClipboardEvent<HTMLTextAreaElement>,
  currentContent: string
): Promise<string | null> {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();

      // Capture cursor position BEFORE any async work (currentTarget becomes null after await)
      const start = e.currentTarget.selectionStart || 0;
      const end = e.currentTarget.selectionEnd || 0;

      const file = items[i].getAsFile();
      if (!file) continue;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Backend returns the absolute file path
        const absolutePath = await invoke<string>('save_image_to_disk', {
          bytes: Array.from(uint8Array),
        });

        // Convert to asset:// URL that Tauri can serve
        const assetUrl = convertFileSrc(absolutePath);

        const markdownImage = `\n![Pasted Image](${assetUrl})\n`;
        const newContent =
          currentContent.substring(0, start) +
          markdownImage +
          currentContent.substring(end);

        return newContent;
      } catch (err: any) {
        console.error('Failed to save pasted image:', err);
        return null;
      }
    }
  }

  return null;
}
