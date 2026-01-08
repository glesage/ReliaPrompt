import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const config = sqliteTable("config", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
});

export const prompts = sqliteTable(
    "prompts",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        name: text("name").notNull(),
        content: text("content").notNull(),
        version: integer("version").notNull().default(1),
        parentVersionId: integer("parent_version_id").references((): any => prompts.id),
        promptGroupId: integer("prompt_group_id"),
        createdAt: text("created_at").notNull(),
    },
    (table): any => [index("prompts_prompt_group_id_idx").on(table.promptGroupId)]
);

export const testCases = sqliteTable(
    "test_cases",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        promptGroupId: integer("prompt_group_id").notNull(),
        input: text("input").notNull(),
        expectedOutput: text("expected_output").notNull(),
        expectedOutputType: text("expected_output_type").notNull().default("array"),
        createdAt: text("created_at").notNull(),
    },
    (table) => [index("test_cases_prompt_group_id_idx").on(table.promptGroupId)]
);

export const testJobs = sqliteTable(
    "test_jobs",
    {
        id: text("id").primaryKey(),
        promptId: integer("prompt_id")
            .notNull()
            .references(() => prompts.id),
        status: text("status").notNull().default("pending"),
        totalTests: integer("total_tests").notNull().default(0),
        completedTests: integer("completed_tests").notNull().default(0),
        results: text("results"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        index("test_jobs_prompt_id_idx").on(table.promptId),
        index("test_jobs_status_idx").on(table.status),
    ]
);

export const testResults = sqliteTable(
    "test_results",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        jobId: text("job_id")
            .notNull()
            .references(() => testJobs.id),
        testCaseId: integer("test_case_id")
            .notNull()
            .references(() => testCases.id),
        llmProvider: text("llm_provider").notNull(),
        runNumber: integer("run_number").notNull(),
        actualOutput: text("actual_output"),
        isCorrect: integer("is_correct").notNull().default(0),
        score: real("score").notNull().default(0),
        expectedFound: integer("expected_found").notNull().default(0),
        expectedTotal: integer("expected_total").notNull().default(0),
        unexpectedFound: integer("unexpected_count").notNull().default(0),
        error: text("error"),
        durationMs: integer("duration_ms"),
        createdAt: text("created_at").notNull(),
    },
    (table) => [
        index("test_results_job_id_idx").on(table.jobId),
        index("test_results_test_case_id_idx").on(table.testCaseId),
    ]
);

export const improvementJobs = sqliteTable(
    "improvement_jobs",
    {
        id: text("id").primaryKey(),
        promptId: integer("prompt_id")
            .notNull()
            .references(() => prompts.id),
        status: text("status").notNull().default("pending"),
        currentIteration: integer("current_iteration").notNull().default(0),
        maxIterations: integer("max_iterations").notNull(),
        bestScore: real("best_score"),
        bestPromptContent: text("best_prompt_content"),
        bestPromptVersionId: integer("best_prompt_version_id").references(() => prompts.id),
        log: text("log"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
    },
    (table) => [
        index("improvement_jobs_prompt_id_idx").on(table.promptId),
        index("improvement_jobs_status_idx").on(table.status),
    ]
);

export const suggestions = sqliteTable(
    "suggestions",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        improvementJobId: text("improvement_job_id")
            .notNull()
            .references(() => improvementJobs.id),
        iteration: integer("iteration").notNull(),
        content: text("content").notNull(),
        rationale: text("rationale"),
        status: text("status").notNull().default("pending"), // pending, applied, undone, rejected
        appliedAt: text("applied_at"),
        undoneAt: text("undone_at"),
        createdAt: text("created_at").notNull(),
    },
    (table) => [
        index("suggestions_improvement_job_id_idx").on(table.improvementJobId),
        index("suggestions_status_idx").on(table.status),
    ]
);

export type Config = typeof config.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type TestCase = typeof testCases.$inferSelect;
export type TestJob = typeof testJobs.$inferSelect;
export type TestResult = typeof testResults.$inferSelect;
export type ImprovementJob = typeof improvementJobs.$inferSelect;
export type Suggestion = typeof suggestions.$inferSelect;
