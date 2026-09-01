ALTER TABLE handbooks ADD COLUMN cover_photo_id text REFERENCES media_assets(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE handbooks ADD COLUMN back_photo_id text REFERENCES media_assets(id) ON DELETE SET NULL;
