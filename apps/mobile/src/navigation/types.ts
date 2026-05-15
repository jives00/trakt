export type SharedDetailParamList = {
  ShowDetail: { tmdbId: number };
  Season: { tmdbId: number; seasonNumber: number; showName: string };
  EpisodeDetail: { tmdbId: number; seasonNumber: number; episodeNumber: number; showName: string };
  MovieDetail: { tmdbId: number };
  ListDetail: { listId: number; listName: string };
  StatsYear: { year: number };
  StatsMonth: { year: number; month: number };
};

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Discover: undefined;
  More: undefined;
};

export type DashboardStackParamList = { DashboardHome: undefined } & SharedDetailParamList;
export type HistoryStackParamList = { HistoryHome: undefined } & SharedDetailParamList;
export type DiscoverStackParamList = { DiscoverHome: undefined } & SharedDetailParamList;

export type MoreStackParamList = {
  MoreMenu: undefined;
  Lists: undefined;
  Progress: undefined;
  Calendar: undefined;
  Stats: undefined;
  Settings: undefined;
} & SharedDetailParamList;
