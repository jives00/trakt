CREATE TABLE IF NOT EXISTS now_playing (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  media_type   ENUM('movie','episode') NOT NULL,
  media_id     INT NOT NULL,
  progress_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
  source       ENUM('emby','stremio','kodi') NOT NULL DEFAULT 'emby',
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_now_playing_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
