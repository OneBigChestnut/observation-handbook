CREATE TABLE `card_photos` (
	`card_id` text NOT NULL,
	`media_asset_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`card_id`, `media_asset_id`),
	FOREIGN KEY (`card_id`) REFERENCES `observation_cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_photos_card_position_unique` ON `card_photos` (`card_id`,`position`);--> statement-breakpoint
CREATE TABLE `card_tags` (
	`card_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`card_id`, `tag_id`),
	FOREIGN KEY (`card_id`) REFERENCES `observation_cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `handbook_cards` (
	`handbook_id` text NOT NULL,
	`card_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`handbook_id`, `card_id`),
	FOREIGN KEY (`handbook_id`) REFERENCES `handbooks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `observation_cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handbook_cards_handbook_position_unique` ON `handbook_cards` (`handbook_id`,`position`);--> statement-breakpoint
CREATE TABLE `handbook_tags` (
	`handbook_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`handbook_id`, `tag_id`),
	FOREIGN KEY (`handbook_id`) REFERENCES `handbooks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `handbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`title` text NOT NULL,
	`introduction` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`visibility` text DEFAULT 'family' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `handbooks_child_updated_index` ON `handbooks` (`child_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`original_path` text NOT NULL,
	`thumbnail_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_assets_child_created_index` ON `media_assets` (`child_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `observation_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`observed_at` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `observation_cards_child_observed_index` ON `observation_cards` (`child_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_child_name_unique` ON `tags` (`child_id`,`name`);--> statement-breakpoint
CREATE INDEX `tags_child_created_index` ON `tags` (`child_id`,`created_at`);