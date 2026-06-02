ALTER TABLE movies
  ADD COLUMN digital_release_date DATE NULL AFTER release_date,
  ADD COLUMN physical_release_date DATE NULL AFTER digital_release_date;
