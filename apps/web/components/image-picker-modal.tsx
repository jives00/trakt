"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

interface Props {
  open: boolean;
  onClose: () => void;
  tmdbId: number;
  imageType: "hero" | "poster";
  mediaType: "show" | "movie";
  onSaved: (path: string) => void;
}

export function ImagePickerModal({ open, onClose, tmdbId, imageType, mediaType, onSaved }: Props) {
  const { token } = useAuth();
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    const getImages = mediaType === "show" ? api.getShowImages : api.getMovieImages;
    getImages(tmdbId, token)
      .then((data) => setImages(imageType === "hero" ? data.backdrops : data.posters))
      .finally(() => setLoading(false));
  }, [open, tmdbId, imageType, mediaType, token]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSelect(path: string) {
    if (!token || saving) return;
    setSaving(path);
    const setImage = mediaType === "show" ? api.setShowImage : api.setMovieImage;
    await setImage(tmdbId, imageType, path, token).catch(() => {});
    onSaved(path);
    setSaving(null);
    onClose();
  }

  if (!open) return null;

  const thumbSize = imageType === "hero" ? "w780" : "w342";
  const aspectClass = imageType === "hero" ? "aspect-video" : "aspect-[2/3]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-surface-container-low border border-outline-variant/40 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/40">
          <h2 className="text-on-surface font-bold text-lg">
            {imageType === "hero" ? "Choose Backdrop" : "Choose Poster"}
          </h2>
          <button onClick={onClose} className="text-on-surface/40 hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {loading ? (
            <p className="text-on-surface/40 text-sm text-center py-12">Loading images…</p>
          ) : images.length === 0 ? (
            <p className="text-on-surface/40 text-sm text-center py-12">No images available.</p>
          ) : (
            <div className={`grid gap-3 ${imageType === "hero" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}>
              {images.map((path) => (
                <button
                  key={path}
                  onClick={() => handleSelect(path)}
                  disabled={!!saving}
                  className={`relative ${aspectClass} overflow-hidden border-2 transition-all hover:border-accent focus:outline-none ${
                    saving === path ? "border-accent opacity-50" : "border-transparent"
                  }`}
                >
                  <Image
                    src={`${TMDB_IMG}${thumbSize}${path}`}
                    alt=""
                    fill
                    className="object-cover"
                    sizes={imageType === "hero" ? "400px" : "260px"}
                  />
                  {saving === path && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white animate-spin">progress_activity</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

