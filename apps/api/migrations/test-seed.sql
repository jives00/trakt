-- Test seed: minimal data for integration tests.
-- Tests insert their own watchlist/collection/watch_history/ratings/lists rows.

INSERT INTO users (id, username, email, password_hash, created_at) VALUES
  (1, 'testuser', 'test@example.com', '$2a$10$w8.nw2ZYSXKqq1/i2UIJgOzYs71gDi4FaGWe5KZ2XgAC5orfKduNC', NOW());

-- Use fictional tmdb_ids (90xxx/91xxx) to avoid clashing with test mocks (550, 1396, 9999, etc.)
INSERT INTO movies (id, tmdb_id, title, year, poster_path, runtime_min, genres) VALUES
  (1, 90001, 'Test Movie Alpha', 2020, '/alpha.jpg', 120, '["Action","Adventure"]'),
  (2, 90002, 'Test Movie Beta',  2021, '/beta.jpg',   90, '["Drama"]');

INSERT INTO tv_shows (id, tmdb_id, title, year, poster_path, status, season_count, genres) VALUES
  (1, 91001, 'Test Show Alpha', 2020, '/sha.jpg', 'Ended',            2, '["Drama","Crime"]'),
  (2, 91002, 'Test Show Beta',  2021, '/shb.jpg', 'Returning Series', 1, '["Comedy"]');

INSERT INTO seasons (id, show_id, season_number, episode_count, fetched_at) VALUES
  (1, 1, 1, 3, NOW()),
  (2, 1, 2, 3, NOW()),
  (3, 2, 1, 2, NOW());

INSERT INTO episodes (id, season_id, show_id, episode_number, title, runtime_min, air_date) VALUES
  (1, 1, 1, 1, 'Pilot',     58, '2020-01-01'),
  (2, 1, 1, 2, 'Episode 2', 48, '2020-01-08'),
  (3, 1, 1, 3, 'Episode 3', 48, '2020-01-15'),
  (4, 2, 1, 1, 'S2 Pilot',  47, '2021-01-01'),
  (5, 2, 1, 2, 'S2 Ep 2',   47, '2021-01-08'),
  (6, 2, 1, 3, 'S2 Ep 3',   47, '2021-01-15'),
  (7, 3, 2, 1, 'Beta Pilot',   30, '2021-06-01'),
  (8, 3, 2, 2, 'Beta Ep 2',   30, '2021-06-08');
