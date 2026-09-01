ALTER TABLE template_versions ADD COLUMN layout text NOT NULL DEFAULT '{"preset":"standard","safeMarginMm":10,"textAlign":"left"}';
--> statement-breakpoint
ALTER TABLE observation_cards ADD COLUMN template_id text REFERENCES template_versions(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE handbooks ADD COLUMN cover_template_id text REFERENCES template_versions(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE handbooks ADD COLUMN back_template_id text REFERENCES template_versions(id) ON DELETE RESTRICT;
