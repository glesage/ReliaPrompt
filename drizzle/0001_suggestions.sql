CREATE TABLE `suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`improvement_job_id` text NOT NULL REFERENCES `improvement_jobs`(`id`),
	`iteration` integer NOT NULL,
	`content` text NOT NULL,
	`rationale` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`applied_at` text,
	`undone_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `suggestions_improvement_job_id_idx` ON `suggestions` (`improvement_job_id`);
--> statement-breakpoint
CREATE INDEX `suggestions_status_idx` ON `suggestions` (`status`);

