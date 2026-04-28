CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  theme VARCHAR(32) NOT NULL DEFAULT 'dark',
  created_at DATETIME DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watch_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  media_type ENUM('movie', 'episode') NOT NULL,
  media_id INT NOT NULL,
  watched_at DATETIME NOT NULL,
  progress_pct TINYINT UNSIGNED NOT NULL DEFAULT 100,
  source ENUM('manual', 'emby', 'stremio', 'kodi') NOT NULL DEFAULT 'manual',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collection (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  media_type ENUM('movie', 'show') NOT NULL,
  media_id INT NOT NULL,
  added_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_collection (user_id, media_type, media_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  media_type ENUM('movie', 'show') NOT NULL,
  media_id INT NOT NULL,
  added_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_watchlist (user_id, media_type, media_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  privacy ENUM('private', 'public') NOT NULL DEFAULT 'private',
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS list_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  list_id INT NOT NULL,
  media_type ENUM('movie', 'show', 'episode') NOT NULL,
  media_id INT NOT NULL,
  added_at DATETIME DEFAULT NOW(),
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_list_item (list_id, media_type, media_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  media_type ENUM('movie', 'show', 'episode') NOT NULL,
  media_id INT NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  rated_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_rating (user_id, media_type, media_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  media_type ENUM('movie', 'show', 'episode') NOT NULL,
  media_id INT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uq_note (user_id, media_type, media_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS movies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tmdb_id INT NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  year SMALLINT,
  overview TEXT,
  poster_path VARCHAR(255),
  backdrop_path VARCHAR(255),
  runtime_min SMALLINT,
  genres JSON,
  metadata_fetched_at JSON,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE IF NOT EXISTS tv_shows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tmdb_id INT NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  year SMALLINT,
  overview TEXT,
  poster_path VARCHAR(255),
  backdrop_path VARCHAR(255),
  status VARCHAR(100),
  network VARCHAR(255),
  genres JSON,
  metadata_fetched_at JSON,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  show_id INT NOT NULL,
  season_number TINYINT UNSIGNED NOT NULL,
  episode_count TINYINT UNSIGNED,
  overview TEXT,
  poster_path VARCHAR(255),
  air_date DATE,
  UNIQUE KEY uq_season (show_id, season_number),
  FOREIGN KEY (show_id) REFERENCES tv_shows(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS episodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  season_id INT NOT NULL,
  show_id INT NOT NULL,
  episode_number TINYINT UNSIGNED NOT NULL,
  title VARCHAR(500),
  overview TEXT,
  still_path VARCHAR(255),
  air_date DATE,
  runtime_min SMALLINT,
  UNIQUE KEY uq_episode (show_id, season_id, episode_number),
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY (show_id) REFERENCES tv_shows(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS people (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tmdb_id INT NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  profile_path VARCHAR(255),
  biography TEXT
);

CREATE TABLE IF NOT EXISTS credits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  media_type ENUM('movie', 'show') NOT NULL,
  media_id INT NOT NULL,
  person_id INT NOT NULL,
  `character` VARCHAR(500),
  `role` ENUM('cast', 'crew') NOT NULL,
  `order` SMALLINT,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS external_ids (
  id INT AUTO_INCREMENT PRIMARY KEY,
  media_type ENUM('movie', 'show') NOT NULL,
  media_id INT NOT NULL,
  source ENUM('tmdb', 'tvdb', 'imdb') NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  UNIQUE KEY uq_external_id (media_type, media_id, source)
);

CREATE TABLE IF NOT EXISTS scrobble_exclusions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  integration ENUM('emby', 'stremio', 'kodi') NOT NULL,
  tmdb_id INT NOT NULL,
  media_type ENUM('movie', 'show') NOT NULL,
  title VARCHAR(500),
  created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_exclusion (integration, tmdb_id, media_type)
);
