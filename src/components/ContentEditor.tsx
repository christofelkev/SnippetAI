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

interface CodeBlockItemProps {
  value: string;
  language: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

function CodeBlockItem({ value, language, onChange, onSave, onPaste }: CodeBlockItemProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 64)}px`;
  };

  useEffect(() => {
    autoResize();
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  };

  const highlightedHtml = value.trim()
    ? highlightCode(value, language) + (value.endsWith('\n') ? ' ' : '')
    : '';

  return (
    <div className="relative w-full min-h-[64px] bg-zinc-900 border border-zinc-800 rounded-lg focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-colors group hover:border-zinc-700">
      {/* Syntax highlighted layer */}
      <pre
        aria-hidden="true"
        className="w-full min-h-[64px] p-4 m-0 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden pointer-events-none select-none box-border"
      >
        {highlightedHtml ? (
          <code
            className="hljs !p-0 !bg-transparent font-mono text-sm leading-relaxed block"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <span className="text-zinc-600 font-mono text-sm leading-relaxed block">
            {value.length === 0 ? '' : ' '}
          </span>
        )}
      </pre>

      {/* Actual interactive textarea layer */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          autoResize();
        }}
        onBlur={onSave}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        spellCheck={false}
        className={`absolute inset-0 w-full h-full p-4 m-0 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words resize-none bg-transparent caret-zinc-100 border-none outline-none focus:outline-none focus:ring-0 overflow-hidden box-border ${
          value.length > 0
            ? 'text-transparent selection:bg-indigo-500/40 selection:text-transparent selection:[-webkit-text-fill-color:transparent]'
            : 'text-zinc-300 placeholder-zinc-600'
        }`}
        placeholder="Type your snippet here... (Ctrl+V to paste images)"
      />
    </div>
  );
}

export default function ContentEditor({ content, language, onChange, onSave }: ContentEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => withEditableGaps(parseContent(content)));
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState('');

  useEffect(() => {
    setBlocks(withEditableGaps(parseContent(content)));
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

  return (
    <div className="flex flex-col gap-1 min-h-[300px]">
      {blocks.map((block, i) =>
        block.type === 'text' ? (
          <CodeBlockItem
            key={`text-${i}`}
            value={block.value}
            language={language}
            onChange={val => updateTextBlock(i, val)}
            onSave={onSave}
            onPaste={e => handlePaste(e, i)}
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
