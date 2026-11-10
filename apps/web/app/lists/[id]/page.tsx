"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ListDetail, ListItemEntry } from "@trakt/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/";

type SortOption = "added_date" | "alpha";
type FilterOption = "all" | "movie" | "show";
type ReleaseOption = "all" | "released" | "unreleased";
type StatusOption = "returning" | "ended";
type ViewOption = "grid" | "list";

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "added_date", label: "Date Added" },
  { id: "alpha", label: "Title A–Z" },
];

const FILTER_OPTIONS: { id: FilterOption; label: string }[] = [
  { id: "all", label: "All Media" },
  { id: "movie", label: "Movies" },
  { id: "show", label: "Shows" },
];

const RELEASE_OPTIONS: { id: ReleaseOption; label: string }[] = [
  { id: "all", label: "All" },
  { id: "released", label: "Released" },
  { id: "unreleased", label: "Unreleased" },
];

const STATUS_OPTIONS: { id: StatusOption; label: string; matches: string[] }[] = [
  { id: "returning", label: "Returning Series", matches: ["Returning Series"] },
  { id: "ended", label: "Ended / Cancelled", matches: ["Ended", "Canceled", "Cancelled"] },
];

const PILL_ON = "px-3 py-2 rounded-full bg-accent text-white text-sm font-bold";
const PILL_OFF = "px-3 py-2 rounded-full bg-surface-container-low border border-outline-variant/40 text-on-surface-variant/70 text-sm hover:bg-surface-container hover:text-on-surface transition-colors";

function stripArticles(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, "").trim();
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isReleased(item: ListItemEntry, today: string): boolean {
  return !!item.releaseDate && item.releaseDate.slice(0, 10) <= today;
}

