-- Test seed data for apps/api integration tests.
-- Applied by the test setup helper before each test file runs.
-- Keep this minimal — tests add their own rows as needed.

INSERT INTO users (id, username, email, password_hash, created_at) VALUES
  (1, 'testuser', 'test@example.com', '$2a$10$w8.nw2ZYSXKqq1/i2UIJgOzYs71gDi4FaGWe5KZ2XgAC5orfKduNC', NOW());

INSERT INTO watch_history (id, user_id, media_type, media_id, watched_at, progress_pct, source) VALUES
  (1, 1, 'episode', 101, DATE_SUB(NOW(), INTERVAL 2 DAY), 100, 'manual'),
  (2, 1, 'episode', 102, DATE_SUB(NOW(), INTERVAL 1 DAY), 100, 'emby'),
  (3, 1, 'movie',   201, DATE_SUB(NOW(), INTERVAL 3 DAY), 100, 'manual');
