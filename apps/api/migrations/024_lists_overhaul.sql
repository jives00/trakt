-- Add new columns to lists table
ALTER TABLE lists
  ADD COLUMN list_type ENUM('watchlist', 'dropped', 'rewatch', 'custom') NOT NULL DEFAULT 'custom' AFTER name,
  ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE AFTER list_type,
  ADD COLUMN slug VARCHAR(255) AFTER description,
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE AFTER slug,
  ADD COLUMN default_sort ENUM('added_date', 'alpha', 'last_updated', 'random') NOT NULL DEFAULT 'added_date' AFTER is_public;

-- Generate slugs for existing custom lists
UPDATE lists SET slug = LOWER(REPLACE(REPLACE(name, ' ', '-'), '''', '')) WHERE slug IS NULL;

-- Seed system lists for all existing users
INSERT INTO lists (user_id, name, list_type, is_system, slug, created_at)
SELECT id, 'Watchlist', 'watchlist', TRUE, 'watchlist', NOW() FROM users
WHERE id NOT IN (SELECT user_id FROM lists WHERE list_type = 'watchlist');

INSERT INTO lists (user_id, name, list_type, is_system, slug, created_at)
SELECT id, 'Dropped', 'dropped', TRUE, 'dropped', NOW() FROM users
WHERE id NOT IN (SELECT user_id FROM lists WHERE list_type = 'dropped');

INSERT INTO lists (user_id, name, list_type, is_system, slug, created_at)
SELECT id, 'Rewatch', 'rewatch', TRUE, 'rewatch', NOW() FROM users
WHERE id NOT IN (SELECT user_id FROM lists WHERE list_type = 'rewatch');

-- Migrate existing watchlist rows into list_items under each user's system watchlist
INSERT INTO list_items (list_id, media_type, media_id, added_at)
SELECT l.id, w.media_type, w.media_id, w.added_at
FROM watchlist w
JOIN lists l ON l.user_id = w.user_id AND l.list_type = 'watchlist';

-- Drop old standalone tables
DROP TABLE IF EXISTS watchlist;
DROP TABLE IF EXISTS collection;
