import { useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface LightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export default function Lightbox({ src, alt, onClose }: LightboxProps) {
  const [scale, setScale] = useState(1);

  const zoomIn = () => setScale(s => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.25));

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Controls */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2 z-[101]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={zoomOut}
          className="p-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-sm text-zinc-300 font-mono min-w-[3rem] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="p-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors ml-2"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image */}
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        onWheel={e => {
          e.preventDefault();
          if (e.deltaY < 0) zoomIn();
          else zoomOut();
        }}
        className="max-w-[90vw] max-h-[90vh] object-contain transition-transform duration-200 cursor-grab rounded-lg shadow-2xl"
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
}
