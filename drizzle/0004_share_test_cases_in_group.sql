-- Migration: Share test cases among all prompts within a prompt group
-- This changes test_cases from being linked to individual prompts to being linked to prompt groups

-- Step 1: Create a new table with the correct structure
CREATE TABLE `test_cases_new` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `prompt_group_id` integer NOT NULL,
    `input` text NOT NULL,
    `expected_output` text NOT NULL,
    `created_at` text NOT NULL
);
--> statement-breakpoint
-- Step 2: Migrate existing data
-- For each test case, find the prompt_group_id of its associated prompt
INSERT INTO `test_cases_new` (`id`, `prompt_group_id`, `input`, `expected_output`, `created_at`)
SELECT 
    tc.`id`,
    COALESCE(p.`prompt_group_id`, tc.`prompt_id`) as `prompt_group_id`,
    tc.`input`,
    tc.`expected_output`,
    tc.`created_at`
FROM `test_cases` tc
LEFT JOIN `prompts` p ON tc.`prompt_id` = p.`id`;
--> statement-breakpoint
-- Step 3: Drop the old table
DROP TABLE `test_cases`;
--> statement-breakpoint
-- Step 4: Rename the new table
ALTER TABLE `test_cases_new` RENAME TO `test_cases`;
--> statement-breakpoint
-- Step 5: Create the new index
CREATE INDEX `test_cases_prompt_group_id_idx` ON `test_cases` (`prompt_group_id`);
