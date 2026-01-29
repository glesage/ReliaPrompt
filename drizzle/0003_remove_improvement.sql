DROP TABLE `improvement_jobs`;--> statement-breakpoint
DROP TABLE `suggestions`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_prompts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`expected_schema` text,
	`version` integer DEFAULT 1 NOT NULL,
	`parent_version_id` integer,
	`prompt_group_id` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`parent_version_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_prompts`("id", "name", "content", "expected_schema", "version", "parent_version_id", "prompt_group_id", "created_at") SELECT "id", "name", "content", "expected_schema", "version", "parent_version_id", "prompt_group_id", "created_at" FROM `prompts`;--> statement-breakpoint
DROP TABLE `prompts`;--> statement-breakpoint
ALTER TABLE `__new_prompts` RENAME TO `prompts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `prompts_prompt_group_id_idx` ON `prompts` (`prompt_group_id`);--> statement-breakpoint
CREATE INDEX `test_cases_prompt_group_id_idx` ON `test_cases` (`prompt_group_id`);--> statement-breakpoint
CREATE TABLE `__new_test_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_tests` integer DEFAULT 0 NOT NULL,
	`completed_tests` integer DEFAULT 0 NOT NULL,
	`results` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_test_jobs`("id", "prompt_id", "status", "total_tests", "completed_tests", "results", "created_at", "updated_at") SELECT "id", "prompt_id", "status", "total_tests", "completed_tests", "results", "created_at", "updated_at" FROM `test_jobs`;--> statement-breakpoint
DROP TABLE `test_jobs`;--> statement-breakpoint
ALTER TABLE `__new_test_jobs` RENAME TO `test_jobs`;--> statement-breakpoint
CREATE INDEX `test_jobs_prompt_id_idx` ON `test_jobs` (`prompt_id`);--> statement-breakpoint
CREATE INDEX `test_jobs_status_idx` ON `test_jobs` (`status`);--> statement-breakpoint
CREATE TABLE `__new_test_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`test_case_id` integer NOT NULL,
	`llm_provider` text NOT NULL,
	`run_number` integer NOT NULL,
	`actual_output` text,
	`is_correct` integer DEFAULT 0 NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`expected_found` integer DEFAULT 0 NOT NULL,
	`expected_total` integer DEFAULT 0 NOT NULL,
	`unexpected_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`duration_ms` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `test_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_test_results`("id", "job_id", "test_case_id", "llm_provider", "run_number", "actual_output", "is_correct", "score", "expected_found", "expected_total", "unexpected_count", "error", "duration_ms", "created_at") SELECT "id", "job_id", "test_case_id", "llm_provider", "run_number", "actual_output", "is_correct", "score", "expected_found", "expected_total", "unexpected_count", "error", "duration_ms", "created_at" FROM `test_results`;--> statement-breakpoint
DROP TABLE `test_results`;--> statement-breakpoint
ALTER TABLE `__new_test_results` RENAME TO `test_results`;--> statement-breakpoint
CREATE INDEX `test_results_job_id_idx` ON `test_results` (`job_id`);--> statement-breakpoint
CREATE INDEX `test_results_test_case_id_idx` ON `test_results` (`test_case_id`);