function sortItems(items: ListItemEntry[], sort: SortOption): ListItemEntry[] {
  const copy = [...items];
  if (sort === "alpha") {
    return copy.sort((a, b) => {
      const aTitle = stripArticles(a.title ?? "");
      const bTitle = stripArticles(b.title ?? "");
      return aTitle.localeCompare(bTitle);
    });
  }
  return copy.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, isLoading } = useAuth();
  const [list, setList] = useState<ListDetail | null>(null);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("added_date");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [view, setView] = useState<ViewOption>("grid");
  const [release, setRelease] = useState<ReleaseOption>("all");
  const [status, setStatus] = useState<StatusOption | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const initialized = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (isLoading || !token) return;
    const listId = Number(id);
    api.getList(listId, token)
      .then((data) => {
        setList(data);
        setEditName(data.name);
        setEditDesc(data.description ?? "");
        if (!initialized.current.has(listId)) {
          initialized.current.add(listId);
          const savedSort = localStorage.getItem(`list-sort-${id}`);
          const savedFilter = localStorage.getItem(`list-filter-${id}`) as FilterOption | null;
          const savedRelease = localStorage.getItem(`list-release-${id}`) as ReleaseOption | null;
          const savedView = localStorage.getItem(`list-view-${id}`) as ViewOption | null;
          if (SORT_OPTIONS.some((o) => o.id === savedSort)) setSortBy(savedSort as SortOption);
          if (savedFilter) setFilter(savedFilter);
          if (savedRelease) setRelease(savedRelease);
          if (savedView) setView(savedView);
        }
      })
      .catch(() => setError("Failed to load list."));
  }, [token, isLoading, id]);

  async function handleRemove(item: ListItemEntry) {
    if (!token || !list) return;
    await api.removeListItem(list.id, item.mediaType, item.mediaId, token);
    setList((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.id !== item.id), itemCount: prev.itemCount - 1 } : prev);
  }

  function changeSort(next: SortOption) {
    setSortBy(next);
    localStorage.setItem(`list-sort-${id}`, next);
  }

  function changeFilter(next: FilterOption) {
    setFilter(next);
    if (next !== "show") setStatus(null);
    localStorage.setItem(`list-filter-${id}`, next);
  }

  function changeRelease(next: ReleaseOption) {
    setRelease(next);
    localStorage.setItem(`list-release-${id}`, next);
  }

  function changeView(next: ViewOption) {
    setView(next);
    localStorage.setItem(`list-view-${id}`, next);
  }

  async function handleSaveEdits() {
    if (!token || !list) return;
    try {
      const updateBody: any = {};
      if (!list.isSystem) {
        updateBody.name = editName.trim() || list.name;
      }
      updateBody.description = editDesc.trim() || undefined;

      await api.updateList(list.id, updateBody, token);
      setList((prev) =>
        prev
          ? {
              ...prev,
              ...(list.isSystem ? {} : { name: editName.trim() || prev.name }),
              description: editDesc.trim() || prev.description,
            }
          : prev
      );
      setEditing(false);
    } catch {
      setError("Failed to update list.");
    }
  }

  function handleCancelEdit() {
    setEditName(list?.name ?? "");
    setEditDesc(list?.description ?? "");
    setEditing(false);
  }

  if (isLoading) return null;
  if (error) return <p className="text-error">{error}</p>;
  if (!list) return <p className="text-on-surface/40">Loading…</p>;

  let filtered = filter === "all" ? list.items : list.items.filter((i) => i.mediaType === filter);

  if (release !== "all") {
    const today = todayIso();
    filtered = filtered.filter((item) => item.mediaType === "episode" || isReleased(item, today) === (release === "released"));
  }

  const statusMatches = STATUS_OPTIONS.find((o) => o.id === status)?.matches;
  if (filter === "show" && statusMatches) {
    filtered = filtered.filter((item) => !!item.showStatus && statusMatches.includes(item.showStatus));
  }

  // List view only shows movies and shows (not episodes)
  const tableItems = filtered.filter((i) => i.mediaType === "movie" || i.mediaType === "show");
  const sorted = sortItems(filtered, sortBy);
  const tableSorted = sortItems(tableItems, sortBy);

  return (
    <div className="max-w-page mx-auto px-margin-page py-stack-lg flex-1 w-full">
      <div>
        <header className="mb-8">
          <Link href="/lists" className="flex items-center gap-1 text-xs text-on-surface/40 hover:text-on-surface mb-4 transition-colors">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            All Lists
          </Link>

          {editing ? (
            <div className="space-y-3 mb-4">
              {!list.isSystem && (
                <div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-2 text-on-surface text-h1 font-black focus:outline-none focus:border-accent transition-colors"
                    placeholder="List name"
                    autoFocus
                  />
                </div>
              )}
              <div>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-2 text-on-surface text-sm focus:outline-none focus:border-accent transition-colors resize-none"
                  placeholder="Description (optional)"
                  rows={3}
                  autoFocus={list.isSystem}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdits}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-wider hover:bg-accent-hover transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded-lg bg-surface-container border border-outline-variant/40 text-on-surface/60 text-xs font-bold uppercase tracking-wider hover:bg-surface-container-high transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-1">
                <h1 className="text-h1 font-black tracking-tight text-on-surface">{list.name}</h1>
                <button
                  onClick={() => setEditing(true)}
                  className="text-on-surface/40 hover:text-accent transition-colors"
                  aria-label="Edit list"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                </button>
              </div>
              {list.description && <p className="text-on-surface/40">{list.description}</p>}
              <p className="text-xs text-on-surface/40 mt-1">{list.itemCount} item{list.itemCount !== 1 ? "s" : ""}</p>
            </>
          )}
        </header>

        {list.items.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => changeFilter(opt.id)} className={filter === opt.id ? PILL_ON : PILL_OFF}>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {RELEASE_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => changeRelease(opt.id)} className={release === opt.id ? PILL_ON : PILL_OFF}>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => changeSort(opt.id)} className={sortBy === opt.id ? PILL_ON : PILL_OFF}>
                  {opt.label}
                </button>
              ))}
            </div>

            {filter === "show" && (
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatus((s) => (s === opt.id ? null : opt.id))}
                    className={status === opt.id ? PILL_ON : PILL_OFF}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={() => changeView("grid")}
                className={`p-2 rounded-lg transition-colors ${view === "grid" ? "bg-accent text-white" : "bg-surface-container-low border border-outline-variant/40 text-on-surface-variant/70 hover:bg-surface-container hover:text-on-surface"}`}
                aria-label="Grid view"
              >
                <span className="material-symbols-outlined text-base leading-none">grid_view</span>
              </button>
              <button
                type="button"
                onClick={() => changeView("list")}
                className={`p-2 rounded-lg transition-colors ${view === "list" ? "bg-accent text-white" : "bg-surface-container-low border border-outline-variant/40 text-on-surface-variant/70 hover:bg-surface-container hover:text-on-surface"}`}
                aria-label="List view"
              >
                <span className="material-symbols-outlined text-base leading-none">table_rows</span>
              </button>
            </div>
          </div>
        )}

        {sorted.length === 0 && (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-on-surface/20 mb-4 block">playlist_add</span>
            <p className="text-on-surface/40">{list.items.length === 0 ? "This list is empty." : "No items match this filter."}</p>
          </div>
        )}

        {view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {sorted.map((item) => (
              <ListItemCard key={item.id} item={item} onRemove={() => handleRemove(item)} />
            ))}
          </div>
        ) : (
          <ListTable items={tableSorted} onRemove={handleRemove} />
        )}
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
        <div className="relative aspect-[2/3] overflow-hidden bg-surface-container mb-2">
          {posterUrl ? (
            <Image src={posterUrl} alt={item.title ?? ""} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="material-symbols-outlined text-3xl text-on-surface/20">movie</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          {item.isFullyWatched && (
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center z-10 shadow">
              <span className="material-symbols-outlined text-white" style={{ fontSize: "15px", lineHeight: "1" }}>check</span>
            </div>
          )}
        </div>
        <p className="text-sm font-semibold text-on-surface line-clamp-1 group-hover:text-accent transition-colors">{item.title}</p>
        {item.year && <p className="text-xs text-on-surface/40">{item.year}</p>}
      </Link>
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white/40 hover:text-accent transition-colors opacity-0 group-hover:opacity-100 material-symbols-outlined text-base"
        aria-label="Remove from list"
      >
        close
      </button>
    </div>
  );
}

