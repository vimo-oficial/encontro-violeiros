CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`full_name` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`is_violeiro` integer DEFAULT 0 NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`protocol` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_whatsapp` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_participants` integer NOT NULL,
	`total_amount` integer NOT NULL,
	`consent` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_request_id_unique` ON `registrations` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_protocol_unique` ON `registrations` (`protocol`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`number` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` text NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_participant_id_unique` ON `tickets` (`participant_id`);