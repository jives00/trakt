ALTER TABLE watch_history
  MODIFY COLUMN source ENUM('manual','emby','stremio','kodi','nuvio') NOT NULL DEFAULT 'manual';

ALTER TABLE now_playing
  MODIFY COLUMN source ENUM('emby','stremio','kodi','nuvio') NOT NULL DEFAULT 'emby';

ALTER TABLE scrobble_exclusions
  MODIFY COLUMN integration ENUM('emby','stremio','kodi','nuvio') NOT NULL;
