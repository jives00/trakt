ALTER TABLE watch_history ADD COLUMN completion_progress INT DEFAULT NULL;
ALTER TABLE watch_history ADD COLUMN playback_stopped_at DATETIME NULL;
UPDATE watch_history SET completion_progress = 100 WHERE completion_progress IS NULL;
