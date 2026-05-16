"use client";

import { useEffect } from "react";

export function TrailerModal({ youtubeKey, onClose }: { youtubeKey: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-9 right-0 flex items-center gap-1 text-white/60 hover:text-white text-sm font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-base leading-none">close</span>
          Close
        </button>
        <div className="aspect-video w-full">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0`}
            allow="autoplay; fullscreen"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
