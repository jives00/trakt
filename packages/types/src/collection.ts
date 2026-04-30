export interface CollectionItem {
  id: number;
  mediaType: 'movie' | 'show';
  mediaId: number;
  addedAt: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: number | null;
}

export interface WatchlistItem {
  id: number;
  mediaType: 'movie' | 'show';
  mediaId: number;
  addedAt: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: number | null;
}
