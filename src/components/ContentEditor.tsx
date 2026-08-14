import { useState, useRef, useEffect } from 'react';
import { handleImagePaste } from '../lib/imagePaste';
import Lightbox from './Lightbox';
import { ImageIcon, Trash2 } from 'lucide-react';
import hljs from 'highlight.js';

// Regex to match markdown images: ![alt](url)
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

export interface ContentBlock {
  type: 'text' | 'image';
  value: string;     // text content or image asset URL
  alt?: string;
}

function parseContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let lastIndex = 0;

  const regex = new RegExp(IMAGE_REGEX.source, 'g');
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      if (text.trim() || text.includes('\n')) {
        blocks.push({ type: 'text', value: text });
      }
    }
    blocks.push({ type: 'image', alt: match[1] || 'Image', value: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    blocks.push({ type: 'text', value: content.slice(lastIndex) });
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'text', value: content });
  }

  return blocks;
}

/** Guarantee a text block at the start, end, and between adjacent images so
 *  there is always somewhere to click and type. */
export function withEditableGaps(blocks: ContentBlock[]): ContentBlock[] {
  if (blocks.length === 0) {
    return [{ type: 'text', value: '' }];
  }

  const result: ContentBlock[] = [];

  if (blocks[0].type === 'image') {
    result.push({ type: 'text', value: '' });
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    result.push(block);
    if (block.type === 'image') {
      const next = blocks[i + 1];
      if (!next || next.type === 'image') {
        result.push({ type: 'text', value: '' });
      }
    }
  }

  return result;
}

function blocksToString(blocks: ContentBlock[]): string {
  return blocks
    .map(b => b.type === 'image' ? `![${b.alt || 'Image'}](${b.value})` : b.value)
    .join('');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightCode(code: string, language: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

interface ContentEditorProps {
  content: string;
  language: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

export default function ContentEditor({ content, language, onChange, onSave }: ContentEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => withEditableGaps(parseContent(content)));
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  useEffect(() => {
    setBlocks(withEditableGaps(parseContent(content)));
  }, [content]);

  // Keep editingIndex valid whenever blocks are replaced: if it no longer
  // points at a text block, drop back to "not editing" instead of leaving a
  // stale index that points at nothing (or at an image).
  useEffect(() => {
    setEditingIndex(prev =>
      prev !== null && blocks[prev]?.type === 'text' ? prev : null
    );
  }, [blocks]);

  const updateTextBlock = (index: number, value: string) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], value };
    setBlocks(newBlocks);
    onChange(blocksToString(newBlocks));
  };

  const removeImageBlock = (index: number) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    if (newBlocks.length === 0) newBlocks.push({ type: 'text', value: '' });
    setBlocks(newBlocks);
    onChange(blocksToString(newBlocks));
  };

  const handlePaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    blockIndex: number
  ) => {
    const currentText = blocks[blockIndex]?.value || '';
    const newContent = await handleImagePaste(e, currentText);
    if (newContent !== null) {
      const parsedNew = parseContent(newContent);
      const newBlocks = [
        ...blocks.slice(0, blockIndex),
        ...parsedNew,
        ...blocks.slice(blockIndex + 1),
      ];
      setBlocks(newBlocks);
      onChange(blocksToString(newBlocks));
    }
  };

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 60) + 'px';
  };

  return (
    <div className="flex flex-col gap-1 min-h-[300px]">
      {blocks.map((block, i) =>
        block.type === 'text' ? (
          editingIndex === i ? (
            <textarea
              key={`text-${i}`}
              ref={el => {
                if (el) {
                  textareaRefs.current.set(i, el);
                  autoResize(el);
                }
              }}
              autoFocus
              value={block.value}
              onChange={e => {
                updateTextBlock(i, e.target.value);
                autoResize(e.target);
              }}
              onBlur={() => {
                setEditingIndex(null);
                onSave();
              }}
              onPaste={e => handlePaste(e, i)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
              placeholder="Type your snippet here... (Ctrl+V to paste images)"
            />
          ) : (
            <pre
              key={`text-${i}`}
              onClick={() => setEditingIndex(i)}
              className="w-full min-h-[60px] bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm overflow-x-auto cursor-text hover:border-zinc-700 transition-colors"
            >
              {block.value.trim() ? (
                <code
                  className="hljs bg-transparent p-0 font-mono"
                  dangerouslySetInnerHTML={{ __html: highlightCode(block.value, language) }}
                />
              ) : (
                <span className="text-zinc-600 font-mono">Click to edit…</span>
              )}
            </pre>
          )
        ) : (
          <div
            key={`img-${i}`}
            className="relative group my-2 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/50 inline-block max-w-full"
          >
            <img
              src={block.value}
              alt={block.alt || 'Image'}
              onClick={() => {
                setLightboxSrc(block.value);
                setLightboxAlt(block.alt || 'Image');
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const next = (e.target as HTMLImageElement).nextElementSibling;
                if (next) (next as HTMLElement).style.display = 'flex';
              }}
              className="max-w-full max-h-[400px] object-contain cursor-zoom-in hover:opacity-90 transition-opacity rounded-lg block"
            />
            {/* Fallback */}
            <div style={{ display: 'none' }} className="items-center justify-center gap-2 p-6 text-zinc-500 min-w-[200px]">
              <ImageIcon className="w-8 h-8" />
              <span className="text-sm">Image not found</span>
            </div>
            {/* Delete button */}
            <button
              onClick={() => removeImageBlock(i)}
              className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove image"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {/* Zoom hint */}
            <div className="absolute bottom-2 left-2 text-xs text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Click to zoom
            </div>
          </div>
        )
      )}

      {lightboxSrc && (
        <Lightbox
          src={lightboxSrc}
          alt={lightboxAlt}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
}