type TableCol = "title" | "type" | "date" | "digital" | "physical";

function dateVal(s: string | null | undefined): number {
  if (!s) return Infinity;
  const t = new Date(s + "T00:00:00Z").getTime();
  return isNaN(t) ? Infinity : t;
}

function sortTableItems(items: ListItemEntry[], col: TableCol, dir: "asc" | "desc"): ListItemEntry[] {
  const asc = dir === "asc";
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (col === "title") {
      cmp = stripArticles(a.title ?? "").localeCompare(stripArticles(b.title ?? ""));
    } else if (col === "type") {
      cmp = (a.mediaType === "movie" ? 0 : 1) - (b.mediaType === "movie" ? 0 : 1);
    } else if (col === "date") {
      const aDate = a.mediaType === "movie" ? a.releaseDate : a.nextEpisodeDate;
      const bDate = b.mediaType === "movie" ? b.releaseDate : b.nextEpisodeDate;
      cmp = dateVal(aDate) - dateVal(bDate);
    } else if (col === "digital") {
      cmp = dateVal(a.digitalReleaseDate) - dateVal(b.digitalReleaseDate);
    } else if (col === "physical") {
      cmp = dateVal(a.physicalReleaseDate) - dateVal(b.physicalReleaseDate);
    }
    return asc ? cmp : -cmp;
  });
}

function ListTable({ items, onRemove }: { items: ListItemEntry[]; onRemove: (item: ListItemEntry) => void }) {
  const [sortCol, setSortCol] = useState<TableCol>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  if (items.length === 0) return null;

  function handleColClick(col: TableCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const sorted = sortTableItems(items, sortCol, sortDir);
  const arrow = sortDir === "asc" ? "arrow_upward" : "arrow_downward";

  function ColHeader({ col, label, className = "" }: { col: TableCol; label: string; className?: string }) {
    const active = sortCol === col;
    return (
      <th
        className={`text-left py-3 pr-4 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none group/th transition-colors ${active ? "text-on-surface" : "text-on-surface/40 hover:text-on-surface/70"} ${className}`}
        onClick={() => handleColClick(col)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className={`material-symbols-outlined text-xs leading-none transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover/th:opacity-40"}`}>
            {active ? arrow : "arrow_upward"}
          </span>
        </span>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-outline-variant/20">
            <ColHeader col="title" label="Title" />
            <ColHeader col="type" label="Type" />
            <ColHeader col="date" label="Date" />
            <ColHeader col="digital" label="Digital" />
            <ColHeader col="physical" label="Physical" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const href = item.mediaType === "movie" ? `/movies/${item.tmdbId}` : `/shows/${item.tmdbId}`;
            const date = item.mediaType === "movie" ? item.releaseDate : item.nextEpisodeDate;
            const digital = item.mediaType === "movie" ? item.digitalReleaseDate : null;
            const physical = item.mediaType === "movie" ? item.physicalReleaseDate : null;

            return (
              <tr key={item.id} className="border-b border-outline-variant/10 hover:bg-surface-container/40 group transition-colors">
                <td className="py-3 pr-4">
                  <Link href={href} className="flex items-center gap-3 hover:text-accent transition-colors">
                    {item.posterPath ? (
                      <Image
                        src={`${TMDB_IMG}w92${item.posterPath}`}
                        alt={item.title ?? ""}
                        width={32}
                        height={48}
                        className="rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-12 rounded bg-surface-container flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-base text-on-surface/20">movie</span>
                      </div>
                    )}
                    <span className="font-semibold text-on-surface group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                      {item.title}
                      {item.year && <span className="ml-1.5 text-on-surface/40 font-normal text-xs">({item.year})</span>}
                    </span>
                  </Link>
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${item.mediaType === "movie" ? "bg-blue-500/15 text-blue-400" : "bg-purple-500/15 text-purple-400"}`}>
                    {item.mediaType === "movie" ? "Movie" : "Show"}
                  </span>
                </td>
                <td className="py-3 pr-4 text-on-surface/70 whitespace-nowrap tabular-nums">
                  {formatDate(date)}
                </td>
                <td className="py-3 pr-4 text-on-surface/70 whitespace-nowrap tabular-nums">
                  {item.mediaType === "movie" ? formatDate(digital) : <span className="text-on-surface/25">—</span>}
                </td>
                <td className="py-3 pr-4 text-on-surface/70 whitespace-nowrap tabular-nums">
                  {item.mediaType === "movie" ? formatDate(physical) : <span className="text-on-surface/25">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
