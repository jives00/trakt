ALTER TABLE watch_history
  ADD INDEX idx_wh_user_type_media (user_id, media_type, media_id),
  ADD INDEX idx_wh_user_watched (user_id, watched_at);

ALTER TABLE credits
  ADD INDEX idx_credits_media (media_type, media_id);
