export interface UserList {
  id: number;
  name: string;
  description: string | null;
  privacy: 'private' | 'public';
  createdAt: string;
  itemCount: number;
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
}

export interface ListDetail extends UserList {
  items: ListItemEntry[];
}
