CREATE TABLE `template_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `kind` text NOT NULL,
  `state` text DEFAULT 'draft' NOT NULL,
  `paper_size` text DEFAULT 'A5' NOT NULL,
  `orientation` text DEFAULT 'portrait' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `template_versions_kind_state_index` ON `template_versions` (`kind`,`state`);
--> statement-breakpoint
CREATE TABLE `template_usages` (
  `id` text PRIMARY KEY NOT NULL,
  `template_version_id` text NOT NULL REFERENCES `template_versions`(`id`) ON UPDATE no action ON DELETE restrict,
  `reference_type` text NOT NULL,
  `reference_id` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `template_usages_template_index` ON `template_usages` (`template_version_id`);
