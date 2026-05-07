ALTER TABLE movies
  ADD COLUMN origin_country VARCHAR(10) NULL AFTER genres,
  ADD COLUMN original_language VARCHAR(10) NULL AFTER origin_country,
  ADD COLUMN production_company VARCHAR(255) NULL AFTER original_language;

ALTER TABLE credits
  ADD COLUMN department VARCHAR(100) NULL;
