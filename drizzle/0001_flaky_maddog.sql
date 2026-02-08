ALTER TABLE `prompts` ADD `evaluation_mode` text DEFAULT 'schema' NOT NULL;--> statement-breakpoint
ALTER TABLE `prompts` ADD `evaluation_criteria` text;