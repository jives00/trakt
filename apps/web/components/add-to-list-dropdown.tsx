"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { UserList, ListDetail } from "@trakt/types";

interface AddToListDropdownProps {
  token: string;
  mediaType: "movie" | "show";
  mediaId: number;
}

export function AddToListDropdown({ token, mediaType, mediaId }: AddToListDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lists, setLists] = useState<UserList[]>([]);
  const [listDetails, setListDetails] = useState<Map<number, ListDetail>>(new Map());
  const [containingListIds, setContainingListIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Load which lists contain this item on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadListMembership();
    }
  }, []);

  async function loadListMembership() {
    try {
      const fetchedLists = await api.getLists(token);
      const customLists = fetchedLists.filter((l) => !l.isSystem);
      setLists(customLists);

      const detailsMap = new Map<number, ListDetail>();
      const containingIds = new Set<number>();

      for (const list of customLists) {
        try {
          const detail = await api.getList(list.id, token);
          detailsMap.set(list.id, detail);
          const isContained = detail.items.some(
            (item) => item.mediaType === mediaType && item.mediaId === mediaId
          );
          if (isContained) {
            containingIds.add(list.id);
          }
        } catch {
          // skip lists that fail to load
        }
      }

      setListDetails(detailsMap);
      setContainingListIds(containingIds);
    } catch {
      setLists([]);
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  async function handleToggleList(listId: number) {
    try {
      if (containingListIds.has(listId)) {
        await api.removeListItem(listId, mediaType, mediaId, token);
        setContainingListIds((prev) => {
          const next = new Set(prev);
          next.delete(listId);
          return next;
        });
      } else {
        await api.addListItem(listId, mediaType, mediaId, token);
        setContainingListIds((prev) => new Set([...prev, listId]));
      }
    } catch {
      // handle error silently for now
    }
  }

  async function handleCreateAndAdd() {
    if (!newListName.trim()) return;
    try {
      const newList = await api.createList(newListName.trim(), "", token);
      await api.addListItem(newList.id, mediaType, mediaId, token);
      setLists((prev) => [...prev, newList]);
      setContainingListIds((prev) => new Set([...prev, newList.id]));
      setNewListName("");
      setCreating(false);
    } catch {
      // handle error
    }
  }

  const buttonLabel = containingListIds.size > 0
    ? `On ${containingListIds.size} list${containingListIds.size === 1 ? "" : "s"}`
    : "Add to List";

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
          containingListIds.size > 0
            ? "bg-accent text-white"
            : "bg-surface-container border border-outline-variant/40 text-on-surface/80 hover:bg-surface-container-high"
        }`}
      >
        <span className="material-symbols-outlined text-sm">playlist_add</span>
        {buttonLabel}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container border border-outline-variant/40 rounded-xl overflow-hidden shadow-lg z-50">
          {creating ? (
            <div className="p-3 flex gap-2">
              <input
                type="text"
                placeholder="New list name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="flex-1 bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-on-surface text-sm focus:outline-none focus:border-accent transition-colors"
                autoFocus
              />
              <button
                onClick={handleCreateAndAdd}
                className="px-3 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-3 py-2 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface/60 text-xs font-bold hover:bg-surface-container-highest transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {loading ? (
                <div className="p-3 text-center text-on-surface/40 text-sm">Loading lists…</div>
              ) : lists.length === 0 ? (
                <div className="p-3 text-center text-on-surface/40 text-sm">No custom lists. Create one below.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => handleToggleList(list.id)}
                      className="w-full px-4 py-3 text-sm font-medium text-on-surface/80 hover:bg-on-surface/5 hover:text-on-surface transition-colors text-left border-b border-outline-variant/30 last:border-b-0 flex items-center justify-between"
                    >
                      <span>{list.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-on-surface/40">{list.itemCount} item{list.itemCount !== 1 ? "s" : ""}</span>
                        {containingListIds.has(list.id) && (
                          <span className="material-symbols-outlined text-sm text-accent">check</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-outline-variant/40">
                <button
                  onClick={() => setCreating(true)}
                  className="w-full px-4 py-3 text-sm font-medium text-on-surface/80 hover:bg-on-surface/5 hover:text-on-surface transition-colors text-left flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  New List
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
