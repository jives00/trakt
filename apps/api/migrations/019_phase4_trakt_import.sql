-- Phase 4: Trakt.tv Data Import
-- Adds schema support for importing Trakt data

-- Add trakt.tv as a valid source for watch history
ALTER TABLE watch_history MODIFY COLUMN source ENUM('manual','emby','stremio','kodi','trakt.tv') NOT NULL DEFAULT 'manual';

-- Add tmdb_id column to episodes for direct lookup during import
-- This allows resolving episodes by TMDB ID instead of requiring S/E number lookups
ALTER TABLE episodes ADD COLUMN tmdb_id INT NULL UNIQUE KEY;

-- Add sort_order column to watchlist to preserve user's watchlist ordering from Trakt
ALTER TABLE watchlist ADD COLUMN sort_order INT NULL;

-- Add sorting preferences to lists (sort_by and sort_how from Trakt)
ALTER TABLE lists ADD COLUMN sort_by VARCHAR(32) NOT NULL DEFAULT 'rank';
ALTER TABLE lists ADD COLUMN sort_how VARCHAR(4) NOT NULL DEFAULT 'asc';
