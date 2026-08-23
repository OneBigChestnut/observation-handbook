CREATE TABLE `handbook_publications` (`id` text PRIMARY KEY NOT NULL, `handbook_id` text NOT NULL REFERENCES `handbooks`(`id`) ON DELETE cascade, `child_id` text NOT NULL REFERENCES `children`(`id`) ON DELETE cascade, `snapshot` text NOT NULL, `state` text DEFAULT 'published' NOT NULL, `published_at` integer NOT NULL, `withdrawn_at` integer);
--> statement-breakpoint
CREATE INDEX `handbook_publications_state_published_index` ON `handbook_publications` (`state`,`published_at`);
