"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { UserList } from "@trakt/types";

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
    setLists((prev) => [list, ...prev]);
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

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-h1 font-black tracking-tight text-white mb-1">Lists</h1>
            <p className="text-white/40">{lists.length} list{lists.length !== 1 ? "s" : ""}.</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e8002d] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#c8001e] transition-colors"
          >
            <span className="material-symbols-outlined text-base">add</span>
            New List
          </button>
        </header>

        {creating && (
          <form onSubmit={handleCreate} className="glass-panel rounded-xl p-5 mb-6">
            <h3 className="font-bold text-white mb-4">New List</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="List name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-[#181818] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#e8002d] transition-colors"
                autoFocus
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="bg-[#181818] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#e8002d] transition-colors"
              />
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#e8002d] text-white text-xs font-bold uppercase tracking-widest">
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

        {!fetching && lists.length === 0 && !creating && (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-white/20 mb-4 block">format_list_bulleted</span>
            <p className="text-white/40">No lists yet. Create one to get started.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} onDelete={() => handleDelete(list.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ListCard({ list, onDelete }: { list: UserList; onDelete: () => void }) {
  return (
    <div className="glass-panel rounded-xl p-5 red-glow-hover transition-all duration-300 group flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/lists/${list.id}`} className="font-bold text-white group-hover:text-[#e8002d] transition-colors line-clamp-1">
          {list.name}
        </Link>
        <button
          onClick={onDelete}
          className="text-white/20 hover:text-[#e8002d] transition-colors material-symbols-outlined text-base shrink-0"
          aria-label="Delete list"
        >
          delete
        </button>
      </div>
      {list.description && (
        <p className="text-sm text-white/40 line-clamp-2">{list.description}</p>
      )}
      <div className="flex items-center justify-between mt-auto">
        <span className="text-xs text-white/40">{list.itemCount} item{list.itemCount !== 1 ? "s" : ""}</span>
        <Link
          href={`/lists/${list.id}`}
          className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-[#e8002d] transition-colors flex items-center gap-1"
        >
          View <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
