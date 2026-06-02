export type ListType = 'watchlist' | 'dropped' | 'rewatch' | 'custom';
export type ListSort = 'added_date' | 'alpha' | 'last_updated' | 'random';

export interface UserList {
  id: number;
  name: string;
  listType: ListType;
  isSystem: boolean;
  slug: string | null;
  isPublic: boolean;
  defaultSort: ListSort;
  description: string | null;
  createdAt: string;
  itemCount: number;
  previewBackdrops: string[];
  stremioCatalog: boolean;
}

export interface ListItemEntry {
  id: number;
  mediaType: 'movie' | 'show' | 'episode';
  mediaId: number;
  addedAt: string;
  sortOrder: number;
  tmdbId: number | null;
  title: string | null;
  posterPath: string | null;
  year: number | null;
  isFullyWatched: boolean;
  releaseDate: string | null;
  digitalReleaseDate: string | null;
  physicalReleaseDate: string | null;
  nextEpisodeDate: string | null;
}

export interface ListDetail extends UserList {
  items: ListItemEntry[];
}

export interface UpdateListBody {
  name?: string;
  description?: string;
  defaultSort?: ListSort;
  isPublic?: boolean;
}
