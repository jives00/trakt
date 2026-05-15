export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  ShowDetail: { tmdbId: number };
  Season: { tmdbId: number; seasonNumber: number; showName: string };
  EpisodeDetail: { tmdbId: number; seasonNumber: number; episodeNumber: number; showName: string };
  MovieDetail: { tmdbId: number };
  ListDetail: { listId: number; listName: string };
  StatsYear: { year: number };
  StatsMonth: { year: number; month: number };
};

export type MainTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Search: undefined;
  More: undefined;
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  Shows: undefined;
  Movies: undefined;
  Lists: undefined;
  Progress: undefined;
  Ratings: undefined;
  Calendar: undefined;
  Stats: undefined;
  Settings: undefined;
};
