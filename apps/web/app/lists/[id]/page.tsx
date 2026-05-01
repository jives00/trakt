"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ListDetail, ListItemEntry } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, isLoading } = useAuth();
  const [list, setList] = useState<ListDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    api.getList(Number(id), token)
      .then(setList)
      .catch(() => setError("Failed to load list."));
  }, [token, isLoading, id]);

  async function handleRemove(item: ListItemEntry) {
    if (!token || !list) return;
    await api.removeListItem(list.id, item.mediaType, item.mediaId, token);
    setList((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.id !== item.id), itemCount: prev.itemCount - 1 } : prev);
  }

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;
  if (!list) return <p className="text-white/40">Loading…</p>;

  return (
    <div>
      <header className="mb-8">
        <Link href="/lists" className="flex items-center gap-1 text-xs text-white/40 hover:text-white mb-4 transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          All Lists
        </Link>
        <h1 className="text-h1 font-black tracking-tight text-white mb-1">{list.name}</h1>
        {list.description && <p className="text-white/40">{list.description}</p>}
        <p className="text-xs text-white/40 mt-1">{list.itemCount} item{list.itemCount !== 1 ? "s" : ""}</p>
      </header>

      {list.items.length === 0 && (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-5xl text-white/20 mb-4 block">playlist_add</span>
          <p className="text-white/40">This list is empty.</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {list.items.map((item) => (
          <ListItemCard key={item.id} item={item} onRemove={() => handleRemove(item)} />
        ))}
      </div>
    </div>
  );
}

function ListItemCard({ item, onRemove }: { item: ListItemEntry; onRemove: () => void }) {
  const href = item.mediaType === "movie"
    ? `/movies/${item.tmdbId}`
    : item.mediaType === "show"
    ? `/shows/${item.tmdbId}`
    : "#";
  const posterUrl = item.posterPath ? `${TMDB_IMG}w342${item.posterPath}` : null;

  return (
    <div className="group relative">
      <Link href={href} className="block">
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#181818] mb-2">
          {posterUrl ? (
            <Image src={posterUrl} alt={item.title ?? ""} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="material-symbols-outlined text-3xl text-white/20">movie</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-sm font-semibold text-white line-clamp-1 group-hover:text-[#e8002d] transition-colors">{item.title}</p>
        {item.year && <p className="text-xs text-white/40">{item.year}</p>}
      </Link>
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white/40 hover:text-[#e8002d] transition-colors opacity-0 group-hover:opacity-100 material-symbols-outlined text-base"
        aria-label="Remove from list"
      >
        close
      </button>
    </div>
  );
}
