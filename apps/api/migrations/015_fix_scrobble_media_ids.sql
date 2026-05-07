-- Fix watch_history records with incorrect media_ids (stored tmdbId instead of actual database id)
-- This happens when movies/episodes were scrobbled via Emby/Stremio before the fix

-- Fix movie records: media_id was stored as movies.tmdb_id, should be movies.id
UPDATE watch_history wh
INNER JOIN movies m ON wh.media_id = m.tmdb_id AND wh.media_type = 'movie'
SET wh.media_id = m.id;
