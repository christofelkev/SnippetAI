import { invoke, convertFileSrc } from '@tauri-apps/api/core';

/**
 * Handles pasting images from clipboard into a textarea.
 * Intercepts the paste event, saves the image to disk via Tauri backend,
 * and inserts a markdown image reference at the cursor position.
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
      const file = items[i].getAsFile();
      if (!file) continue;

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      try {
        const savedPath = await invoke<string>('save_image_to_disk', {
          bytes: Array.from(uint8Array),
        });

        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        let assetUrl = savedPath.replace(/\\/g, '/');
        try {
          assetUrl = convertFileSrc(savedPath);
        } catch {
          // fallback to raw path
        }

        const markdownImage = `\n![Pasted Image](${assetUrl})\n`;
        const newContent =
          currentContent.substring(0, start) +
          markdownImage +
          currentContent.substring(end);

        return newContent;
      } catch (err) {
        console.error('Failed to save pasted image:', err);
        return null;
      }
    }
  }

  return null;
}
