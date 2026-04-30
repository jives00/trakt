export interface RatingItem {
  id: number;
  mediaType: 'movie' | 'show' | 'episode';
  mediaId: number;
  rating: number;
  ratedAt: string;
  tmdbId: number | null;
  title: string | null;
  posterPath: string | null;
  year: number | null;
  showTitle?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}
