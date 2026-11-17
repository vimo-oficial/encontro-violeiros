CREATE TABLE `raffle_draws` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`full_name` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`participant_number` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `raffle_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`no_repeat` integer DEFAULT 1 NOT NULL
);
