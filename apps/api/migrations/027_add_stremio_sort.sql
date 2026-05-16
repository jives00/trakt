ALTER TABLE lists
  ADD COLUMN stremio_sort ENUM('added_date', 'alpha', 'random') NOT NULL DEFAULT 'added_date';
