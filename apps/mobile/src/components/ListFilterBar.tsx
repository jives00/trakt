import { ScrollView, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { ListItemEntry } from "@trakt/types";

export type ListSortOption = "added_date" | "alpha";
export type MediaFilter = "all" | "movie" | "show";
export type ReleaseFilter = "all" | "released" | "unreleased";
export type StatusFilter = "returning" | "ended";

export const SORT_OPTIONS: { id: ListSortOption; label: string }[] = [
  { id: "added_date", label: "Date Added" },
  { id: "alpha", label: "A–Z" },
];

const MEDIA_OPTIONS: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All Media" },
  { id: "movie", label: "Movies" },
  { id: "show", label: "Shows" },
];

const RELEASE_OPTIONS: { id: ReleaseFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "released", label: "Released" },
  { id: "unreleased", label: "Unreleased" },
];

const STATUS_OPTIONS: { id: StatusFilter; label: string; matches: string[] }[] = [
  { id: "returning", label: "Returning Series", matches: ["Returning Series"] },
  { id: "ended", label: "Ended / Cancelled", matches: ["Ended", "Canceled", "Cancelled"] },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function filterItems(items: ListItemEntry[], media: MediaFilter, release: ReleaseFilter, status: StatusFilter | null): ListItemEntry[] {
  const today = todayIso();
  const statusMatches = STATUS_OPTIONS.find((o) => o.id === status)?.matches;
  return items.filter((item) => {
    if (media !== "all" && item.mediaType !== media) return false;
    if (release !== "all" && item.mediaType !== "episode") {
      const released = !!item.releaseDate && item.releaseDate.slice(0, 10) <= today;
      if (released !== (release === "released")) return false;
    }
    if (media === "show" && statusMatches) return !!item.showStatus && statusMatches.includes(item.showStatus);
    return true;
  });
}

function PillRow<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T | null; onChange: (id: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {options.map((opt) => (
        <TouchableOpacity key={opt.id} style={[s.pill, value === opt.id && s.pillActive]} onPress={() => onChange(opt.id)}>
          <Text style={[s.pillText, value === opt.id && s.pillTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

type Props = {
  sort: ListSortOption; onSort: (v: ListSortOption) => void;
  media: MediaFilter; onMedia: (v: MediaFilter) => void;
  release: ReleaseFilter; onRelease: (v: ReleaseFilter) => void;
  status: StatusFilter | null; onStatus: (v: StatusFilter | null) => void;
};

export function ListFilterBar({ sort, onSort, media, onMedia, release, onRelease, status, onStatus }: Props) {
  return (
    <>
      <PillRow options={MEDIA_OPTIONS} value={media} onChange={(v) => { onMedia(v); if (v !== "show") onStatus(null); }} />
      <PillRow options={RELEASE_OPTIONS} value={release} onChange={onRelease} />
      {media === "show" && (
        <PillRow options={STATUS_OPTIONS} value={status} onChange={(v) => onStatus(status === v ? null : v)} />
      )}
      <PillRow options={SORT_OPTIONS} value={sort} onChange={onSort} />
    </>
  );
}

const s = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#1e2029", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  pillActive: { backgroundColor: "#e8002d", borderColor: "#e8002d" },
  pillText: { fontSize: 12, color: "rgba(240,240,246,0.55)", fontWeight: "600" },
  pillTextActive: { color: "#fff" },
});
