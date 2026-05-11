ALTER TABLE episodes ADD COLUMN episode_type VARCHAR(50) DEFAULT 'standard' AFTER runtime_min;
