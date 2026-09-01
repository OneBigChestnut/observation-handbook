CREATE TABLE observation_projects (id text PRIMARY KEY NOT NULL, child_id text NOT NULL REFERENCES children(id) ON DELETE CASCADE, title text NOT NULL, object_name text NOT NULL, place text NOT NULL, question text NOT NULL, started_at text NOT NULL, completed_at text, cadence_days integer NOT NULL DEFAULT 7, focus_parts text NOT NULL DEFAULT '[]', stages text NOT NULL DEFAULT '[]', cover_media_asset_id text, conclusion text NOT NULL DEFAULT '', created_at integer NOT NULL, updated_at integer NOT NULL);
--> statement-breakpoint
CREATE INDEX projects_child_updated_index ON observation_projects(child_id, updated_at);
--> statement-breakpoint
ALTER TABLE observation_cards ADD COLUMN project_id text REFERENCES observation_projects(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE observation_cards ADD COLUMN observation_part text;
--> statement-breakpoint
ALTER TABLE observation_cards ADD COLUMN season text;
--> statement-breakpoint
ALTER TABLE observation_cards ADD COLUMN stage text;
--> statement-breakpoint
ALTER TABLE observation_cards ADD COLUMN change_note text;
--> statement-breakpoint
ALTER TABLE observation_cards ADD COLUMN evidence text;
--> statement-breakpoint
ALTER TABLE observation_cards ADD COLUMN hypothesis text;
