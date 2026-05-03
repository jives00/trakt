CREATE TABLE IF NOT EXISTS media_image_overrides (
  media_type ENUM('show', 'movie') NOT NULL,
  tmdb_id    INT NOT NULL,
  image_type ENUM('hero', 'poster') NOT NULL,
  path       VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (media_type, tmdb_id, image_type)
);
