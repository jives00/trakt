-- Delete duplicate cast members, keeping the one with the highest episode count
DELETE c1 FROM credits c1
INNER JOIN (
  SELECT media_type, media_id, person_id, `role`, MIN(id) as min_id
  FROM credits
  GROUP BY media_type, media_id, person_id, `role`
  HAVING COUNT(*) > 1
) c2
WHERE c1.media_type = c2.media_type
  AND c1.media_id = c2.media_id
  AND c1.person_id = c2.person_id
  AND c1.`role` = c2.`role`
  AND c1.id > c2.min_id;

ALTER TABLE credits
ADD UNIQUE KEY uq_credits (media_type, media_id, person_id, `role`);
