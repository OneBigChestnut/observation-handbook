CREATE TABLE `export_jobs` (`id` text PRIMARY KEY NOT NULL, `child_id` text NOT NULL REFERENCES `children`(`id`) ON DELETE cascade, `handbook_id` text NOT NULL REFERENCES `handbooks`(`id`) ON DELETE restrict, `kind` text NOT NULL, `snapshot` text NOT NULL, `created_at` integer NOT NULL);
--> statement-breakpoint
CREATE INDEX `export_jobs_child_created_index` ON `export_jobs` (`child_id`,`created_at`);
