"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { UserList } from "@trakt/types";

export const dynamic = "force-dynamic";

const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

const SYSTEM_META: Record<string, { icon: string; description: string }> = {
  watchlist: { icon: "bookmark", description: "Shows and movies you want to watch" },
  dropped:   { icon: "block",    description: "Shows you stopped watching" },
  rewatch:   { icon: "replay",   description: "Shows you're currently rewatching" },
};

export default function ListsPage() {
  const { token, isLoading } = useAuth();
  const [lists, setLists] = useState<UserList[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    if (isLoading || !token) return;
    api.getLists(token)
      .then(setLists)
      .catch(() => setError("Failed to load lists."))
      .finally(() => setFetching(false));
  }, [token, isLoading]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !newName.trim()) return;
    const list = await api.createList(newName.trim(), newDesc.trim(), token);
    setLists((prev) => [...prev, list]);
    setNewName("");
    setNewDesc("");
    setCreating(false);
  }

  async function handleDelete(id: number) {
    if (!token) return;
    await api.deleteList(id, token);
    setLists((prev) => prev.filter((l) => l.id !== id));
  }

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;

  const systemLists = lists.filter((l) => l.isSystem);
  const customLists = lists.filter((l) => !l.isSystem);

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <header className="mb-8 flex items-end justify-between gap-4">
        <h1 className="text-h1 font-black tracking-tight text-white">Lists</h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-widest hover:bg-accent-hover transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          New List
        </button>
      </header>

      {creating && (
        <form onSubmit={handleCreate} className="glass-panel rounded-xl p-5 mb-8">
          <h3 className="font-bold text-white mb-4">New List</h3>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="List name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-[#181818] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors"
              autoFocus
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="bg-[#181818] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors"
            />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-widest">
                Create
              </button>
              <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg bg-[#181818] text-white/60 border border-white/10 text-xs font-bold uppercase tracking-widest">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {fetching && <p className="text-white/40">Loading…</p>}

      {!fetching && (
        <>
          <div className="mb-10">
            <h2 className="text-h2 font-black tracking-tight text-white mb-4">
              <span className="block w-8 h-1 bg-accent rounded mb-2" />
              System Lists
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {systemLists.map((list) => (
                <SystemListCard key={list.id} list={list} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-h2 font-black tracking-tight text-white mb-4">
              <span className="block w-8 h-1 bg-accent rounded mb-2" />
              Custom Lists
            </h2>
            {customLists.length === 0 && !creating ? (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-5xl text-white/20 mb-4 block">format_list_bulleted</span>
                <p className="text-white/40">No custom lists yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customLists.map((list) => (
                  <CustomListCard key={list.id} list={list} onDelete={() => handleDelete(list.id)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PosterCollage({ posters }: { posters: string[] }) {
  const filled = [...posters.slice(0, 4)];
  if (filled.length === 0) return (
    <div className="w-full h-full flex items-center justify-center bg-white/5">
      <span className="material-symbols-outlined text-3xl text-white/20">image</span>
    </div>
  );
  if (filled.length === 1) return (
    <Image src={`${TMDB_IMG}${filled[0]}`} alt="" fill className="object-cover" unoptimized />
  );
  const cells = Array.from({ length: 4 }, (_, i) => filled[i % filled.length]);
  return (
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
      {cells.map((p, i) => (
        <div key={i} className="relative overflow-hidden">
          <Image src={`${TMDB_IMG}${p}`} alt="" fill className="object-cover" unoptimized />
        </div>
      ))}
    </div>
  );
}

function SystemListCard({ list }: { list: UserList }) {
  const meta = SYSTEM_META[list.listType] ?? { icon: "list", description: "" };
  return (
    <Link
      href={`/lists/${list.id}`}
      className="glass-panel rounded-xl overflow-hidden red-glow-hover transition-all duration-300 flex flex-col"
    >
      <div className="relative h-32 bg-white/5">
        <PosterCollage posters={list.previewPosters} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-white text-lg">{meta.icon}</span>
          <span className="font-black text-white tracking-tight">{list.name}</span>
        </div>
      </div>
      <div className="px-4 py-3 flex flex-col gap-1 flex-1">
        <span className="text-sm text-white/40">{list.itemCount} item{list.itemCount !== 1 ? "s" : ""}</span>
        {list.description && (
          <p className="text-xs text-white/40 line-clamp-2">{list.description}</p>
        )}
      </div>
    </Link>
  );
}

function CustomListCard({ list, onDelete }: { list: UserList; onDelete: () => void }) {
  return (
    <div className="glass-panel rounded-xl overflow-hidden red-glow-hover transition-all duration-300 group flex flex-col">
      <Link href={`/lists/${list.id}`} className="relative h-28 bg-white/5 block">
        <PosterCollage posters={list.previewPosters} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </Link>
      <div className="px-4 py-3 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/lists/${list.id}`} className="font-bold text-white group-hover:text-accent transition-colors line-clamp-1 text-sm">
            {list.name}
          </Link>
          <button
            onClick={onDelete}
            className="text-white/20 hover:text-accent transition-colors material-symbols-outlined text-base shrink-0"
            aria-label="Delete list"
          >
            delete
          </button>
        </div>
        {list.description && (
          <p className="text-xs text-white/40 line-clamp-2">{list.description}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-xs text-white/40">{list.itemCount} item{list.itemCount !== 1 ? "s" : ""}</span>
          <Link
            href={`/lists/${list.id}`}
            className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-accent transition-colors flex items-center gap-1"
          >
            View <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
