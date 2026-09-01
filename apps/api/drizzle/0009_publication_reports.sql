CREATE TABLE publication_reports (id text PRIMARY KEY NOT NULL, publication_id text NOT NULL REFERENCES handbook_publications(id) ON DELETE CASCADE, reporter_id text REFERENCES accounts(id) ON DELETE SET NULL, reason text NOT NULL, created_at integer NOT NULL);
--> statement-breakpoint
CREATE INDEX publication_reports_publication_created_index ON publication_reports(publication_id, created_at);
