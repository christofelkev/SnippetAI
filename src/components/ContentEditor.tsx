import { useState, useRef, useEffect } from 'react';
import { handleImagePaste } from '../lib/imagePaste';
import Lightbox from './Lightbox';
import { ImageIcon, Trash2 } from 'lucide-react';

// Regex to match markdown images: ![alt](url)
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

interface ContentBlock {
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

function blocksToString(blocks: ContentBlock[]): string {
  return blocks
    .map(b => b.type === 'image' ? `![${b.alt || 'Image'}](${b.value})` : b.value)
    .join('');
}

interface ContentEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

export default function ContentEditor({ content, onChange, onSave }: ContentEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => parseContent(content));
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState('');
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  useEffect(() => {
    setBlocks(parseContent(content));
  }, [content]);

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
          <textarea
            key={`text-${i}`}
            ref={el => {
              if (el) {
                textareaRefs.current.set(i, el);
                autoResize(el);
              }
            }}
            value={block.value}
            onChange={e => {
              updateTextBlock(i, e.target.value);
              autoResize(e.target);
            }}
            onBlur={onSave}
            onPaste={e => handlePaste(e, i)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
            placeholder="Type your snippet here... (Ctrl+V to paste images)"
          />
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
