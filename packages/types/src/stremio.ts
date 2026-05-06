export interface TraktWatchingResponse {
  expires_at: string;
  started_at: string;
  action: string;
  type: 'movie' | 'episode';
  progress: number;
  episode?: {
    season: number;
    number: number;
    ids: {
      tmdb: number;
    };
  };
  show?: {
    ids: {
      tmdb: number;
    };
  };
  movie?: {
    ids: {
      tmdb: number;
    };
  };
}

export interface StremioManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  resources: string[];
  types: string[];
  catalogs: unknown[];
  idPrefixes: string[];
}
