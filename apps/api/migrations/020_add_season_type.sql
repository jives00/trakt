-- Add season_type to distinguish regular seasons from specials
-- Values: 'regular' or 'special' (from TMDB)
ALTER TABLE seasons ADD COLUMN season_type VARCHAR(20) NOT NULL DEFAULT 'regular';
